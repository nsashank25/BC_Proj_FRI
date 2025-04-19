// src/components/Marketplace.js

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import PropertyManagerABI from "../contracts/PropertyManager.json";
import PropertyTokenABI from "../contracts/PropertyToken.json";
import TokenMarketplaceABI from "../contracts/TokenMarketplace.json";
import { PROPERTY_MANAGER_ADDRESS, TOKEN_MARKETPLACE_ADDRESS } from "../utils/config";
import './Marketplace.css';

export default function Marketplace() {
  const [contract, setContract] = useState(null);
  const [marketplaceContract, setMarketplaceContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [allProperties, setAllProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyDetails, setPropertyDetails] = useState(null);
  const [listings, setListings] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // For buying tokens
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyAmount, setBuyAmount] = useState(1);
  const [price, setPrice] = useState(0);
  const [sellerAddress, setSellerAddress] = useState("");

  // For selling tokens
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellAmount, setSellAmount] = useState(1);
  const [sellPrice, setSellPrice] = useState(0.01);

  const [approvalAmount, setApprovalAmount] = useState(""); // Amount user wants to approve
  const [isApproving, setIsApproving] = useState(false); // Loading state for approval button
  const [approvalStatus, setApprovalStatus] = useState(""); // Feedback message for approval

  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const signer = await provider.getSigner();
        
        // Property Manager contract
        const managerContract = new ethers.Contract(
          PROPERTY_MANAGER_ADDRESS,
          PropertyManagerABI.abi,
          signer
        );
        
        // Marketplace contract
        const marketplace = new ethers.Contract(
          TOKEN_MARKETPLACE_ADDRESS,
          TokenMarketplaceABI.abi,
          signer
        );
        
        const address = await signer.getAddress();
        
        setSigner(signer);
        setAccount(address);
        setContract(managerContract);
        setMarketplaceContract(marketplace);
        setIsConnected(true);
        
        window.ethereum.on("accountsChanged", handleAccountsChanged);
      } else {
        alert("MetaMask is not installed. Please install it to use this marketplace.");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      setIsConnected(false);
      setAccount("");
      setSigner(null);
    } else {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setSigner(signer);
      setAccount(address);
      
      const managerContract = new ethers.Contract(
        PROPERTY_MANAGER_ADDRESS,
        PropertyManagerABI.abi,
        signer
      );
      setContract(managerContract);
      
      const marketplace = new ethers.Contract(
        TOKEN_MARKETPLACE_ADDRESS,
        TokenMarketplaceABI.abi,
        signer
      );
      setMarketplaceContract(marketplace);
      
      // Reset UI
      setShowBuyModal(false);
      setShowSellModal(false);
      
      // Reload data if property is selected
      if (selectedProperty) {
        loadPropertyDetails(selectedProperty);
      }
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" })
        .then(accounts => {
          if (accounts.length > 0) {
            connectWallet();
          }
        });
      
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        }
      };
    }
  }, []);

  const loadAllProperties = async () => {
    if (!contract) return;
    
    try {
      setIsLoading(true);
      const properties = await contract.getAllProperties();
      console.log("All marketplace properties:", properties);
      setAllProperties(properties);
      
      // Load listings if marketplace contract is available
      if (marketplaceContract) {
        loadAllListings(properties);
      }
    } catch (error) {
      console.error("Error loading all properties:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadAllListings = async (properties) => {
    try {
      const listingsData = {};
      
      for (const property of properties) {
        // Check if token is listed in marketplace
        const isListed = await marketplaceContract.isTokenListed(property.tokenAddress);
        
        if (isListed) {
          // Get the owner of the property
          const tokenContract = new ethers.Contract(
            property.tokenAddress,
            PropertyTokenABI.abi,
            signer
          );
          const owner = await tokenContract.owner();
          
          // Check for active listing from the owner
          try {
            const listing = await marketplaceContract.getListing(property.tokenAddress, owner);
            
            if (listing[4]) { // If active
              listingsData[property.tokenAddress] = {
                seller: listing[1],
                pricePerToken: listing[2],
                availableTokens: listing[3],
                active: listing[4]
              };
            }
          } catch (err) {
            console.log(`No active listing for ${property.name}`);
          }
        }
      }
      
      console.log("Listings data:", listingsData);
      setListings(listingsData);
    } catch (error) {
      console.error("Error loading listings:", error);
    }
  };

  const loadPropertyDetails = async (property) => {
    if (!signer) return;
    
    try {
      setIsLoading(true);
      setSelectedProperty(property);
      
      // Create contract instance for the token
      const tokenContract = new ethers.Contract(
        property.tokenAddress,
        PropertyTokenABI.abi,
        signer
      );
      
      // Get token details
      const symbol = await tokenContract.symbol();
      const decimals = await tokenContract.decimals();
      const totalSupply = await tokenContract.totalSupply();
      const formattedSupply = ethers.formatUnits(totalSupply, decimals);
      
      // Get owner balance if connected
      let myBalance = "0";
      if (account) {
        const balance = await tokenContract.balanceOf(account);
        myBalance = ethers.formatUnits(balance, decimals);
      }
      
      // Get token owner (creator)
      const owner = await tokenContract.owner();
      
      // Check if this token has an active listing
      let listing = null;
      if (marketplaceContract) {
        try {
          // Check if token is listed at all first
          const isListed = await marketplaceContract.isTokenListed(property.tokenAddress);
          
          if (isListed) {
            // Try to get listing from owner first
            try {
              const listingData = await marketplaceContract.getListing(property.tokenAddress, owner);
              if (listingData[4]) { // if active
                listing = {
                  seller: listingData[1],
                  pricePerToken: listingData[2],
                  availableTokens: listingData[3],
                  active: listingData[4]
                };
              }
            } catch (err) {
              console.log("No active listing from owner");
            }
            
            // If no listing from owner, try to find other sellers
            if (!listing) {
              // This would require a new function in the smart contract to get all sellers for a token
              // Since we don't have that, we'll stick with the owner listing for now
              console.log("Could check for other sellers here if contract supported it");
            }
          }
        } catch (err) {
          console.log("Error checking listing status:", err);
        }
      }
      
      const details = {
        name: property.name,
        symbol,
        tokenAddress: property.tokenAddress,
        metadataURI: property.metadataURI,
        totalSupply: formattedSupply,
        decimals,
        myBalance,
        owner,
        listing
      };
      
      console.log("Property details:", details);
      setPropertyDetails(details);
      
      // If there's a listing, set up the buy form
      if (details.listing) {
        setPrice(ethers.formatEther(details.listing.pricePerToken));
        setSellerAddress(details.listing.seller);
      }
    } catch (error) {
      console.error("Error loading property details:", error);
      setPropertyDetails(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Updated handleBuyTokens function
  // --- REVISED Buy Tokens Function ---
// const handleBuyTokens = async () => {
//     // Check necessary conditions
//     if (!marketplaceContract || !signer || !account || !selectedProperty || !propertyDetails || !propertyDetails.listing) {
//          alert("Cannot proceed with purchase. Ensure wallet is connected, property is selected, and listing details are available.");
//          return;
//      }

//     // Get listing details
//     const listing = propertyDetails.listing;
//     const tokenAddress = selectedProperty.tokenAddress;
//     const seller = listing.seller; // Seller address from the listing
//     const decimals = propertyDetails.decimals; // Token decimals
//     const pricePerWholeTokenWei = listing.pricePerToken; // Price per WHOLE token in WEI (BigNumber/BigInt)
//     const availableTokensSmallestUnit = listing.availableTokens; // Available amount in SMALLEST unit (BigNumber/BigInt)

//     // Get buyer's input amount (number of WHOLE tokens)
//     const amountStringToBuy = buyAmount; // From the modal's state input
//     let amountToBuyWholeTokens;

//     // Validate buyer's input
//     try {
//         amountToBuyWholeTokens = parseInt(amountStringToBuy); // Basic check if it's a number
//         if (isNaN(amountToBuyWholeTokens) || amountToBuyWholeTokens <= 0) {
//             alert("Please enter a valid positive number of tokens to buy.");
//             return;
//         }
//     } catch (e) {
//         alert("Invalid amount entered.");
//         return;
//     }

//     // Convert amount to buy into smallest unit
//     const amountToBuySmallestUnit = ethers.parseUnits(amountStringToBuy, decimals);

//     // --- Bounds Checking ---
//     // Check if requesting more than available (compare smallest units)
//     // Use .gt() for BigNumber/BigInt comparison (greater than)
//     if (amountToBuySmallestUnit > availableTokensSmallestUnit) {
//          alert(`You cannot buy more than the available ${ethers.formatUnits(availableTokensSmallestUnit, decimals)} tokens.`);
//          return;
//     }
//     // --- End Bounds Checking ---

//     // --- Calculate Total Cost ---
//     // Total Cost (WEI) = (Number of WHOLE tokens to buy) * (Price per WHOLE token in WEI)
//     const totalCostWei = pricePerWholeTokenWei * BigInt(amountToBuyWholeTokens); // Use BigInt for multiplication
//     console.log(`Buying ${amountStringToBuy} tokens (${amountToBuySmallestUnit.toString()} units)`);
//     console.log(`Price per WHOLE token (WEI): ${pricePerWholeTokenWei.toString()}`);
//     console.log(`Calculated Total Cost (WEI): ${totalCostWei.toString()} (${ethers.formatEther(totalCostWei)} ETH)`);
//     // --- End Calculate Total Cost ---


//     setIsLoading(true); // Use modal's loading state
//     console.log(`Executing buyTokens(${tokenAddress}, ${seller}, ${amountToBuySmallestUnit.toString()}) with value ${totalCostWei.toString()}`);

//     try {
//         // Call the buy function with amount in SMALLEST units and calculated total cost
//         const tx = await marketplaceContract.connect(signer).buyTokens(
//             tokenAddress,
//             seller,
//             amountToBuySmallestUnit, // Pass amount in smallest units
//             { value: totalCostWei }    // Send the calculated ETH value in WEI
//         );

//         console.log("Buy transaction sent:", tx.hash);
//         alert("Buy transaction sent! Waiting for confirmation..."); // Give feedback

//         // Wait for transaction to be mined
//         await tx.wait();
//         console.log("Buy transaction confirmed!");

//         alert(`Successfully purchased ${amountStringToBuy} tokens!`);

//         // Close modal and refresh data
//         setShowBuyModal(false);
//         setBuyAmount(1); // Reset buy amount
//         // Reload details for the currently selected property
//         loadPropertyDetails(selectedProperty);
//         // Also refresh the main listings in case availability changed
//         loadAllProperties();


//     } catch (error) {
//         console.error("Error buying tokens:", error);
//         const errorMsg = error.reason || error.message || "Failed to buy tokens.";
//         // Provide more specific error information (keep your existing revert checks)
//         if (error.message.includes("execution reverted")) {
//             // ... existing revert reason checks ...
//             alert(`Transaction Failed: ${errorMsg}`);
//         } else {
//             alert(`Failed to buy tokens: ${errorMsg}`);
//         }
//     } finally {
//         setIsLoading(false); // Use modal's loading state
//     }
// };


// const handleBuyTokens = async () => {
//     if (!marketplaceContract || !signer || !account || !selectedProperty || !propertyDetails || !propertyDetails.listing) {
//         alert("Cannot proceed with purchase. Please check your connection.");
//         return;
//     }

//     // Get listing details
//     const tokenAddress = selectedProperty.tokenAddress;
//     const seller = propertyDetails.listing.seller;
//     const decimals = propertyDetails.decimals;
    
//     // Validate input amount
//     const amountToBuy = parseInt(buyAmount);
//     if (isNaN(amountToBuy) || amountToBuy <= 0) {
//         alert("Please enter a valid positive number of tokens to buy.");
//         return;
//     }

//     // Convert to token's smallest unit
//     const amountInSmallestUnit = ethers.parseUnits(buyAmount.toString(), decimals);
    
//     // Verify if amount is available
//     if (amountInSmallestUnit > propertyDetails.listing.availableTokens) {
//         alert(`You cannot buy more than the available ${ethers.formatUnits(propertyDetails.listing.availableTokens, decimals)} tokens.`);
//         return;
//     }

//     // Calculate total cost
//     const pricePerToken = propertyDetails.listing.pricePerToken;
//     const totalCostWei = pricePerToken * BigInt(amountToBuy);
    
//     console.log(`Buying ${buyAmount} tokens at ${ethers.formatEther(pricePerToken)} ETH each`);
//     console.log(`Total cost: ${ethers.formatEther(totalCostWei)} ETH`);
    
//     setIsLoading(true);
    
//     try {
//         const tx = await marketplaceContract.buyTokens(
//             tokenAddress,
//             seller,
//             amountInSmallestUnit,
//             { value: totalCostWei }
//         );
        
//         console.log("Transaction sent:", tx.hash);
//         alert("Purchase transaction sent! Waiting for confirmation...");
        
//         await tx.wait();
//         alert(`Successfully purchased ${buyAmount} tokens!`);
        
//         // Reset UI and refresh data
//         setShowBuyModal(false);
//         setBuyAmount(1);
//         loadPropertyDetails(selectedProperty);
//         loadAllProperties();
//     } catch (error) {
//         console.error("Error buying tokens:", error);
//         alert(`Failed to buy tokens: ${error.message || "Unknown error"}`);
//     } finally {
//         setIsLoading(false);
//     }
// };

// const handleBuyTokens = async () => {
//     if (!marketplaceContract || !signer || !account || !selectedProperty || !propertyDetails || !propertyDetails.listing) {
//         alert("Cannot proceed with purchase. Please check your connection.");
//         return;
//     }

//     // Get listing details
//     const tokenAddress = selectedProperty.tokenAddress;
//     const seller = propertyDetails.listing.seller;
//     const decimals = propertyDetails.decimals;
    
//     // Validate input amount
//     const amountToBuy = parseInt(buyAmount);
//     if (isNaN(amountToBuy) || amountToBuy <= 0) {
//         alert("Please enter a valid positive number of tokens to buy.");
//         return;
//     }

//     // Convert to token's smallest unit
//     const amountInSmallestUnit = ethers.parseUnits(buyAmount.toString(), decimals);
    
//     // Verify if amount is available
//     if (amountInSmallestUnit > propertyDetails.listing.availableTokens) {
//         alert(`You cannot buy more than the available ${ethers.formatUnits(propertyDetails.listing.availableTokens, decimals)} tokens.`);
//         return;
//     }

//     // Calculate total cost
//     const pricePerToken = propertyDetails.listing.pricePerToken;
    
//     // DEBUGGING LOGS - ADD THESE
//     console.log("Price per token (raw):", pricePerToken.toString());
//     console.log("Amount to buy:", amountToBuy);
    
//     // FIX: Make sure to convert amount properly before multiplication
//     const totalCostWei = pricePerToken * BigInt(amountToBuy);
    
//     // ADD MORE DEBUGGING
//     console.log("Total cost (wei):", totalCostWei.toString());
//     console.log("Total cost (ETH):", ethers.formatEther(totalCostWei));
    
//     // Send at least 10% more ETH to cover any potential calculation issues
//     const bufferAmount = totalCostWei * BigInt(11) / BigInt(10);
//     console.log("Sending with buffer:", ethers.formatEther(bufferAmount));
    
//     setIsLoading(true);
    
//     try {
//         const tx = await marketplaceContract.buyTokens(
//             tokenAddress,
//             seller,
//             amountInSmallestUnit,
//             // FIX: Send with a buffer to ensure enough ETH is provided
//             { value: bufferAmount }
//         );
        
//         console.log("Transaction sent:", tx.hash);
//         alert("Purchase transaction sent! Waiting for confirmation...");
        
//         await tx.wait();
//         alert(`Successfully purchased ${buyAmount} tokens!`);
        
//         // Reset UI and refresh data
//         setShowBuyModal(false);
//         setBuyAmount(1);
//         loadPropertyDetails(selectedProperty);
//         loadAllProperties();
//     } catch (error) {
//         console.error("Error buying tokens:", error);
        
//         // Improved error handling
//         let errorMessage = error.message || "Unknown error";
//         if (error.data && error.data.message) {
//             errorMessage = error.data.message;
//         } else if (error.reason) {
//             errorMessage = error.reason;
//         }
        
//         alert(`Failed to buy tokens: ${errorMessage}`);
//     } finally {
//         setIsLoading(false);
//     }
// };

const handleBuyTokens = async () => {
    if (!marketplaceContract || !signer || !account || !selectedProperty || !propertyDetails || !propertyDetails.listing) {
        alert("Cannot proceed with purchase. Please check your connection.");
        return;
    }

    // Get listing details
    const tokenAddress = selectedProperty.tokenAddress;
    const seller = propertyDetails.listing.seller;
    const decimals = propertyDetails.decimals;
    
    // Validate input amount
    const amountToBuy = parseInt(buyAmount);
    if (isNaN(amountToBuy) || amountToBuy <= 0) {
        alert("Please enter a valid positive number of tokens to buy.");
        return;
    }

    // Convert to token's smallest unit
    const amountInSmallestUnit = ethers.parseUnits(buyAmount.toString(), decimals);
    
    // Verify if amount is available
    if (amountInSmallestUnit > propertyDetails.listing.availableTokens) {
        alert(`You cannot buy more than the available ${ethers.formatUnits(propertyDetails.listing.availableTokens, decimals)} tokens.`);
        return;
    }

    // Calculate total cost - IMPROVED
    const pricePerToken = propertyDetails.listing.pricePerToken;
    // Handle BigInt multiplication more carefully
    const totalCostWei = pricePerToken * BigInt(amountToBuy);
    // Use a smaller padding (0.001 ETH)
    const paddingWei = ethers.parseEther("0.001");
    const totalWithPadding = totalCostWei + paddingWei;
    
    console.log(`Price per token: ${ethers.formatEther(pricePerToken)} ETH`);
    console.log(`Amount to buy: ${amountToBuy}`);
    console.log(`Base cost: ${ethers.formatEther(totalCostWei)} ETH`);
    console.log(`Sending with padding: ${ethers.formatEther(totalWithPadding)} ETH`);
    
    // Add better debugging before the transaction
    console.log("Transaction parameters:");
    console.log("- Token address:", tokenAddress);
    console.log("- Seller:", seller);
    console.log("- Amount in smallest unit:", amountInSmallestUnit.toString());
    console.log("- Value being sent (wei):", totalWithPadding.toString());
    
    setIsLoading(true);
    
    try {
        const tx = await marketplaceContract.buyTokens(
            tokenAddress,
            seller,
            amountInSmallestUnit,
            { 
                value: totalWithPadding,
                gasLimit: 500000 // Increased gas limit
            }
        );
        
        console.log("Transaction sent:", tx.hash);
        alert("Purchase transaction sent! Waiting for confirmation...");
        
        await tx.wait();
        alert(`Successfully purchased ${buyAmount} tokens!`);
        
        // Reset UI and refresh data
        setShowBuyModal(false);
        setBuyAmount(1);
        loadPropertyDetails(selectedProperty);
        loadAllProperties();
    } catch (error) {
        console.error("Error buying tokens:", error);
        
        // Enhanced error handling
        let errorMessage = "Unknown error";
        
        // Try to extract the most useful error information
        if (error.data && error.data.message) {
            errorMessage = error.data.message;
        } else if (error.reason) {
            errorMessage = error.reason;
        } else if (error.error && error.error.message) {
            errorMessage = error.error.message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        // Log the full error object for debugging
        console.log("Full error object:", JSON.stringify(error, null, 2));
        
        alert(`Failed to buy tokens: ${errorMessage}`);
    } finally {
        setIsLoading(false);
    }
};

// --- End of REVISED Buy Tokens Function ---

  // Improved approval function
  // --- REVISED Approval Function ---
  const handleApproveMarketplace = async () => {
    // Check necessary conditions (signer, account, selected property)
    if (!signer || !account || !selectedProperty || !propertyDetails) {
        alert("Please connect wallet and select a property first.");
        return;
    }

    // Ensure owner is trying to approve their own token
    if (propertyDetails?.owner?.toLowerCase() !== account.toLowerCase()) {
        alert("Only the property owner can approve tokens for sale.");
        return;
    }

    setIsApproving(true); // Set loading state
    setApprovalStatus("Processing approval..."); // Update status message
    
    try {
        // Get token contract instance, connected to the signer
        const tokenContract = new ethers.Contract(
            selectedProperty.tokenAddress,
            PropertyTokenABI.abi,
            signer
        );

        // Get total supply instead of using max uint
        const totalSupply = await tokenContract.totalSupply();
        console.log(`Approving marketplace for total supply: ${totalSupply.toString()}`);

        // Send the approve transaction with exact amount (total supply)
        const approveTx = await tokenContract.approve(
            TOKEN_MARKETPLACE_ADDRESS,
            totalSupply // Approve exactly the total supply amount
        );

        setApprovalStatus("Waiting for approval transaction confirmation...");
        console.log("Approval transaction sent:", approveTx.hash);

        // Wait for the transaction to be mined
        await approveTx.wait();

        setApprovalStatus(`Successfully approved Marketplace!`);
        console.log("Approval confirmed:", approveTx.hash);

    } catch (error) {
        console.error("Error during approval:", error);
        const errorMsg = error.reason || error.message || "Approval failed.";
        setApprovalStatus(`Approval failed: ${errorMsg}`);
        alert(`Approval failed: ${errorMsg}`); // Show alert
    } finally {
        setIsApproving(false); // Reset loading state
        // Optional: Clear status message after a delay
        setTimeout(() => setApprovalStatus(''), 7000);
    }
};
// --- End of REVISED Approval Function ---
  
// Fixed handleSellTokens function
const handleSellTokens = async () => {
    if (!marketplaceContract || !signer || !selectedProperty || !account) return;

    // Validate input
    const amountToSell = parseFloat(sellAmount);
    const priceInEth = parseFloat(sellPrice);
    
    if (isNaN(amountToSell) || amountToSell <= 0) {
        alert("Please enter a valid positive amount to sell");
        return;
    }
    
    if (isNaN(priceInEth) || priceInEth <= 0) {
        alert("Please enter a valid positive price");
        return;
    }

    setIsLoading(true);

    try {
        const tokenAddress = selectedProperty.tokenAddress;
        // Get token contract and decimals
        const tokenContract = new ethers.Contract(
            tokenAddress,
            PropertyTokenABI.abi,
            signer
        );
        
        const decimals = await tokenContract.decimals();
        const amountInSmallestUnit = ethers.parseUnits(sellAmount.toString(), decimals);
        const priceInWei = ethers.parseEther(sellPrice.toString());

        console.log(`Listing ${sellAmount} tokens (${amountInSmallestUnit.toString()} units) at ${priceInEth} ETH each`);

        // Check user's balance
        const balance = await tokenContract.balanceOf(account);
        if (balance < amountInSmallestUnit) {
            alert("You don't have enough tokens in your wallet");
            setIsLoading(false);
            return;
        }

        // Check if marketplace is approved
        const allowance = await tokenContract.allowance(account, TOKEN_MARKETPLACE_ADDRESS);
        console.log(`Required: ${amountInSmallestUnit.toString()}, Allowed: ${allowance.toString()}`);
        
        // Using BigInt comparison for ethers v6
        if (allowance < amountInSmallestUnit) {
            alert(`Marketplace allowance is insufficient. Please approve at least ${sellAmount} tokens first using the 'Approve Marketplace' button.`);
            setIsLoading(false);
            return;
        }
        
        console.log("Sufficient allowance confirmed.");

        // Now list the tokens
        const listTx = await marketplaceContract.listTokens(
            tokenAddress,
            priceInWei,
            amountInSmallestUnit
        );

        console.log("Listing transaction sent:", listTx.hash);
        await listTx.wait();
        console.log("Listing confirmed!");

        alert(`Successfully listed ${sellAmount} tokens for sale!`);

        // Close modal and refresh data
        setShowSellModal(false);
        setSellAmount(1);
        setSellPrice(0.01);
        loadPropertyDetails(selectedProperty);
        
        // Refresh all listings to show the new listing
        loadAllProperties();
        
    } catch (error) {
        console.error("Error listing tokens:", error);
        
        if (error.message) {
            alert(`Failed to list tokens: ${error.message}`);
        } else {
            alert("An unknown error occurred while listing tokens");
        }
    } finally {
        setIsLoading(false);
    }
};

  // Load all properties when contract is available
  useEffect(() => {
    if (contract) {
      loadAllProperties();
    }
  }, [contract, marketplaceContract]);

  if (!isConnected) {
    return (
      <div className="connect-container">
        <h2>Connect your wallet to browse the marketplace</h2>
        <button onClick={connectWallet}>Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      <div className="marketplace-header">
        <h2>Real Estate Marketplace</h2>
        <p>Connected as: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
      </div>

      <div className="marketplace-content">
        <div className="properties-grid">
          <div className="grid-header">
            <h3>Available Properties</h3>
            <button onClick={loadAllProperties} disabled={isLoading}>
              {isLoading ? "Loading..." : "Refresh Properties"}
            </button>
          </div>
          
          {isLoading && !selectedProperty ? (
            <div className="loading">Loading properties...</div>
          ) : allProperties.length === 0 ? (
            <div className="no-properties">No properties listed yet in the marketplace.</div>
          ) : (
            <div className="property-cards">
              {allProperties.map((property, index) => {
                const listing = listings[property.tokenAddress];
                return (
                  <div 
                    key={index} 
                    className={`property-card ${selectedProperty?.tokenAddress === property.tokenAddress ? 'selected' : ''}`}
                    onClick={() => loadPropertyDetails(property)}
                  >
                    <div className="property-card-image">
                      <div className="placeholder-image">{property.name.charAt(0)}</div>
                    </div>
                    <div className="property-card-content">
                      <h4>{property.name}</h4>
                      {listing && (
                        <div className="listing-badge">
                          For Sale: {ethers.formatEther(listing.pricePerToken)} ETH/token
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="property-details-panel">
          {isLoading && selectedProperty ? (
            <div className="loading">Loading property details...</div>
          ) : selectedProperty && propertyDetails ? (
            <div className="property-details">
              <h3>{propertyDetails.name} ({propertyDetails.symbol})</h3>
              
              <div className="detail-row">
                <span className="detail-label">Total Supply:</span>
                <span className="detail-value">{propertyDetails.totalSupply} tokens</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Your Balance:</span>
                <span className="detail-value">{propertyDetails.myBalance} tokens</span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Owner:</span>
                <span className="detail-value owner-address">
                  {propertyDetails.owner.substring(0, 6)}...{propertyDetails.owner.substring(propertyDetails.owner.length - 4)}
                  {propertyDetails.owner.toLowerCase() === account.toLowerCase() && " (You)"}
                </span>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">Token Address:</span>
                <span className="detail-value token-address">{propertyDetails.tokenAddress}</span>
              </div>
              
              {propertyDetails.listing && (
                <div className="listing-info">
                  <h4>Current Listing</h4>
                  <div className="detail-row">
                    <span className="detail-label">Price:</span>
                    <span className="detail-value">{ethers.formatEther(propertyDetails.listing.pricePerToken)} ETH per token</span>
                  </div>
                  {/* <div className="detail-row">
                    <span className="detail-label">Available:</span>
                    <span className="detail-value">{propertyDetails.listing.availableTokens.toString()} tokens</span>
                  </div> */}
                  <div className="detail-row">
                    <span className="detail-label">Available:</span>
                    <span className="detail-value">{ethers.formatUnits(propertyDetails.listing.availableTokens, propertyDetails.decimals)} tokens</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Seller:</span>
                    <span className="detail-value">
                      {propertyDetails.listing.seller.substring(0, 6)}...
                      {propertyDetails.listing.seller.substring(propertyDetails.listing.seller.length - 4)}
                      {propertyDetails.listing.seller.toLowerCase() === account.toLowerCase() && " (You)"}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="actions-container">
                {console.log("Buy Button Render Check:",
                    "listing exists?", !!propertyDetails.listing,
                    "seller?", propertyDetails.listing?.seller,
                    "account?", account,
                    "is seller !== account?", propertyDetails.listing?.seller?.toLowerCase() !== account?.toLowerCase()
                )}
                {/* Show Buy button ONLY if there's a listing AND it's not the current user's listing */}
                {propertyDetails.listing && propertyDetails.listing.seller.toLowerCase() !== account.toLowerCase() && (
                  <button 
                    className="buy-button"
                    onClick={() => setShowBuyModal(true)}
                  >
                    Buy Tokens
                  </button>
                )}
                
                {/* Show Sell button ONLY if user has tokens (not just property owner) */}
                {parseFloat(propertyDetails.myBalance) > 0 && (
                  <button 
                    className="sell-button"
                    onClick={() => setShowSellModal(true)}
                  >
                    List Tokens for Sale
                  </button>
                )}
                
                {/* Show Approval section ONLY if user is the property owner */}
                {propertyDetails && propertyDetails.owner.toLowerCase() === account.toLowerCase() && (
                    <div className="approval-section" style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                        <h4>Approve Marketplace</h4>
                        <p className="small-text">Allow the marketplace contract to handle ALL your tokens for listing/selling.</p>
                        <div className="form-group">
                            {/* Removed Amount Input Field */}
                            <button
                                onClick={handleApproveMarketplace}
                                // Button is disabled only while processing
                                disabled={isApproving}
                                className="approve-button"
                            >
                                {isApproving ? "Approving..." : "Approve All Tokens"}
                            </button>
                        </div>
                        {/* Keep the status message */}
                        {approvalStatus && <p className={approvalStatus.includes('failed') ? 'error' : 'success'} style={{ fontSize: '0.9em', marginTop: '5px' }}>{approvalStatus}</p>}
                    </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a property to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Buy Modal */}
      {showBuyModal && propertyDetails && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Buy {propertyDetails.name} Tokens</h3>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Available:</label>
                <p>{ethers.formatUnits(propertyDetails.listing.availableTokens, propertyDetails.decimals)} tokens</p>
              </div>
              
              <div className="form-group">
                <label>Price per token:</label>
                <p>{price} ETH</p>
              </div>
              
              <div className="form-group">
                <label>Amount to buy:</label>
                <input 
                  type="number" 
                  min="1" 
                  max={ethers.formatUnits(propertyDetails.listing.availableTokens, propertyDetails.decimals)}
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label>Total cost:</label>
                <p>{(parseFloat(price) * buyAmount).toFixed(6)} ETH</p>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-button"
                onClick={() => setShowBuyModal(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-button"
                onClick={handleBuyTokens}
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Confirm Purchase"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {showSellModal && propertyDetails && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Sell {propertyDetails.name} Tokens</h3>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Your balance:</label>
                <p>{propertyDetails.myBalance} tokens</p>
              </div>
              
              <div className="form-group">
                <label>Amount to sell:</label>
                <input 
                  type="number" 
                  min="1" 
                  max={parseFloat(propertyDetails.myBalance)}
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label>Price per token (ETH):</label>
                <input 
                  type="number"
                  step="0.000001"
                  min="0.000001"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label>Total value:</label>
                <p>{(parseFloat(sellPrice) * sellAmount).toFixed(6)} ETH</p>
              </div>
              
              <div className="note" style={{marginTop: '10px', fontSize: '0.85em', color: '#666'}}>
                <strong>Note:</strong> You must approve the marketplace to handle your tokens before listing them for sale.
                {propertyDetails.owner.toLowerCase() === account.toLowerCase() 
                  ? " Use the 'Approve Marketplace' section on the main page."
                  : " Contact the property owner if you're having issues with approvals."}
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-button"
                onClick={() => setShowSellModal(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-button"
                onClick={handleSellTokens}
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "List for Sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
