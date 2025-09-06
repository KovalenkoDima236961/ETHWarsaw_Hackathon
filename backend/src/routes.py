# routes.py
import io
import json
import os
import re
import time
import threading
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, HTTPException, File, UploadFile, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Your existing utils
from utils.main_util import verify_certificate
from utils.build_merkle_tree import build_merkle_proofs

# Web3 / signing
from web3 import Web3
from web3.contract import Contract
from eth_account import Account
from eth_utils import to_bytes, remove_0x_prefix
from eth_abi import encode as abi_encode

router = APIRouter()

# --------------------------------------------------------------------
# ENV & Initialization
# --------------------------------------------------------------------
RPC_URL = os.getenv("RPC_URL", "http://127.0.0.1:8545")
CONTRACT_JSON_PATH = os.getenv("CONTRACT_JSON_PATH", "./deployed_contracts/CertificateNFT.json")

ISSUER_PRIVATE_KEY = os.getenv("ISSUER_PRIVATE_KEY")  # signs EIP-712
RELAYER_PRIVATE_KEY = os.getenv("RELAYER_PRIVATE_KEY", ISSUER_PRIVATE_KEY)  # optional gasless submitter

CIVIC_ISSUER = os.getenv("CIVIC_ISSUER", "https://auth.civic.com/oauth")
CIVIC_AUDIENCE = os.getenv("CIVIC_AUDIENCE")  # your Civic client ID
CIVIC_JWKS_URL = os.getenv("CIVIC_JWKS_URL")  # optional override

ALLOWLIST_WALLETS = set(
    a.strip().lower() for a in os.getenv("ALLOWLIST_WALLETS", "").split(",") if a.strip()
)

# Simple in-memory per-user (JWT sub) rate limit
RL_USER_MAX = int(os.getenv("RL_USER_MAX", "10"))
RL_USER_WINDOW_MS = int(os.getenv("RL_USER_WINDOW_MS", "60000"))
_user_hits: Dict[str, List[float]] = {}

if not ISSUER_PRIVATE_KEY:
    raise RuntimeError("Missing env: ISSUER_PRIVATE_KEY")

# Web3 / Accounts / Contract
w3 = Web3(Web3.HTTPProvider(RPC_URL))
try:
    issuer_acct = Account.from_key(ISSUER_PRIVATE_KEY)
except Exception as e:
    raise RuntimeError(f"ISSUER_PRIVATE_KEY invalid: {e}")
try:
    relayer_acct = Account.from_key(RELAYER_PRIVATE_KEY)
except Exception as e:
    raise RuntimeError(f"RELAYER_PRIVATE_KEY invalid: {e}")

if not os.path.exists(CONTRACT_JSON_PATH):
    raise RuntimeError(f"Contract JSON not found at {CONTRACT_JSON_PATH}")
with open(CONTRACT_JSON_PATH, "r") as f:
    meta = json.load(f)

try:
    CONTRACT_ADDR = Web3.to_checksum_address(meta["address"])
except Exception as e:
    raise RuntimeError(f"Invalid contract address in JSON: {e}")

ABI = meta["abi"]
contract: Contract = w3.eth.contract(address=CONTRACT_ADDR, abi=ABI)

# Best-effort warning if contract owner != issuer signer
try:
    owner = contract.functions.owner().call()
    if Web3.to_checksum_address(owner) != Web3.to_checksum_address(issuer_acct.address):
        print(f"[WARN] contract owner {owner} != issuer signer {issuer_acct.address}. "
              f"mintWithIssuerSig() expects signature from owner(). Transfer ownership or add EIP-1271 for multisig.")
    else:
        print(f"[OK] contract owner matches issuer signer: {issuer_acct.address}")
except Exception as e:
    print("[INFO] owner() read failed — continuing:", e)

# --------------------------------------------------------------------
# Civic JWT verification (JWKS)
# --------------------------------------------------------------------
_discovery_cache = {}   # iss -> {"jwks_uri": str, "ts": float}
_jwks_cache = {}        # jwks_uri -> {"keys": dict, "ts": float}
_CACHE_TTL_SEC = 300


def _discover(issuer: str) -> str:
    """Return jwks_uri using OIDC discovery for the given issuer."""
    iss = (issuer or "").rstrip("/")
    now = time.time()

    # cache hit?
    cached = _discovery_cache.get(iss)
    if cached and now - cached["ts"] <= _CACHE_TTL_SEC:
        return cached["jwks_uri"]

    # try standard path first
    urls = [f"{iss}/.well-known/openid-configuration"]
    # if issuer looks like https://.../oauth, also try the root
    if iss.endswith("/oauth"):
        root = iss[: -len("/oauth")]
        urls.append(f"{root}/.well-known/openid-configuration")

    last_err = None
    for url in urls:
        try:
            r = requests.get(url, timeout=5)
            r.raise_for_status()
            data = r.json()
            jwks_uri = data.get("jwks_uri")
            if jwks_uri:
                _discovery_cache[iss] = {"jwks_uri": jwks_uri, "ts": now}
                return jwks_uri
        except Exception as e:
            last_err = e

    raise HTTPException(401, f"OIDC discovery failed for issuer {issuer}: {last_err}")


