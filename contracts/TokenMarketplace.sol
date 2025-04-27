// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PropertyToken.sol";
import "hardhat/console.sol";

contract TokenMarketplace {
    struct TokenListing {
        address tokenAddress;
        address seller;
        uint256 pricePerToken; // Price in wei per token
        uint256 availableTokens;
        bool active;
    }

    mapping(address => mapping(address => TokenListing)) public listings;

    mapping(address => address[]) public sellersByToken;

    mapping(address => mapping(address => bool)) private isSellerTracked;

    address[] public listedTokens;
    mapping(address => bool) private tokenExists;

    event TokenListed(address indexed tokenAddress, address indexed seller, uint256 pricePerToken, uint256 amount);
    event ListingUpdated(address indexed tokenAddress, address indexed seller, uint256 pricePerToken, uint256 amount);
    event ListingCancelled(address indexed tokenAddress, address indexed seller);
    event TokensPurchased(
        address indexed tokenAddress,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 totalPrice
    );

    // List tokens for sale
    function listTokens(address tokenAddress, uint256 pricePerToken, uint256 amount) external {
        require(tokenAddress != address(0), "Invalid token address");
        require(pricePerToken > 0, "Price must be greater than 0");
        require(amount > 0, "Amount must be greater than 0");

        IERC20 token = IERC20(tokenAddress);

        // Check allowance
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= amount, "Not enough tokens approved for sale");

        // Check balance
        uint256 balance = token.balanceOf(msg.sender);
        require(balance >= amount, "Not enough tokens in your wallet");

        if (!isSellerTracked[tokenAddress][msg.sender]) {
            sellersByToken[tokenAddress].push(msg.sender);
            isSellerTracked[tokenAddress][msg.sender] = true;
        }
        if (!tokenExists[tokenAddress]) {
            listedTokens.push(tokenAddress);
            tokenExists[tokenAddress] = true;
        }

        // Update or create listing (ensure it's marked active)
        listings[tokenAddress][msg.sender] = TokenListing({
            tokenAddress: tokenAddress,
            seller: msg.sender,
            pricePerToken: pricePerToken,
            availableTokens: amount,
            active: true // Set active on new/updated listing
        });

        emit TokenListed(tokenAddress, msg.sender, pricePerToken, amount);
    }

    // Update token listing
    function updateListing(address tokenAddress, uint256 newPricePerToken, uint256 newAmount) external {
        if (!isSellerTracked[tokenAddress][msg.sender]) {
             sellersByToken[tokenAddress].push(msg.sender);
             isSellerTracked[tokenAddress][msg.sender] = true;
        }

        TokenListing storage listing = listings[tokenAddress][msg.sender];
        require(listing.active, "No active listing found to update"); // Check active before requiring seller match
        require(listing.seller == msg.sender, "Not the seller");

        IERC20 token = IERC20(tokenAddress);

        if (newAmount > listing.availableTokens) {
             uint256 currentAllowance = token.allowance(msg.sender, address(this));
             require(currentAllowance >= newAmount, "Insufficient total allowance for new amount");

             uint256 additionalAmount = newAmount - listing.availableTokens;
             uint256 balance = token.balanceOf(msg.sender);
             require(balance >= newAmount, "Insufficient balance for new listing amount");
        } else if (newAmount == 0) {
            listing.active = false;
        }


        // Update listing
        listings[tokenAddress][msg.sender].pricePerToken = newPricePerToken;
        listings[tokenAddress][msg.sender].availableTokens = newAmount;
        listings[tokenAddress][msg.sender].active = (newAmount > 0); // Ensure active is true only if amount > 0

        emit ListingUpdated(tokenAddress, msg.sender, newPricePerToken, newAmount);
    }

    // Cancel a listing
    function cancelListing(address tokenAddress) external {
        TokenListing storage listing = listings[tokenAddress][msg.sender];
        require(listing.active, "No active listing found");
        require(listing.seller == msg.sender, "Not the seller");

        listing.active = false;
        listing.availableTokens = 0;

        emit ListingCancelled(tokenAddress, msg.sender);
    }

    function buyTokens(address tokenAddress, address seller, uint256 amount) external payable {
        TokenListing storage listing = listings[tokenAddress][seller];
        require(listing.active, "Listing is not active");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= listing.availableTokens, "Not enough tokens available in listing");

        PropertyToken token = PropertyToken(tokenAddress);
        uint8 decimals = token.decimals();
        console.log("Contract buyTokens - Token Decimals:", decimals);

        uint256 decimalFactor = 10**decimals;
        require(decimalFactor > 0, "Decimal factor cannot be zero");
        uint256 totalPrice = (listing.pricePerToken * amount) / decimalFactor;
        console.log("Contract buyTokens - Calculated Total Price (WEI):", totalPrice);
        console.log("Contract buyTokens - Received msg.value (WEI):", msg.value);

        require(msg.value >= totalPrice, "Insufficient funds sent");

        console.log("Checking seller balance and allowance before transferFrom:");
        uint256 sellerBalance = token.balanceOf(seller);
        uint256 marketplaceAllowance = token.allowance(seller, address(this));
        console.log("   Seller Balance:", sellerBalance);
        console.log("   Marketplace Allowance:", marketplaceAllowance);
        console.log("   Amount to transfer:", amount);

        bool success = token.transferFrom(seller, msg.sender, amount);
        require(success, "Token transfer failed");
        console.log("Contract buyTokens - Token transfer successful.");

        listing.availableTokens -= amount;
        if (listing.availableTokens == 0) {
            listing.active = false;
            console.log("Contract buyTokens - Listing deactivated (sold out).");
        } else {
             console.log("Contract buyTokens - Listing updated. Remaining available:", listing.availableTokens);
        }

        (bool sent, ) = payable(seller).call{value: totalPrice}("");
        require(sent, "Failed to send ETH to seller");
        console.log("Contract buyTokens - ETH sent to seller successfully.");

        uint256 excess = msg.value - totalPrice;
        if (excess > 0) {
            console.log("Contract buyTokens - Refunding excess ETH:", excess);
            (sent, ) = payable(msg.sender).call{value: excess}("");
             if (!sent) {
                  console.log("Warning: Failed to refund excess ETH to buyer.");
             }
        }

        emit TokensPurchased(tokenAddress, msg.sender, seller, amount, totalPrice);
    }

    // Get all token addresses that have ever been listed
    function getAllListedTokens() external view returns (address[] memory) {
        return listedTokens;
    }

    // Get listing for a specific token and seller (remains the same)
    function getListing(address tokenAddress, address seller) external view returns (
        address, address, uint256, uint256, bool
    ) {
        TokenListing storage listing = listings[tokenAddress][seller];
        return (
            listing.tokenAddress,
            listing.seller,
            listing.pricePerToken,
            listing.availableTokens,
            listing.active
        );
    }

    // Check if a token has ever been listed by any seller (remains the same)
    function isTokenListed(address tokenAddress) external view returns (bool) {
        return tokenExists[tokenAddress];
    }


    function getActiveListingsForToken(address _tokenAddress) external view returns (TokenListing[] memory) {
        // Get the list of sellers who have listed this token at some point
        address[] storage sellers = sellersByToken[_tokenAddress];
        uint sellerCount = sellers.length;

        // Count how many listings are currently active
        uint activeCount = 0;
        for (uint i = 0; i < sellerCount; i++) {
            // Check the 'active' flag directly from the main listings mapping
            if (listings[_tokenAddress][sellers[i]].active) {
                activeCount++;
            }
        }

        // Create the result array with the exact size
        TokenListing[] memory activeListings = new TokenListing[](activeCount);
        uint currentIndex = 0;
        for (uint i = 0; i < sellerCount; i++) {
            address currentSeller = sellers[i];
            // Fetch the listing again and check 'active' flag before adding
            if (listings[_tokenAddress][currentSeller].active) {
                activeListings[currentIndex] = listings[_tokenAddress][currentSeller];
                currentIndex++;
            }
        }

        return activeListings;
    }

}