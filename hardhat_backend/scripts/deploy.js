const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const CertificateNFT = await hre.ethers.getContractFactory("CertificateNFT");
  const certificate = await CertificateNFT.deploy("CertificateNFT");
  await certificate.waitForDeployment();
  const certificateAddr = await certificate.getAddress();

  artifact = await hre.artifacts.readArtifact("CertificateNFT");
  fs.writeFileSync(
    path.join(__dirname, "../../backend/deployed_contracts/CertificateNFT.json"),
    JSON.stringify({ address: certificateAddr, abi: artifact.abi }, null, 2)
  );
  console.log("Certificate NFT deployed to:", certificateAddr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});