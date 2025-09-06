const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers, artifacts, network } = hre;
  
  const CertificateNFT = await ethers.getContractFactory("CertificateNFT");
  const certificate = await CertificateNFT.deploy("CertificateNFT");
  await certificate.waitForDeployment();
  const address = await certificate.getAddress();

  const issuer = process.env.ISSUER_ADDRESS;
  if (issuer) {
    const tx = certificate.transferOwnership(issuer);
    await tx.wait();
    console.log("Ownership transferred to:", issuer);
  }

  const artifact = await artifacts.readArtifact("CertificateNFT");

  const outDir = path.join(__dirname, "../../backend/deployed_contracts");
  fs.mkdirSync(outDir, { recursive: true });

  const chain = await ethers.provider.getNetwork();
  fs.writeFileSync(
    path.join(outDir, "CertificateNFT.json"),
    JSON.stringify(
      {
        address,
        abi: artifact.abi,
        network: network.name,
        chainId: Number(chain.chainId)
      },
      null,
      2
    )
  );

  console.log(`CertificateNFT deployed to ${address} on ${network.name} (chainId ${Number(chain.chainId)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});