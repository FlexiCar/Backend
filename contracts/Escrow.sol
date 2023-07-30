//SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "./interfaces/IERC4907.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Escrow is Ownable {
    enum Status {
        RENTED,
        AVAILABLE
    }

    struct Listing {
        uint256 hourlyPrice;
        uint256 maxDays;
        address owner;
        uint256 advanceTime; // in seconds
        Status status;
    }

    address private immutable s_nftAddress;

    mapping(uint256 => Listing) private s_listings;
    mapping(address => uint256) s_balances;
    mapping(address => mapping(address => uint256)) s_rentals;

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price,
        uint256 advanceTime
    );

    event rentedItem(
        uint256 indexed _tokenId,
        address rentedUser,
        uint256 expiryTime
    );

    event updatedListing(
        uint256 tokenId,
        uint256 price,
        uint256 maxDays,
        uint256 advanceTime,
        address owner
    );

    event carDelisted(uint256 indexed _tokenId, address indexed owner);

    error NFT_ALERADY_LISTED();
    error NOT_THE_OWNER();
    error NOT_APPROVED_BY_OWNER();
    error PriceMustBeAboveZero();
    error CAR_NOT_LISTED();
    error CANNOT_RENT_FOR_THAT_MUCH_DAYS();
    error ALERADY_RENTED_TO_SOMEONE();
    error LISTING_IS_IN_RENTED_STATE();
    error ZERO_PROCEEDS(); 

    modifier notListed(uint256 tokenId) {
        Listing memory listing = s_listings[tokenId];
        if (listing.hourlyPrice > 0) {
            revert NFT_ALERADY_LISTED();
        }
        _;
    }

    modifier isOwner(uint256 tokenId, address spender) {
        IERC4907 _nft = IERC4907(s_nftAddress);
        address owner = _nft.ownerOf(tokenId);
        if (owner != spender) {
            revert NOT_THE_OWNER();
        }
        _;
    }

    modifier isListed(uint256 _tokenId) {
        Listing memory listing = s_listings[_tokenId];
        if (listing.hourlyPrice == 0) {
            revert CAR_NOT_LISTED();
        }
        _;
    }

    modifier inTimeLimits(uint256 _tokenId, uint256 _expiry) {
        /*TO check whether the expiry time by user in unix is less than or equal to block.timestamp + advancedTime */
        Listing memory listing = s_listings[_tokenId];
        uint256 extraTime = block.timestamp + listing.advanceTime;
        if (extraTime > _expiry) {
            revert CANNOT_RENT_FOR_THAT_MUCH_DAYS();
        }
        _;
    }

    constructor(address _nftAddress) {
        s_nftAddress = _nftAddress;
    }

    function listCar(
        uint256 _tokenId,
        uint256 _price,
        uint256 _maxDays,
        uint256 _advanceTime
    ) public notListed(_tokenId) isOwner(_tokenId, msg.sender) {
        if (_price <= 0) {
            revert PriceMustBeAboveZero();
        }
        IERC4907 _nft = IERC4907(s_nftAddress);
        if (_nft.getApproved(_tokenId) != address(this)) {
            revert NOT_APPROVED_BY_OWNER();
        }
        Listing memory listing = Listing({
            hourlyPrice: _price,
            maxDays: _maxDays,
            owner: msg.sender,
            advanceTime: _advanceTime,
            status: Status.AVAILABLE
        });
        s_listings[_tokenId] = listing;
        emit ItemListed(
            msg.sender,
            s_nftAddress,
            _tokenId,
            _price,
            _advanceTime
        );
    }

    function rentCar(
        uint256 _tokenId,
        uint256 _expiryTime
    ) public payable isListed(_tokenId) inTimeLimits(_tokenId, _expiryTime) {
        /*we have to rent the nft to user */
        // first check the car is alerady rented or not
        IERC4907 _nft = IERC4907(s_nftAddress);
        address rentalUser = _nft.userOf(_tokenId);
        Listing storage listing = s_listings[_tokenId];
        Status _status = listing.status;
        if (rentalUser != address(0) || _status == Status.RENTED) {
            revert ALERADY_RENTED_TO_SOMEONE();
        }
        // First fetch the lisiting
        _nft.setUser(_tokenId, msg.sender, _expiryTime);
        s_rentals[listing.owner][msg.sender] = block.timestamp;
        listing.status = Status.RENTED;
        emit rentedItem(_tokenId, msg.sender, _expiryTime);
        // update the balances for the nft owner
        s_balances[listing.owner] += msg.value;
    }

    //function to cancelListings
    function cancelListing(
        uint256 _tokenId
    ) public isOwner(_tokenId, msg.sender) {
        Listing memory listing = s_listings[_tokenId];
        if (listing.status == Status.RENTED) {
            revert LISTING_IS_IN_RENTED_STATE();
        }
        delete s_listings[_tokenId];
        emit carDelisted(_tokenId, msg.sender);
    }

    function updateListing(
        uint256 _tokenId,
        uint256 _price,
        uint256 _maxDays,
        uint256 _advanceTime
    ) public isListed(_tokenId) isOwner(_tokenId, msg.sender) {
         if (_price <= 0) {
            revert PriceMustBeAboveZero();
        }

        Listing storage listing = s_listings[_tokenId];
        
         if (listing.status == Status.RENTED) {
            revert LISTING_IS_IN_RENTED_STATE();
        }
        listing.hourlyPrice = _price;
        listing.maxDays = _maxDays;
        listing.advanceTime = _advanceTime;

        emit updatedListing(_tokenId, _price, _maxDays, _advanceTime, msg.sender);
    }
    //function to withdrawAmount+

    function withdraw() public {
      if(s_balances[msg.sender] == 0){
        revert ZERO_PROCEEDS();
      }
      uint256 amount = s_balances[msg.sender];
      s_balances[msg.sender] = 0;
      (bool success,) = payable(msg.sender).call{value : amount}("");
      require(success, "Else transaction failed");
    }
    // fine function
}
