// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./PropertyToken.sol";

contract PropertyManager {
    struct Property {
        string name;
        address tokenAddress;
        string metadataURI;
    }

    Property[] public properties;
    mapping(address => address[]) public ownerToTokens;

    event PropertyCreated(address token, string name, string metadataURI);

    function createProperty(
        string memory name,
        string memory symbol,
        uint256 supply,
        string memory metadataURI
    ) public {
        PropertyToken token = new PropertyToken(name, symbol, supply, msg.sender);

        properties.push(Property({
            name: name,
            tokenAddress: address(token),
            metadataURI: metadataURI
        }));

        ownerToTokens[msg.sender].push(address(token));
        emit PropertyCreated(address(token), name, metadataURI);
    }

    function getAllProperties() public view returns (Property[] memory) {
        return properties;
    }

    function getMyProperties(address owner) public view returns (address[] memory) {
        return ownerToTokens[owner];
    }
}
