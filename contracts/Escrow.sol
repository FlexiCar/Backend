//SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "./interfaces/IERC4907.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Escrow is Ownable {
    enum Status{
      RENTED,
      AVAILABLE   
    }

    struct Listing {
        uint256 hourlyPrice;
        uint256 maxDays;
        address owner;
        Status status;
    }


   address immutable private s_nftAddress;

    mapping(uint256 => Listing) private s_listings;
    mapping(address => uint256) s_balances;

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    error NFT_ALERADY_LISTED();
    error NOT_THE_OWNER();
    error NOT_APPROVED_BY_OWNER();
    error PriceMustBeAboveZero();


    modifier notListed(uint256 tokenId) {
        Listing memory listing = s_listings[tokenId];
        if (listing.hourlyPrice > 0) {
            revert NFT_ALERADY_LISTED();
        }
        _;
    }

    modifier isOwner(
        uint256 tokenId,
        address spender
    ) {
        IERC4907 _nft = IERC4907(s_nftAddress);
        address owner = _nft.ownerOf(tokenId);
        if (owner != spender) {
            revert NOT_THE_OWNER();
        }
        _;
    }

    constructor(address _nftAddress) {
      s_nftAddress = _nftAddress;
    }

    function listCar(
        uint256 _tokenId,
        uint256 _price,
        uint256 _maxDays
    )
        public
        notListed( _tokenId)
        isOwner( _tokenId, msg.sender)
    {
       if(_price <= 0){
           revert PriceMustBeAboveZero();
       }
       IERC4907 _nft = IERC4907(s_nftAddress);
       if(_nft.getApproved(_tokenId) != address(this)){
        revert NOT_APPROVED_BY_OWNER();
       }
       Listing memory listing = Listing({
            hourlyPrice: _price,
            maxDays: _maxDays,
            owner: msg.sender,
            status: Status.AVAILABLE
        });
        s_listings[_tokenId] = listing;
        emit ItemListed(msg.sender, s_nftAddress, _tokenId, _price);
    }

    function rentCar() public payable{

    }
    
    //function to cancelListings
    //function to withdrawAmount+
    // fine function
}
