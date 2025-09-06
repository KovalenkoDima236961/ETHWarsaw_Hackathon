import CryptoJS from 'crypto-js';
import { BrowserProvider, Contract } from "ethers";
import type { ContractMeta } from "../types/contract_meta";
import { getBrowserProvider, getReadProvider } from "./providers";
import { normalizeBytes32 } from "./cryptography";
import { aesEncryptBytes, aesEncryptJson } from './cryptography';

const VITE_IS_DEV = import.meta.env.VITE_IS_DEV;
const VITE_LOCALHOST_LINK = import.meta.env.VITE_LOCALHOST_LINK;

export interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
  };
}

export const deriveSymmetricKeyFromMetaMask = async (): Promise<CryptoJS.lib.WordArray> => {
    const provider = window.ethereum;
    if (!provider) throw new Error("MetaMask not installed");
    await provider.request({ method: "eth_requestAccounts" });
    const web3Provider = new BrowserProvider(provider);
    const signer = await web3Provider.getSigner();
    const address = await signer.getAddress();

    const message = `Please sign this message to provide your encryption key for document access. Wallet: ${address}`;
    const signature = await signer.signMessage(message);
    const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;
    const sigWordArray = CryptoJS.enc.Hex.parse(sigHex);
    const key = CryptoJS.SHA256(sigWordArray);
    return key;
}

export const fetchCertificateContractMeta = async (): Promise<ContractMeta> => {
    if (VITE_IS_DEV == "true") {
        const res = await fetch(`${VITE_LOCALHOST_LINK}/api/nft-private-certificate-meta`);
        if (!res.ok) throw new Error("Failed to fetch contract metadata");
        return res.json();
    }
    throw new Error("Available only in Dev");
}

export async function isPdfHashUsed(pdfHash: string): Promise<boolean> {
  const meta = await fetchCertificateContractMeta();
  const provider = getReadProvider();

  await provider.getBlockNumber();

  const contract = new Contract(meta.address, meta.abi, provider);
  const normalized = normalizeBytes32(pdfHash);
  const res = await contract.isPdfHashUsed(normalized);
  console.log("[isPdfHashUsed] address", meta.address, "hash", normalized, "=>", res);
  return res;
}


export const uploadBlobToIpfs = async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("file", blob, "encrypted");
    const response = await fetch("http://127.0.0.1:5001/api/v0/add", {
        method: "POST",
        body: formData,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error("IPFS upload failed: " + text);
    }
    const lines = (await response.text()).split("\n").filter(Boolean);
    const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
    if (!last || !last.Hash) throw new Error("IPFS response did not contain a CID");
    return `ipfs://${last.Hash}`;
}


export const mintCertificateNFT = async (fields: Record<string, any>, file: File, pdfHash: string | null) => {
  
  const key = await deriveSymmetricKeyFromMetaMask();

  // 2. Encrypt PDF and upload to IPFS
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const encryptedPdf = aesEncryptBytes(fileBytes, key);
  const encryptedPdfBlob = new Blob([encryptedPdf], { type: "application/octet-stream" });
  const encryptedPdfIpfsUrl = await uploadBlobToIpfs(encryptedPdfBlob);

  // 3. Add PDF IPFS URL to fields, encrypt fields, upload to IPFS
  const fieldsWithPdf = { ...fields, certificate_ipfs_url: encryptedPdfIpfsUrl };
  const encryptedFieldsBytes = aesEncryptJson(fieldsWithPdf, key);
  const encryptedFieldsBlob = new Blob([encryptedFieldsBytes], { type: "application/octet-stream" });
  const encryptedFieldsIpfsUrl = await uploadBlobToIpfs(encryptedFieldsBlob);


  const contractMeta = await fetchCertificateContractMeta();
  if (!(window as any).ethereum) throw new Error("MetaMask not found");
  await (window as any).ethereum.request({ method: "eth_requestAccounts" });
  const web3Provider = getBrowserProvider();
  const signer = await web3Provider.getSigner();
  const userAddress = await signer.getAddress();

  const contract = new Contract(contractMeta.address, contractMeta.abi, signer);
  try {
    // 2. Mint the NFT with the exact URI received
    const tx = await contract.mintCertificate(userAddress, encryptedFieldsIpfsUrl, pdfHash);

    // 3. Wait for the transaction to be mined
    const receipt = await tx.wait();

    // 4. Find CertificateMinted event
    const event = receipt.logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find((e) => e?.name === "CertificateMinted");

    if (!event) throw new Error("CertificateMinted event not found in transaction receipt");

    const tokenId = event.args.tokenId?.toString() ?? event.args[1]?.toString();
    const eventTokenURI = event.args.tokenURI ?? event.args[2];

    // 5. Fetch tokenURI from the contract
    let chainTokenURI = "";
    try {
      chainTokenURI = await contract.tokenURI(tokenId);
    } catch (error) {
      console.error(`[mintCertificateNFT] Failed to fetch tokenURI for tokenId ${tokenId}:`, error);
    }

    // 6. Compare event and chain tokenURI
    if (eventTokenURI === chainTokenURI) {
    } else {
      console.error(
        `[mintCertificateNFT] MISMATCH: Event tokenURI (${eventTokenURI}) does not match chain tokenURI (${chainTokenURI})`
      );
      alert(
        `[mintCertificateNFT] MISMATCH: Event tokenURI (${eventTokenURI}) does not match chain tokenURI (${chainTokenURI})`
      );
    }

    alert("Certificate NFT minted! Token ID: " + tokenId);
    return { tokenId, tokenURI: chainTokenURI };
  } catch (error: any) {
    console.error("[mintCertificateNFT] Minting failed:", error);
    if (error.data) console.error("Error data:", error.data);
    alert("Minting failed: " + (error.reason || error.message));
    throw error;
  }
};