def _get_jwks(jwks_uri: str) -> Dict[str, Any]:
    """Fetch (with cache) the JWKS for jwks_uri."""
    now = time.time()
    cached = _jwks_cache.get(jwks_uri)
    if cached and now - cached["ts"] <= _CACHE_TTL_SEC:
        return cached["keys"]

    r = requests.get(jwks_uri, timeout=5)
    r.raise_for_status()
    keys = r.json()
    _jwks_cache[jwks_uri] = {"keys": keys, "ts": now}
    return keys


def verify_civic_token(bearer: str) -> Dict[str, Any]:
    from jose import jwt

    if not bearer or not bearer.lower().startswith("bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")

    token = bearer.split(" ", 1)[1]

    # Peek without verification to learn iss/aud/kid
    try:
        unverified_header = jwt.get_unverified_header(token)
        claims = jwt.get_unverified_claims(token)
    except Exception as e:
        raise HTTPException(401, f"Invalid token format: {e}")

    iss = claims.get("iss")
    if not iss:
        raise HTTPException(401, "Token missing 'iss' claim")

    # Safety: ensure Civic domain
    p = urlparse(iss)
    if p.scheme != "https" or not p.netloc.endswith("civic.com"):
        raise HTTPException(401, f"Unexpected issuer host: {p.netloc}")

    # Discover the correct JWKS via the issuer
    jwks_uri = _discover(iss)
    jwks = _get_jwks(jwks_uri)
    kid = unverified_header.get("kid")
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        raise HTTPException(401, "No matching JWKS key (kid) for token")

    # Verify; only enforce audience if you configured it
    alg = unverified_header.get("alg", "RS256")
    verify_aud = bool(CIVIC_AUDIENCE)
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience=CIVIC_AUDIENCE if verify_aud else None,
            issuer=iss,
            options={"verify_aud": verify_aud},
        )
        return payload
    except Exception as e:
        raise HTTPException(401, f"Token verification failed: {e}")

def per_user_limit(sub: str, max_hits: int, window_ms: int):
    now = time.time() * 1000
    hits = _user_hits.get(sub, [])
    hits = [t for t in hits if now - t < window_ms]
    hits.append(now)
    _user_hits[sub] = hits
    if len(hits) > max_hits:
        raise HTTPException(429, "Too many requests")


def eip712_mint_digest(
    *,
    to_addr: str,
    token_uri_hash_hex: str,   # 0x… bytes32
    pdf_hash_hex: str,         # 0x… bytes32
    deadline: int,
    chain_id: int,
    verifying_contract: str,
    name: str = "CertificateNFT",
    version: str = "1",
) -> bytes:
    # Type hashes
    mint_typehash = Web3.keccak(text="Mint(address to,bytes32 tokenURIHash,bytes32 pdfHash,uint256 deadline)")
    domain_typehash = Web3.keccak(text="EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")

    # Domain separator: keccak(abi.encode(...))
    name_hash    = Web3.keccak(text=name)
    version_hash = Web3.keccak(text=version)
    domain_bytes = abi_encode(
        ["bytes32","bytes32","bytes32","uint256","address"],
        [domain_typehash, name_hash, version_hash, int(chain_id), Web3.to_checksum_address(verifying_contract)],
    )
    domain_separator = Web3.keccak(domain_bytes)

    # Struct hash: keccak(abi.encode(...))
    msg_bytes = abi_encode(
        ["bytes32","address","bytes32","bytes32","uint256"],
        [
            mint_typehash,
            Web3.to_checksum_address(to_addr),
            Web3.to_bytes(hexstr=token_uri_hash_hex),
            Web3.to_bytes(hexstr=pdf_hash_hex),
            int(deadline),
        ],
    )
    struct_hash = Web3.keccak(msg_bytes)

    # EIP-191 hash
    return Web3.keccak(b"\x19\x01" + domain_separator + struct_hash)


