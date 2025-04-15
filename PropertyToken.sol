// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PropertyToken is ERC20 {
    address public propertyOwner;
    string public propertyName;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        address _owner
    ) ERC20(_name, _symbol) {
        propertyOwner = _owner;
        propertyName = _name;
        _mint(_owner, _totalSupply * 10 ** decimals());
    }
}

