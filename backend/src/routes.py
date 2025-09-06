from fastapi import APIRouter, HTTPException, File, UploadFile, Form, Request
from fastapi.responses import JSONResponse
from utils.main_util import verify_certificate
from utils.build_merkle_tree import generate_merkle_root, build_merkle_proofs
import os
import json
import io
import logging

router = APIRouter()

# Return ProfileNFT.json
@router.get("/api/nft-profile-meta")
async def get_nft_profile_meta():
    filename = os.path.join(os.path.dirname(__file__), "..", "deployed_contracts", "NFT.json")
    filename = os.path.abspath(filename)  # Optional: resolves to absolute path
    print("Resolved filename:", filename)  # Debug: see if path is correct

    if not os.path.exists(filename):
        raise HTTPException(status_code=500, detail="NFT.json not found")
    with open(filename, "r") as file:
        contract_data = json.load(file)
    return JSONResponse(content=contract_data)

@router.get("/api/nft-private-certificate-meta")
async def get_nft_private_certificate_meta():
    filename = os.path.join(os.path.dirname(__file__), "..", "deployed_contracts", "CertificateNFT.json")
    filename = os.path.abspath(filename)  # Optional: resolves to absolute path
    print("Resolved filename:", filename)  # Debug: see if path is correct

    if not os.path.exists(filename):
        print("Not exists")
        raise HTTPException(status_code=500, detail="CertificateNFT.json not found")
    with open (filename, "r") as file:
        contract_data = json.load(file)
    return JSONResponse(content=contract_data)


@router.get("/api/nft-view-certificate-meta")
async def get_nft_view_certificate_meta():
    filename = os.path.join(os.path.dirname(__file__), "..", "deployed_contracts", "ViewCertificateNFT.json")
    filename = os.path.abspath(filename)
    print("Resolved filename:", filename)

    if  not os.path.exists(filename):
        print("View NFT is not exists")
        raise HTTPException(status_code=500, detail="ViewCertificateNFT.json not found")
    with open (filename, "r") as file:
        contract_data = json.load(file)
    return JSONResponse(content=contract_data)


@router.post("/api/verify_certificate")
async def verify_certificate_endpoint(
    request: Request,
    file: UploadFile = File(...)
):
    print("DEBUG file:", file)
    if file:
        print("DEBUG file.filename:", file.filename)
    else:
        print("No file uploaded!")

    contents = await file.read()
    file_like = io.BytesIO(contents)
    try:
        result = verify_certificate(file_like)

        fields = list(result.keys())
        field_proofs = build_merkle_proofs(result, fields) # { "field1": [...], ... }

        return {
            "is_verified": True,
            "fields": result,
            "field_proofs": field_proofs
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"An error occurred during processing: {e}")