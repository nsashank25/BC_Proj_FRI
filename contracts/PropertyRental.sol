// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./PropertyManager.sol";
import "./PropertyToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PropertyRental {
    struct RentalListing {
        address propertyTokenAddress;
        uint256 weeklyRate; // Weekly rate in wei
        bool isActive;
        uint256 lastRentedTime; // Timestamp when property was last rented
        uint256 rentalDuration; // Duration in seconds (15 seconds for demo purposes)
    }
    
    // Mapping: property token address => rental listing
    mapping(address => RentalListing) public rentalListings;
    // Array to keep track of all property tokens listed for rent
    address[] public listedProperties;
    // Mapping to check if a property is already in the listedProperties array
    mapping(address => bool) private propertyListed;
    
    PropertyManager public propertyManager;
    
    // Events
    event PropertyListedForRent(address indexed propertyTokenAddress, uint256 weeklyRate);
    event RentalListingUpdated(address indexed propertyTokenAddress, uint256 newWeeklyRate);
    event RentalListingCancelled(address indexed propertyTokenAddress);
    event PropertyRented(address indexed propertyTokenAddress, address indexed renter, uint256 amount);
    event RentDistributed(address indexed propertyTokenAddress, uint256 totalRent, uint256 tokenHolderCount);
    
    constructor(address _propertyManagerAddress) {
        propertyManager = PropertyManager(_propertyManagerAddress);
    }
    
    /**
     * @notice Lists a property for rent
     * @param propertyTokenAddress The address of the property token
     * @param weeklyRate The weekly rental rate in wei
     */
    function listPropertyForRent(address propertyTokenAddress, uint256 weeklyRate) external {
        require(weeklyRate > 0, "Rental rate must be greater than 0");
        
        // Verify the property token exists in PropertyManager
        bool propertyFound = false;
        PropertyManager.Property[] memory allProperties = propertyManager.getAllProperties();
        
        for (uint i = 0; i < allProperties.length; i++) {
            if (allProperties[i].tokenAddress == propertyTokenAddress) {
                propertyFound = true;
                break;
            }
        }
        require(propertyFound, "Property not found in PropertyManager");
        
        // Check if caller owns any tokens of this property (assuming they need at least some ownership)
        PropertyToken token = PropertyToken(propertyTokenAddress);
        require(token.balanceOf(msg.sender) > 0, "You must own tokens of this property to list it for rent");
        
        // Create or update the rental listing
        rentalListings[propertyTokenAddress] = RentalListing({
            propertyTokenAddress: propertyTokenAddress,
            weeklyRate: weeklyRate,
            isActive: true,
            lastRentedTime: 0,
            rentalDuration: 15 seconds // 15 seconds for demo purposes
        });
        
        // Add to listedProperties array if not already there
        if (!propertyListed[propertyTokenAddress]) {
            listedProperties.push(propertyTokenAddress);
            propertyListed[propertyTokenAddress] = true;
        }
        
        emit PropertyListedForRent(propertyTokenAddress, weeklyRate);
    }
    
    /**
     * @notice Updates an existing rental listing
     * @param propertyTokenAddress The address of the property token
     * @param newWeeklyRate The new weekly rental rate in wei
     */
    function updateRentalListing(address propertyTokenAddress, uint256 newWeeklyRate) external {
        require(newWeeklyRate > 0, "Rental rate must be greater than 0");
        
        RentalListing storage listing = rentalListings[propertyTokenAddress];
        require(listing.isActive, "No active rental listing found for this property");
        
        // Check if caller owns any tokens of this property
        PropertyToken token = PropertyToken(propertyTokenAddress);
        require(token.balanceOf(msg.sender) > 0, "You must own tokens of this property to update the listing");
        
        // Update the listing
        listing.weeklyRate = newWeeklyRate;
        
        emit RentalListingUpdated(propertyTokenAddress, newWeeklyRate);
    }
    
    /**
     * @notice Cancels a rental listing
     * @param propertyTokenAddress The address of the property token
     */
    function cancelRentalListing(address propertyTokenAddress) external {
        RentalListing storage listing = rentalListings[propertyTokenAddress];
        require(listing.isActive, "No active rental listing found for this property");
        
        // Check if caller owns any tokens of this property
        PropertyToken token = PropertyToken(propertyTokenAddress);
        require(token.balanceOf(msg.sender) > 0, "You must own tokens of this property to cancel the listing");
        
        // Cancel the listing
        listing.isActive = false;
        
        emit RentalListingCancelled(propertyTokenAddress);
    }
    
    /**
     * @notice Rents a property for a week (15 seconds in demo)
     * @param propertyTokenAddress The address of the property token
     */
    function rentProperty(address propertyTokenAddress) external payable {
        RentalListing storage listing = rentalListings[propertyTokenAddress];
        require(listing.isActive, "Property is not actively listed for rent");
        
        // Check if the property is currently rented
        bool isRented = listing.lastRentedTime > 0 && 
                       (block.timestamp - listing.lastRentedTime) < listing.rentalDuration;
        require(!isRented, "Property is currently rented");
        
        // Verify payment amount
        require(msg.value >= listing.weeklyRate, "Insufficient payment for rental");
        
        // Update rental status
        listing.lastRentedTime = block.timestamp;
        
        // Distribute rent to token holders
        distributeRent(propertyTokenAddress, msg.value);
        
        emit PropertyRented(propertyTokenAddress, msg.sender, msg.value);
    }
    
    /**
     * @notice Distributes rent proportionally to all token holders
     * @param propertyTokenAddress The address of the property token
     * @param rentAmount The amount of rent to distribute
     */
    function distributeRent(address propertyTokenAddress, uint256 rentAmount) private {
        PropertyToken token = PropertyToken(propertyTokenAddress);
        uint256 totalSupply = token.totalSupply();
        require(totalSupply > 0, "Total supply of tokens cannot be zero");
        
        // Get all current token holders using the new function
        address[] memory tokenHolders = token.getCurrentTokenHolders();
        require(tokenHolders.length > 0, "No token holders found to distribute rent to");
        
        uint256 totalDistributed = 0;
        uint256 remainingRent = rentAmount;
        
        // Distribute proportionally based on token ownership
        for (uint i = 0; i < tokenHolders.length; i++) {
            address holder = tokenHolders[i];
            uint256 holderBalance = token.balanceOf(holder);
            
            if (holderBalance > 0) {
                // Calculate holder's share of the rent
                uint256 share = (rentAmount * holderBalance) / totalSupply;
                
                // Make sure we don't distribute more than the rent amount due to rounding
                if (totalDistributed + share > rentAmount) {
                    share = rentAmount - totalDistributed;
                }
                
                // Transfer ETH to token holder
                if (share > 0) {
                    (bool sent, ) = payable(holder).call{value: share}("");
                    if (sent) {
                        totalDistributed += share;
                        remainingRent -= share;
                    }
                }
            }
        }
        
        // If there's any remaining rent due to rounding errors, send it to the first token holder
        if (remainingRent > 0 && tokenHolders.length > 0) {
            (bool sent, ) = payable(tokenHolders[0]).call{value: remainingRent}("");
            if (sent) {
                totalDistributed += remainingRent;
            }
        }
        
        emit RentDistributed(propertyTokenAddress, totalDistributed, tokenHolders.length);
    }
    
    /**
     * @notice Checks if a property is currently rented
     * @param propertyTokenAddress The address of the property token
     * @return bool True if the property is currently rented, false otherwise
     */
    function isPropertyRented(address propertyTokenAddress) public view returns (bool) {
        RentalListing storage listing = rentalListings[propertyTokenAddress];
        
        if (!listing.isActive) return false;
        
        return listing.lastRentedTime > 0 && 
               (block.timestamp - listing.lastRentedTime) < listing.rentalDuration;
    }
    
    /**
     * @notice Returns time remaining until a property's rental period ends
     * @param propertyTokenAddress The address of the property token
     * @return uint256 Time remaining in seconds, 0 if not rented
     */
    function getRentalTimeRemaining(address propertyTokenAddress) public view returns (uint256) {
        RentalListing storage listing = rentalListings[propertyTokenAddress];
        
        if (!listing.isActive || listing.lastRentedTime == 0) return 0;
        
        uint256 elapsedTime = block.timestamp - listing.lastRentedTime;
        if (elapsedTime >= listing.rentalDuration) return 0;
        
        return listing.rentalDuration - elapsedTime;
    }
    
    /**
     * @notice Gets all property tokens listed for rent
     * @return All property tokens that have ever been listed for rent
     */
    function getAllListedProperties() external view returns (address[] memory) {
        return listedProperties;
    }
    
    /**
     * @notice Gets all currently active rental listings
     * @return An array of RentalListing structs that are currently active
     */
    function getActiveRentalListings() external view returns (RentalListing[] memory) {
        // Count active listings
        uint256 activeCount = 0;
        for (uint i = 0; i < listedProperties.length; i++) {
            if (rentalListings[listedProperties[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create result array
        RentalListing[] memory activeListings = new RentalListing[](activeCount);
        uint256 index = 0;
        
        // Populate result array
        for (uint i = 0; i < listedProperties.length; i++) {
            address propertyAddress = listedProperties[i];
            if (rentalListings[propertyAddress].isActive) {
                activeListings[index] = rentalListings[propertyAddress];
                index++;
            }
        }
        
        return activeListings;
    }
}