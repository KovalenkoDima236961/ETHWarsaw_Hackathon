// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

contract CertificateNFT is ERC721URIStorage, Ownable, IERC5192, EIP712 {
    uint256 public nextCertificateId = 1;

    mapping(bytes32 => bool) public everUsedPdfHash;
    mapping(uint256 => bytes32) private _pdfHashOf;
    mapping(bytes32 => bool) public usedMintAuth;


    event CertificateMinted(address indexed to, uint256 indexed tokenId, string tokenURI, bytes32 indexed pdfHash);
    event CertificateBurned(uint256 indexed tokenId, bytes32 indexed pdfHash);


    // EIP-712 typehash for issuer-signed mint
    bytes32 private constant MINT_TYPEHASH =
        keccak256("Mint(address to,bytes32 tokenURIHash,bytes32 pdfHash,uint256 deadline)");

    constructor(string memory name_) ERC721(name_, "CERTIF") Ownable(msg.sender) EIP712("CertificateNFT", "1") {}

    // --- Issuer-only direct mint (admin / fallback) ---
    function mintCertificate(address to, string memory tokenURI_, bytes32 pdfHash)
        external
        onlyOwner
        returns (uint256)
    {
        return _mintInternal(to, tokenURI_, pdfHash);
    }

    // --- EIP-712 issuer-signed mint
    function mintWithIssuerSig(
        address to,
        string memory tokenURI_,
        bytes32 pdfHash,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256) {
        require(block.timestamp <= deadline, "Auth expired");
        require(!everUsedPdfHash[pdfHash], "PDF already used");

        // Sign over the hash of the tokenURI to avoid variable-length pitfalls
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_TYPEHASH,
                to,
                keccak256(bytes(tokenURI_)),
                pdfHash,
                deadline
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(digest, signature);
        require(signer == owner(), "Invalid issuer signature");
        require(!usedMintAuth[digest], "Auth already used");
        usedMintAuth[digest] = true;


        return _mintInternal(to, tokenURI_, pdfHash);
    }

    function _mintInternal(address to, string memory tokenURI_, bytes32 pdfHash) internal returns (uint256) {
        require(!everUsedPdfHash[pdfHash], "PDF already used");

        uint256 tokenId = nextCertificateId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        everUsedPdfHash[pdfHash] = true;
        _pdfHashOf[tokenId] = pdfHash;

        emit CertificateMinted(to, tokenId, tokenURI_, pdfHash);
        emit Locked(tokenId);
        return tokenId;
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal override {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
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
            revert("SBT: non-transferable");
        }
        return super._update(to, tokenId, auth);
    }

    function burn(uint256 tokenId) public {
        require(_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId) || msg.sender == owner(), "Not allowed to burn");
        _burnMeta(tokenId);
    }

    function _burnMeta(uint256 tokenId) internal {
        bytes32 pdfHash = _pdfHashOf[tokenId];
        
        if (pdfHash != bytes32(0)) {
            delete everUsedPdfHash[pdfHash];
            delete _pdfHashOf[tokenId];
        }

        super._burn(tokenId);

        emit CertificateBurned(tokenId, pdfHash);
        emit Unlocked(tokenId);
    }
    
    function isPdfHashUsed(bytes32 pdfHash) external view returns (bool) {
        return everUsedPdfHash[pdfHash];
    }

    function pdfHashOf(uint256 tokenId) external view returns (bytes32) {
        require(_ownerOf(tokenId) != address(0), "Query for nonexistent token");
        return _pdfHashOf[tokenId];
    }

    function locked(uint256 tokenId) external view override returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Query for nonexistent token");
        return true;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override
        returns (bool)
    {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

}