//SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC4907.sol";

contract RentalCar is ERC4907, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    event CarTokenCreated(
        uint256 indexed tokenId,
        address indexed user,
        string indexed tokenURI
    );

    constructor(
        string memory _name,
        string memory _symbol
    ) ERC4907(_name, _symbol) {}

    function createNft(string memory _tokenURI) public returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(msg.sender, newItemId);
        _setTokenURI(newItemId, _tokenURI);
        emit CarTokenCreated(newItemId, msg.sender, _tokenURI);
        return newItemId;
    }

    function getTotalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }
}
