import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { PROPERTY_MANAGER_ADDRESS, PROPERTY_RENTAL_ADDRESS } from "../utils/config";
import PropertyManagerABI from "../contracts/PropertyManager.json";
import PropertyTokenABI from "../contracts/PropertyToken.json";
import PropertyRentalABI from "../contracts/PropertyRental.json";
// import './PropertyRent.css';

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
  const [showListingForm, setShowListingForm] = useState(false);

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

        // Get property details and filter for properties the user owns
        const detailsMap = {};
        const detailsPromises = formattedProperties.map(async (property) => {
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
        });
        
        await Promise.all(detailsPromises);
        setPropertyDetails(detailsMap);
        setProperties(formattedProperties);

        // Load active rental listings
        const rentalContract = new ethers.Contract(
          PROPERTY_RENTAL_ADDRESS,
          PropertyRentalABI.abi,
          signer
        );
        
        const activeListings = await rentalContract.getActiveRentalListings();
        
        // Get property details for each listing
        const listingsPromises = activeListings.map(async (listing) => {
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
        
        const listingsWithDetails = await Promise.all(listingsPromises);
        setRentalListings(listingsWithDetails);
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
  const handleListProperty = async () => {
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
      setShowListingForm(false);
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
      
      const tx = await rentalContract.rentProperty(propertyAddress, { 
        value: rentAmountWei 
      });
      
      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);
  
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

  // Select a property for listing
  const handleSelectPropertyForListing = (tokenAddress) => {
    setListingProperty(tokenAddress);
  };

  // Get list of properties the user owns
  const getOwnedProperties = () => {
    return properties.filter(property => {
      const details = propertyDetails[property.tokenAddress];
      return details && parseFloat(details.balance) > 0;
    });
  };

  // Check if a property is already listed
  const isPropertyListed = (tokenAddress) => {
    return rentalListings.some(listing => listing.address === tokenAddress && listing.isActive);
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
            <div className="section-header">
              <h3>List Your Property for Rent</h3>
              {!showListingForm && (
                <button 
                  onClick={() => setShowListingForm(true)}
                  className="btn-primary"
                >
                  List a Property
                </button>
              )}
            </div>

            {showListingForm && (
              <div className="listing-form-container">
                <h4>Select a Property to List</h4>
                {getOwnedProperties().length === 0 ? (
                  <p>You don't own any property tokens to list.</p>
                ) : (
                  <>
                    <div className="properties-grid">
                      {getOwnedProperties().map((property, index) => {
                        const details = propertyDetails[property.tokenAddress];
                        const isAlreadyListed = isPropertyListed(property.tokenAddress);
                        
                        return (
                          <div 
                            key={index}
                            className={`property-card ${listingProperty === property.tokenAddress ? 'selected' : ''} ${isAlreadyListed ? 'already-listed' : ''}`}
                            onClick={() => !isAlreadyListed && handleSelectPropertyForListing(property.tokenAddress)}
                          >
                            <div className="property-card-image">
                              <div className="placeholder-image">{property.name.charAt(0)}</div>
                            </div>
                            <div className="property-card-content">
                              <h4>{property.name}</h4>
                              <p><strong>Balance:</strong> {details.balance} tokens</p>
                              <p><strong>Ownership:</strong> {
                                ((parseFloat(details.balance) / parseFloat(details.totalSupply)) * 100).toFixed(2)
                              }%</p>
                              {isAlreadyListed && (
                                <div className="listing-badge">Already Listed</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {listingProperty && (
                      <div className="rate-input-form">
                        <h4>Set Rental Rate</h4>
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
                        
                        <div className="form-actions">
                          <button 
                            onClick={() => setShowListingForm(false)}
                            className="btn-secondary"
                            style={{ marginRight: '15px' }}
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleListProperty} 
                            disabled={loading || !listingProperty || !weeklyRate}
                            className="btn-primary"
                          >
                            {loading ? "Processing..." : "List Property"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="section">
            <h3>Available Rentals</h3>
            {rentalListings.length === 0 ? (
              <p>No properties are currently listed for rent.</p>
            ) : (
              <div className="rentals-grid">
                {rentalListings.map((listing, index) => {
                  const isMine = propertyDetails[listing.address] && 
                    parseFloat(propertyDetails[listing.address].balance) > 0;
                    
                  return (
                    <div key={index} className="rental-card">
                      <h4>{listing.name}</h4>
                      <p><strong>Rate:</strong> {listing.weeklyRate} ETH/week</p>
                      
                      {isMine ? (
                        <button 
                          onClick={() => handleCancelListing(listing.address)}
                          className="btn-secondary"
                          disabled={loading}
                        >
                          Cancel Listing
                        </button>
                      ) : (
                        <div className="rent-action">
                          <button 
                            onClick={() => handleRentProperty(listing.address, listing.weeklyRate)}
                            className="btn-primary"
                            disabled={loading}
                          >
                            Rent Now for {listing.weeklyRate} ETH
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="section">
            <h3>My Property Holdings</h3>
            {getOwnedProperties().length === 0 ? (
              <p>You don't own any property tokens yet.</p>
            ) : (
              <div className="properties-grid">
                {getOwnedProperties().map((property, index) => {
                  const details = propertyDetails[property.tokenAddress];
                  
                  return (
                    <div key={index} className="property-card">
                      <div className="property-card-image">
                        <div className="placeholder-image">{property.name.charAt(0)}</div>
                      </div>
                      <div className="property-card-content">
                        <h4>{property.name}</h4>
                        <p><strong>Symbol:</strong> {details.symbol}</p>
                        <p><strong>Your Balance:</strong> {details.balance} tokens</p>
                        <p><strong>Ownership:</strong> {
                          ((parseFloat(details.balance) / parseFloat(details.totalSupply)) * 100).toFixed(2)
                        }%</p>
                        {isPropertyListed(property.tokenAddress) && (
                          <div className="listing-badge">Currently Listed</div>
                        )}
                      </div>
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