def _sign_digest_65(digest: bytes) -> str:
    """
    Sign a 32-byte EIP-712 digest and return 0x + r(32) + s(32) + v(1).
    Ensures v is 27/28 and s is canonical.
    """
    # 1) Try eth-account (LocalAccount)
    for obj, name in (
        (issuer_acct, "signHash"),   # some versions expose signHash
        (issuer_acct, "sign_hash"),  # others expose sign_hash
    ):
        signer = getattr(obj, name, None)
        if callable(signer):
            signed = signer(digest)   # LocalAccount.* does NOT need private_key
            # eth-account returns .signature with correct 27/28 v
            sig = signed.signature
            # Safety normalization:
            sig_bytes = bytes(sig)
            v = sig_bytes[64]
            if v in (0, 1):
                sig_bytes = sig_bytes[:64] + bytes([v + 27])
            return "0x" + sig_bytes.hex()

    # 2) Fallback: eth-keys
    from eth_keys import keys as eth_keys_keys
    pk_bytes = bytes.fromhex(remove_0x_prefix(ISSUER_PRIVATE_KEY))
    priv = eth_keys_keys.PrivateKey(pk_bytes)
    sig_obj = priv.sign_msg_hash(digest)  # signs the raw 32-byte hash

    # eth-keys guarantees canonical 's'. Build r||s||v and normalize v.
    r = sig_obj.r.to_bytes(32, "big")
    s = sig_obj.s.to_bytes(32, "big")
    v = sig_obj.v  # may be 0/1 or 27/28 depending on version
    if v in (0, 1):
        v += 27
    sig_bytes = r + s + bytes([v])
    return "0x" + sig_bytes.hex()


def _recover_addr_from_digest(digest: bytes, signature_hex: str) -> str:
    from eth_keys import keys as eth_keys_keys
    b = bytes.fromhex(remove_0x_prefix(signature_hex))
    if len(b) != 65:
        raise ValueError("bad sig length")
    r = int.from_bytes(b[0:32], "big")
    s = int.from_bytes(b[32:64], "big")
    v = b[64]
    # OpenZeppelin ECDSA expects 27/28; eth-keys expects 0/1 for recovery
    if v in (27, 28):
        v -= 27
    sig_obj = eth_keys_keys.Signature(vrs=(v, r, s))
    pub = sig_obj.recover_public_key_from_msg_hash(digest)
    return pub.to_checksum_address()

# --------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------
HEX32_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")
def is_bytes32(x: str) -> bool:
    return bool(HEX32_RE.match(x or ""))

def keccak_bytes32_hex(s: str) -> str:
    return w3.keccak(text=s).hex()

# --------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------
@router.get("/api/nft-profile-meta")
async def get_nft_profile_meta():
    filename = os.path.join(os.path.dirname(__file__), "deployed_contracts", "NFT.json")
    filename = os.path.abspath(filename)
    if not os.path.exists(filename):
        raise HTTPException(status_code=500, detail="NFT.json not found")
    with open(filename, "r") as file:
        contract_data = json.load(file)
    return JSONResponse(content=contract_data)

@router.get("/api/nft-private-certificate-meta")
async def get_nft_private_certificate_meta():
    filename = CONTRACT_JSON_PATH
    if not os.path.exists(filename):
        raise HTTPException(status_code=500, detail=f"CertificateNFT.json not found at {filename}")
    with open(filename, "r") as f:
        return JSONResponse(content=json.load(f))

@router.get("/api/nft-view-certificate-meta")
async def get_nft_view_certificate_meta():
    filename = os.path.join(os.path.dirname(__file__), "deployed_contracts", "ViewCertificateNFT.json")
    filename = os.path.abspath(filename)
    if not os.path.exists(filename):
        raise HTTPException(status_code=500, detail="ViewCertificateNFT.json not found")
    with open(filename, "r") as file:
        contract_data = json.load(file)
    return JSONResponse(content=contract_data)

