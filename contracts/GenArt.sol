// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract GenArt {
    string public name = "GenArt Marketplace";
    uint256 public itemCounter = 0;

    struct Art {
        uint256 id;
        string metadataURI; // IPFS link
        address payable seller;
        address owner;
        uint256 price;
        bool isSold;
    }

    mapping(uint256 => Art) public items;

    event ArtListed(uint256 id, string uri, address seller, uint256 price);
    event ArtSold(uint256 id, address buyer, uint256 price);

    function listArt(string memory _uri, uint256 _price) public {
        require(_price > 0, "Price must be positive");
        itemCounter++;
        items[itemCounter] = Art(itemCounter, _uri, payable(msg.sender), msg.sender, _price, false);
        emit ArtListed(itemCounter, _uri, msg.sender, _price);
    }

    function buyArt(uint256 _id) public payable {
        Art storage art = items[_id];
        require(msg.value >= art.price, "Not enough ETH");
        require(!art.isSold, "Already sold");

        art.isSold = true;
        art.seller.transfer(msg.value);
        art.owner = msg.sender;

        emit ArtSold(_id, msg.sender, art.price);
    }
}