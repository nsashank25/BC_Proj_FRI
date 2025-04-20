import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { PROPERTY_MANAGER_ADDRESS, PROPERTY_RENTAL_ADDRESS } from "../utils/config";
import PropertyManagerABI from "../contracts/PropertyManager.json";
import PropertyTokenABI from "../contracts/PropertyToken.json";
import PropertyRentalABI from "../contracts/PropertyRental.json";
import './PropertyRent.css';

function PropertyRent() {
  const [account, setAccount] = useState("");
  const [properties, setProperties] = useState([]);
  const [propertyDetails, setPropertyDetails] = useState({});
  const [rentalListings, setRentalListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // For property listing form
  const [listingProperty, setListingProperty] = useState("");
  const [weeklyRate, setWeeklyRate] = useState("");

  // Connect to wallet
  useEffect(() => {
    const connectWallet = async () => {
      try {
        const { ethereum } = window;
        if (!ethereum) {
          setError("MetaMask not installed!");
          return;
        }

        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        setAccount(accounts[0]);

        // Listen for account changes
        ethereum.on("accountsChanged", (accounts) => {
          setAccount(accounts[0]);
          setRefreshTrigger(prev => prev + 1);
        });
      } catch (error) {
        console.error("Error connecting to wallet:", error);
        setError("Failed to connect wallet");
      }
    };

    connectWallet();
    return () => {
      // Clean up event listeners
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
      }
    };
  }, []);

  // Load properties and rental listings
  useEffect(() => {
    const loadData = async () => {
      if (!account) return;

      setLoading(true);
      setError("");
      try {
        // Updated for ethers v6
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Load properties from PropertyManager
        const propertyManagerContract = new ethers.Contract(
          PROPERTY_MANAGER_ADDRESS,
          PropertyManagerABI.abi,
          signer
        );
        
        const allProperties = await propertyManagerContract.getAllProperties();
        const formattedProperties = allProperties.map(prop => ({
          name: prop.name,
          tokenAddress: prop.tokenAddress,
          metadataURI: prop.metadataURI
        }));

        setProperties(formattedProperties);

        // Load active rental listings
        const rentalContract = new ethers.Contract(
          PROPERTY_RENTAL_ADDRESS,
          PropertyRentalABI.abi,
          signer
        );
        
        const activeListings = await rentalContract.getActiveRentalListings();
        
        // Get property details for each listing
        const detailsPromises = activeListings.map(async (listing) => {
          const tokenContract = new ethers.Contract(
            listing.propertyTokenAddress,
            PropertyTokenABI.abi,
            signer
          );
          
          const name = await tokenContract.name();
          
          return {
            address: listing.propertyTokenAddress,
            weeklyRate: ethers.formatEther(listing.weeklyRate),
            isActive: listing.isActive,
            name
          };
        });
        
        const listingsWithDetails = await Promise.all(detailsPromises);
        setRentalListings(listingsWithDetails);

        // Get property details
        const detailsMap = {};
        for (const property of formattedProperties) {
          const tokenContract = new ethers.Contract(
            property.tokenAddress,
            PropertyTokenABI.abi,
            signer
          );
          
          const symbol = await tokenContract.symbol();
          const balance = await tokenContract.balanceOf(account);
          const totalSupply = await tokenContract.totalSupply();
          const decimals = await tokenContract.decimals();
          
          detailsMap[property.tokenAddress] = {
            symbol,
            balance: ethers.formatUnits(balance, decimals),
            totalSupply: ethers.formatUnits(totalSupply, decimals),
            decimals
          };
        }
        
        setPropertyDetails(detailsMap);
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Failed to load data. Check console for details.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [account, refreshTrigger]);

  // List property for rent
  const handleListProperty = async (e) => {
    e.preventDefault();
    if (!listingProperty || !weeklyRate) return;

    setLoading(true);
    try {
      // Updated for ethers v6
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const rentalContract = new ethers.Contract(
        PROPERTY_RENTAL_ADDRESS,
        PropertyRentalABI.abi,
        signer
      );

      const weeklyRateWei = ethers.parseEther(weeklyRate);
      const tx = await rentalContract.listPropertyForRent(listingProperty, weeklyRateWei);
      await tx.wait();

      // Reset form and refresh data
      setListingProperty("");
      setWeeklyRate("");
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error listing property:", error);
      setError("Failed to list property. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  // Rent a property
  const handleRentProperty = async (propertyAddress, rentAmountEth) => {
    if (!propertyAddress) return;
  
    setLoading(true);
    try {
      // Updated for ethers v6
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const rentalContract = new ethers.Contract(
        PROPERTY_RENTAL_ADDRESS,
        PropertyRentalABI.abi,
        signer
      );
  
      const rentAmountWei = ethers.parseEther(rentAmountEth); // Convert to Wei
      console.log(`Renting property at address: ${propertyAddress}`);
      console.log(`Sending payment of: ${rentAmountWei} Wei (${rentAmountEth} ETH)`);
      
      // Call the rentProperty function with correct value
      const tx = await rentalContract.rentProperty(propertyAddress, { 
        value: rentAmountWei 
      });
      
      console.log("Transaction sent:", tx.hash);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);
      console.log("Property rented successfully!");
  
      // Refresh data
      setRefreshTrigger(prev => prev + 1);
      
      // Show success message
      setError(null);
      alert("Property rented successfully!");
    } catch (error) {
      console.error("Error renting property:", error);
      
      // Provide more detailed error message
      let errorMessage = "Failed to rent property";
      if (error.reason) {
        errorMessage += `: ${error.reason}`;
      } else if (error.message) {
        // Try to extract the revert reason from the error message
        const revertMatch = error.message.match(/reverted with reason string '([^']+)'/);
        if (revertMatch) {
          errorMessage += `: ${revertMatch[1]}`;
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Cancel a rental listing
  const handleCancelListing = async (propertyAddress) => {
    setLoading(true);
    try {
      // Updated for ethers v6
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const rentalContract = new ethers.Contract(
        PROPERTY_RENTAL_ADDRESS,
        PropertyRentalABI.abi,
        signer
      );

      const tx = await rentalContract.cancelRentalListing(propertyAddress);
      await tx.wait();

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error cancelling listing:", error);
      setError("Failed to cancel listing. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="property-rent-container">
      <h2>Property Rental Marketplace</h2>
      
      {!account ? (
        <p>Please connect your wallet to continue.</p>
      ) : (
        <>
          {error && <div className="error-message">{error}</div>}
          
          <div className="section">
            <h3>List Your Property for Rent</h3>
            <form onSubmit={handleListProperty} className="listing-form">
              <div className="form-group">
                <label>Property:</label>
                <select 
                  value={listingProperty} 
                  onChange={(e) => setListingProperty(e.target.value)}
                  required
                >
                  <option value="">Select a property</option>
                  {properties.map((property, index) => (
                    <option key={index} value={property.tokenAddress}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Weekly Rate (ETH):</label>
                <input 
                  type="number" 
                  step="0.0001"
                  value={weeklyRate} 
                  onChange={(e) => setWeeklyRate(e.target.value)}
                  placeholder="0.1"
                  required
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading || !listingProperty || !weeklyRate}
                className="btn-primary"
              >
                {loading ? "Processing..." : "List Property"}
              </button>
            </form>
          </div>
          
          <div className="section">
            <h3>Available Rentals</h3>
            {rentalListings.length === 0 ? (
              <p>No properties are currently listed for rent.</p>
            ) : (
              <div className="rentals-grid">
                {rentalListings.map((listing, index) => (
                  <div key={index} className="rental-card">
                    <h4>{listing.name}</h4>
                    <p><strong>Rate:</strong> {listing.weeklyRate} ETH/week</p>
                    
                    {/* Property owner actions */}
                    {propertyDetails[listing.address] && 
                      parseFloat(propertyDetails[listing.address].balance) > 0 && (
                      <button 
                        onClick={() => handleCancelListing(listing.address)}
                        className="btn-secondary"
                        disabled={loading}
                      >
                        Cancel Listing
                      </button>
                    )}
                    
                    {/* Renter actions */}
                    <div className="rent-action">
                      <button 
                        onClick={() => handleRentProperty(listing.address, listing.weeklyRate)}
                        className="btn-primary"
                        disabled={loading}
                      >
                        Rent Now for {listing.weeklyRate} ETH
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="section">
            <h3>My Property Holdings</h3>
            {properties.length === 0 ? (
              <p>You don't own any property tokens yet.</p>
            ) : (
              <div className="properties-grid">
                {properties.map((property, index) => {
                  const details = propertyDetails[property.tokenAddress];
                  if (!details || parseFloat(details.balance) === 0) return null;
                  
                  return (
                    <div key={index} className="property-card">
                      <h4>{property.name}</h4>
                      <p><strong>Symbol:</strong> {details?.symbol}</p>
                      <p><strong>Your Balance:</strong> {details?.balance} tokens</p>
                      <p><strong>Ownership:</strong> {
                        details ? ((details.balance / details.totalSupply) * 100).toFixed(2) : 0
                      }%</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PropertyRent;