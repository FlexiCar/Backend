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
    uint256 private immutable s_fee;

    mapping(uint256 => Listing) private s_listings;
    mapping(address => uint256) private s_balances;
    mapping(address => mapping(address => uint256)) s_rentals;
    mapping(address => bool) public s_ownerStatus;
    mapping(address => bool) public s_borrowerStatus;
    mapping(uint256 => mapping(address => uint256)) s_fines;

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
    event finePaid(uint256 indexed _tokenId, address indexed borrower, uint256 fine);

    error NFT_ALERADY_LISTED();
    error NOT_THE_OWNER();
    error NOT_APPROVED_BY_OWNER();
    error PriceMustBeAboveZero();
    error CAR_NOT_LISTED();
    error CANNOT_RENT_FOR_THAT_MUCH_DAYS();
    error ALERADY_RENTED_TO_SOMEONE();
    error LISTING_IS_IN_RENTED_STATE();
    error ZERO_PROCEEDS(); 
    error CAR_NOT_RENTED_TO_CALLER();
    error ALERADY_TURNED_IN();
    error NOT_THE_BORROWER();
    error NOT_RENTED_YET();
    error NOT_TURNED_IN();

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

    constructor(address _nftAddress, uint256 _fee) {
        s_nftAddress = _nftAddress;
        s_fee = _fee;
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
        s_ownerStatus[listing.owner] = false;
        s_borrowerStatus[msg.sender] = false;
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

    function turnInByOwner(uint256 _tokenId) public isOwner(_tokenId,msg.sender) {
     IERC4907 _nft = IERC4907(s_nftAddress);
      
      if(s_ownerStatus[msg.sender] == true){
        revert ALERADY_TURNED_IN();
       }
      address borrower = _nft.userOf(_tokenId);

     if(borrower != address(0) && s_borrowerStatus[borrower] == true){
        uint256 amount = ((block.timestamp - s_rentals[msg.sender][borrower]) * s_fee)/3600;
        s_fines[_tokenId][borrower] = amount;
     }
     s_ownerStatus[msg.sender] = true;
    }
     
     function turnInByBorrower(uint256 _tokenId) public {
         IERC4907 _nft = IERC4907(s_nftAddress);

         if(_nft.userOf(_tokenId)  != msg.sender){
          revert NOT_THE_BORROWER();
         }

         if(s_borrowerStatus[msg.sender] == true){
            revert ALERADY_TURNED_IN();
         }

         address owner = _nft.ownerOf(_tokenId);

         if(s_ownerStatus[owner] == true){
            uint256 amount = ((block.timestamp - s_rentals[owner][msg.sender]) * s_fee)/3600;
            s_fines[_tokenId][msg.sender] = amount;
         }
         s_borrowerStatus[msg.sender] = true;

     }    

     function payFee(uint256 _tokenId) public payable{
       Listing storage listing = s_listings[_tokenId];
       IERC4907 _nft = IERC4907(s_nftAddress);
       address borrower = _nft.userOf(_tokenId);

       if(borrower != msg.sender){
        revert NOT_THE_BORROWER();
       }
       delete  s_fines[_tokenId][borrower];
       s_balances[_nft.ownerOf(_tokenId)] += msg.value;
       listing.status = Status.AVAILABLE;
       delete s_borrowerStatus [borrower];
       delete s_ownerStatus[_nft.ownerOf(_tokenId)];
       emit finePaid(_tokenId, msg.sender,msg.value);
     }

    function viewBalance() public view returns(uint256){
        return s_balances[msg.sender];
    }

    function getFine(uint256 _tokenId) public view returns(uint256){
        IERC4907 _nft = IERC4907(s_nftAddress);

        if(!s_ownerStatus[_nft.ownerOf(_tokenId)] || !s_borrowerStatus[_nft.userOf(_tokenId)]){
            revert NOT_TURNED_IN();
        }

        if(_nft.userOf(_tokenId) == address(0)){
            revert NOT_RENTED_YET();
        }

        if(s_ownerStatus[_nft.ownerOf(_tokenId)] && s_borrowerStatus[_nft.userOf(_tokenId)]){
             return s_fines[_tokenId][_nft.userOf(_tokenId)] ;
    }
        return 0;
    }

    function getListing(uint256 _tokenId) public view returns(Listing memory){
        return s_listings[_tokenId] ;
    }
    


}