@router.post("/api/verify_certificate")
async def verify_certificate_endpoint(
    request: Request,
    file: UploadFile = File(...)
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    file_like = io.BytesIO(contents)
    try:
        vc = verify_certificate(file_like)

        if not isinstance(vc, dict) or "fields" not in vc or not isinstance(vc["fields"], dict):
            raise HTTPException(status_code=500, detail="verify_certificate returned unexpected shape")

        field_names = list(vc["fields"].keys())
        field_proofs = build_merkle_proofs(vc["fields"], field_names)

        return {
            "is_verified": bool(vc.get("is_verified")),
            "fields": vc,
            "field_proofs": field_proofs
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {e}")

# --------------------------------------------------------------------
# New: EIP-712 signed mint + optional relay
# --------------------------------------------------------------------
class SignMintIn(BaseModel):
    to: str
    tokenURI: str
    pdfHash: str
    deadline: Optional[int] = None  # seconds since epoch
    chainId: Optional[int] = None

class SignMintOut(BaseModel):
    signature: str
    deadline: int

class RelayMintIn(SignMintIn):
    signature: str

class RelayMintOut(BaseModel):
    txHash: str
    tokenId: Optional[str] = None

@router.post("/api/sign-mint", response_model=SignMintOut)
def sign_mint(inp: SignMintIn, authorization: Optional[str] = Header(None)):
    # Civic auth / policy checks unchanged...
    payload = verify_civic_token(authorization or "")
    sub = str(payload.get("sub", ""))
    if not sub:
        raise HTTPException(401, "Invalid token: sub missing")
    per_user_limit(sub, RL_USER_MAX, RL_USER_WINDOW_MS)

    try:
        to = Web3.to_checksum_address(inp.to)
    except Exception:
        raise HTTPException(400, "Invalid recipient address")
    if not is_bytes32(inp.pdfHash):
        raise HTTPException(400, "pdfHash must be 0x + 64 hex")

    try:
        if contract.functions.isPdfHashUsed(inp.pdfHash).call():
            raise HTTPException(409, "PDF hash already used")
    except Exception:
        pass

    deadline = int(inp.deadline) if inp.deadline else int(time.time()) + 600
    chain_id = int(inp.chainId) if inp.chainId else w3.eth.chain_id

    # IMPORTANT: tokenURIHash is keccak256(tokenURI string)
    token_uri_hash_hex = keccak_bytes32_hex(inp.tokenURI)

    # Build EIP-712 digest and sign
    digest = eip712_mint_digest(
        to_addr=to,
        token_uri_hash_hex=token_uri_hash_hex,
        pdf_hash_hex=inp.pdfHash,
        deadline=deadline,
        chain_id=chain_id,
        verifying_contract=CONTRACT_ADDR,
        name="CertificateNFT",
        version="1",
    )

    try:
        signature_hex = _sign_digest_65(digest)
    except Exception as e:
        raise HTTPException(500, f"Signing failed: {e}")

    try:
        recovered = _recover_addr_from_digest(digest, signature_hex)
        onchain_owner = contract.functions.owner().call()
        print("[sign-mint] domain:", {
            "name": "CertificateNFT",
            "version": "1",
            "chainId": chain_id,
            "verifyingContract": CONTRACT_ADDR,
        })
        print("[sign-mint] recovered:", recovered)
        print("[sign-mint] owner(): ", onchain_owner)
        print("[sign-mint] issuer:  ", issuer_acct.address)
    except Exception as e:
        print("[sign-mint] recover debug failed:", e)

    return {"signature": signature_hex, "deadline": deadline}


@router.post("/api/relay-mint", response_model=RelayMintOut)
def relay_mint(inp: RelayMintIn, authorization: Optional[str] = Header(None)):
    # Civic auth + stricter rate
    payload = verify_civic_token(authorization or "")
    sub = str(payload.get("sub", ""))
    if not sub:
        raise HTTPException(401, "Invalid token: sub missing")
    per_user_limit(sub, max(1, RL_USER_MAX // 2), RL_USER_WINDOW_MS)

    # Policy & args
    try:
        to = Web3.to_checksum_address(inp.to)
    except Exception:
        raise HTTPException(400, "Invalid recipient address")
    if not is_bytes32(inp.pdfHash):
        raise HTTPException(400, "pdfHash must be 0x + 64 hex")
    if not (isinstance(inp.signature, str) and inp.signature.startswith("0x")):
        raise HTTPException(400, "signature must be 0x hex")

    try:
        # Build tx
        fn = contract.functions.mintWithIssuerSig(to, inp.tokenURI, inp.pdfHash, int(inp.deadline), inp.signature)
        nonce = w3.eth.get_transaction_count(relayer_acct.address)
        tx = fn.build_transaction({
            "from": relayer_acct.address,
            "nonce": nonce,
        })

        # EIP-1559 fees (simple)
        gas_price = w3.eth.gas_price
        tx.setdefault("maxFeePerGas", gas_price)
        tx.setdefault("maxPriorityFeePerGas", max(1, gas_price // 10))

        signed = w3.eth.account.sign_transaction(tx, private_key=RELAYER_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        rcpt = w3.eth.wait_for_transaction_receipt(tx_hash)

        # Parse CertificateMinted
        token_id_str = None
        try:
            evt = contract.events.CertificateMinted()
            for log in rcpt["logs"]:
                try:
                    parsed = evt.process_log(log)
                    token_id_str = str(parsed["args"]["tokenId"])
                    break
                except Exception:
                    pass
        except Exception:
            pass

        return {"txHash": tx_hash.hex(), "tokenId": token_id_str}
    except Exception as e:
        raise HTTPException(500, f"relay error: {e}")
