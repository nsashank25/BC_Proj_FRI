// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PropertyToken.sol";

contract PropertyFactory {
    struct Property {
        address tokenAddress;
        string name;
        string symbol;
        uint256 totalSupply;
        address owner;
    }

    Property[] public properties;

    event PropertyCreated(address tokenAddress, address owner, string name, uint256 supply);

    function createProperty(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply
    ) external {
        PropertyToken token = new PropertyToken(_name, _symbol, _totalSupply, msg.sender);

        properties.push(Property({
            tokenAddress: address(token),
            name: _name,
            symbol: _symbol,
            totalSupply: _totalSupply,
            owner: msg.sender
        }));

        emit PropertyCreated(address(token), msg.sender, _name, _totalSupply);
    }

    function getAllProperties() external view returns (Property[] memory) {
        return properties;
    }
}
