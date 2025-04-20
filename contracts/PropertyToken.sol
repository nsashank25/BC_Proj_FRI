// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PropertyToken is ERC20, Ownable {
    // Array to keep track of all token holders
    address[] private _tokenHolders;
    // Mapping to check if an address is already in the _tokenHolders array
    mapping(address => bool) private _isTokenHolder;
    // Mapping to check if an address has any tokens
    mapping(address => bool) private _hasTokens;
    
    constructor(string memory name, string memory symbol, uint256 initialSupply, address owner)
        ERC20(name, symbol)
        Ownable(owner)
    {
        _mint(owner, initialSupply * (10 ** decimals()));
        // Add the owner to the token holders array
        _addTokenHolder(owner);
    }
    
    /**
     * @notice Override the _beforeTokenTransfer hook to update token holder tracking
     */
    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);
        
        // If transferring to a new address that isn't a token holder yet
        if (to != address(0) && !_isTokenHolder[to]) {
            _addTokenHolder(to);
        }
        
        // If a holder transfers all their tokens, mark them as not having tokens
        if (from != address(0) && balanceOf(from) == 0) {
            _hasTokens[from] = false;
        }
        
        // If a holder is receiving tokens, mark them as having tokens
        if (to != address(0) && balanceOf(to) > 0) {
            _hasTokens[to] = true;
        }
    }
    
    /**
     * @notice Add a new token holder to the tracking array
     * @param holder The address of the token holder to add
     */
    function _addTokenHolder(address holder) private {
        if (!_isTokenHolder[holder]) {
            _tokenHolders.push(holder);
            _isTokenHolder[holder] = true;
            _hasTokens[holder] = true;
        }
    }
    
    /**
     * @notice Returns all addresses that have ever held tokens
     * @return An array of all token holder addresses
     */
    function getAllTokenHolders() external view returns (address[] memory) {
        return _tokenHolders;
    }
    
    /**
     * @notice Returns all addresses that currently hold tokens
     * @return An array of current token holder addresses
     */
    function getCurrentTokenHolders() external view returns (address[] memory) {
        // Count current holders (those with balance > 0)
        uint256 currentHolderCount = 0;
        for (uint256 i = 0; i < _tokenHolders.length; i++) {
            if (_hasTokens[_tokenHolders[i]]) {
                currentHolderCount++;
            }
        }
        
        // Create array with exact size
        address[] memory currentHolders = new address[](currentHolderCount);
        uint256 index = 0;
        
        // Populate array
        for (uint256 i = 0; i < _tokenHolders.length; i++) {
            if (_hasTokens[_tokenHolders[i]]) {
                currentHolders[index] = _tokenHolders[i];
                index++;
            }
        }
        
        return currentHolders;
    }
}