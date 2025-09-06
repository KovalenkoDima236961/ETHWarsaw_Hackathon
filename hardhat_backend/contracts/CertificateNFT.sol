// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CertificateNFT is ERC721URIStorage, Ownable {
    string public certificate_name;
    uint256 public nextCertificateId = 1;

    mapping(bytes32 => bool) public usedPdfHashes;
    mapping(uint256 => bytes32) public merkleRoots;
    mapping(uint256 => bytes32) private _pdfHashOf;

    event CertificateMinted(address indexed to, uint256 indexed tokenId, string tokenURI, bytes32 pdfHash);
    event CertificateBurned(uint256 indexed tokenId, bytes32 pdfHash);

    constructor(string memory _certificateName) ERC721(_certificateName, "CERTIF") Ownable(msg.sender) {
        certificate_name = _certificateName;
    }

    function mintCertificate(address to, string memory tokenURI, bytes32 pdfHash) public returns (uint256) {
        require(!usedPdfHashes[pdfHash], "Certificate with this PDF already minted");
    
        uint256 tokenId = nextCertificateId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);

        usedPdfHashes[pdfHash] = true;
        _pdfHashOf[tokenId] = pdfHash;

        emit CertificateMinted(to, tokenId, tokenURI, pdfHash);
        return tokenId;
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal override {
        require(bytes(tokenURI(tokenId)).length == 0, "Token URI already set");
        super._setTokenURI(tokenId, _tokenURI);
    }

    function transferFrom(address from, address to, uint256 tokenId) public pure override(ERC721, IERC721) {
        from; to; tokenId;
        revert("This NFT cannot be transferred");
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("This NFT cannot be transferred");
        }
        return super._update(to, tokenId, auth);
    }

    function burn(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender || msg.sender == owner(), "Not allowed to burn");
        _burnMeta(tokenId);
    }

    function _burnMeta(uint256 tokenId) internal {
        bytes32 pdfHash = _pdfHashOf[tokenId];
        
        if (pdfHash != bytes32(0)) {
            delete usedPdfHashes[pdfHash];
            delete _pdfHashOf[tokenId];
        }

        super._burn(tokenId);

        emit CertificateBurned(tokenId, pdfHash);
    }
    
    function isPdfHashUsed(bytes32 pdfHash) external view returns (bool) {
        return usedPdfHashes[pdfHash];
    }

    function pdfHashOf(uint256 tokenId) external view returns (bytes32) {
        return _pdfHashOf[tokenId];
    }
}