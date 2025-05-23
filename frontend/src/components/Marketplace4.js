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
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // Separate loading for details


  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyAmount, setBuyAmount] = useState("1"); 
  const [selectedListingForBuy, setSelectedListingForBuy] = useState(null); // Store the specific listing being bought

  const [showSellModal, setShowSellModal] = useState(false);
  const [sellAmount, setSellAmount] = useState("1"); // Use string for input
  const [sellPrice, setSellPrice] = useState("0.01"); // Use string for input

  const [isApproving, setIsApproving] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState("");


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
      setContract(null);
      setMarketplaceContract(null);
      setSelectedProperty(null);
      setPropertyDetails(null);
      setAllProperties([]);
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

      setShowBuyModal(false);
      setShowSellModal(false);
      setSelectedListingForBuy(null);

      if (managerContract) loadAllProperties(managerContract); 
      if (selectedProperty) {
          setSelectedProperty(null);
          setPropertyDetails(null);
      }
    }
  };

   useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" })
        .then(accounts => {
          if (accounts.length > 0) {
            console.log("Wallet already connected on load");
            connectWallet(); 
          } else {
            console.log("Wallet not connected on load");
          }
        });

      const eth = window.ethereum;
      eth.on("accountsChanged", handleAccountsChanged);

      // Cleanup
      return () => {
        eth.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, []); 

  const loadAllProperties = async (managerContract = contract) => { 
    if (!managerContract) {
         console.log("PropertyManager contract instance not available.");
         return;
     }

    try {
      setIsLoading(true); // Loading properties list
      console.log("Loading all properties from manager...");
      const properties = await managerContract.getAllProperties();
      console.log("Fetched properties:", properties);
       if (!Array.isArray(properties)) {
           console.error("getAllProperties did not return an array:", properties);
           setAllProperties([]); // Set to empty array on error
           return;
       }
      setAllProperties(properties);
    } catch (error) {
      console.error("Error loading all properties:", error);
      setAllProperties([]); 
    } finally {
      setIsLoading(false);
    }
  };

  const loadPropertyDetails = async (property) => {
    if (!signer || !marketplaceContract) {
        console.warn("Signer or MarketplaceContract not ready for loading details.");
        setSelectedProperty(property);
        setPropertyDetails(null); 
        setIsLoadingDetails(true); 
        if (!isConnected) {
            alert("Please connect your wallet to view full details and listings.");
        }
        return;
    }

    console.log(`Loading details for property: ${property.name} (${property.tokenAddress})`);
    setIsLoadingDetails(true);
    setSelectedProperty(property); 
    setPropertyDetails(null); 

    try {
      const tokenContract = new ethers.Contract(
        property.tokenAddress,
        PropertyTokenABI.abi,
        signer 
      );

      const [symbol, decimalsBigInt, totalSupply, owner, balance] = await Promise.all([
          tokenContract.symbol(),
          tokenContract.decimals(), 
          tokenContract.totalSupply(),
          tokenContract.owner(),
          account ? tokenContract.balanceOf(account) : Promise.resolve(ethers.toBigInt(0)) 
      ]);

      const decimals = Number(decimalsBigInt);

      // Format values
      const formattedSupply = ethers.formatUnits(totalSupply, decimals);
      const myBalance = ethers.formatUnits(balance, decimals);

      let activeListings = [];
      try {
          console.log(`Calling getActiveListingsForToken(${property.tokenAddress})...`);
          const rawListings = await marketplaceContract.getActiveListingsForToken(property.tokenAddress);
          console.log(`Raw active listings from contract:`, rawListings);
           activeListings = rawListings.map(listing => ({
              tokenAddress: listing.tokenAddress, // Keep address
              seller: listing.seller,
              pricePerToken: listing.pricePerToken,
              availableTokens: listing.availableTokens,
              active: listing.active,
          }));
           console.log(`Processed active listings:`, activeListings);
      } catch(listingError) {
          console.error(`Error fetching active listings for ${property.tokenAddress}:`, listingError);
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
        activeListings: activeListings 
      };

      console.log("Setting property details state:", details);
      setPropertyDetails(details);

    } catch (error) {
      console.error(`Error loading property details for ${property.tokenAddress}:`, error);
      setPropertyDetails(null); 
    } finally {
      setIsLoadingDetails(false); 
    }
  };

    const handleBuyTokens = async () => {
        if (!marketplaceContract || !signer || !account || !selectedProperty || !propertyDetails || !selectedListingForBuy) {
             alert("Cannot proceed with purchase. Ensure wallet is connected, property and listing are selected, and details are available.");
             return;
         }

        const listing = selectedListingForBuy;
        const tokenAddress = selectedProperty.tokenAddress; 
        const seller = listing.seller; 
        const decimals = propertyDetails.decimals; 
        const pricePerWholeTokenWei = listing.pricePerToken; 
        const availableTokensSmallestUnit = listing.availableTokens; 

        const amountStringToBuy = buyAmount;
        let amountToBuyWholeTokens;
        try {
            amountToBuyWholeTokens = parseInt(amountStringToBuy);
            if (isNaN(amountToBuyWholeTokens) || amountToBuyWholeTokens <= 0) {
                alert("Please enter a valid positive number of tokens to buy.");
                return;
            }
        } catch (e) { alert("Invalid amount entered."); return; }

        const amountToBuySmallestUnit = ethers.parseUnits(amountStringToBuy, decimals);

        if (amountToBuySmallestUnit > availableTokensSmallestUnit) {
             alert(`Selected listing only has ${ethers.formatUnits(availableTokensSmallestUnit, decimals)} tokens available.`);
             return;
        }

        const totalCostWei = pricePerWholeTokenWei * BigInt(amountToBuyWholeTokens);
        console.log(`Buying ${amountStringToBuy} tokens from seller ${seller}`);
        console.log(`Calculated Total Cost (WEI): ${totalCostWei.toString()}`);

        setIsLoading(true); // Use modal's loading state

        try {
            const tx = await marketplaceContract.connect(signer).buyTokens(
                tokenAddress,
                seller, // Seller from the selected listing
                amountToBuySmallestUnit,
                { value: totalCostWei }
            );

            console.log("Buy transaction sent:", tx.hash);
            alert("Buy transaction sent! Waiting for confirmation...");

            await tx.wait();
            console.log("Buy transaction confirmed!");
            alert(`Successfully purchased ${amountStringToBuy} tokens!`);

            setShowBuyModal(false);
            setSelectedListingForBuy(null); 
            setBuyAmount("1"); 
            loadPropertyDetails(selectedProperty); 

        } catch (error) {
            console.error("Error buying tokens:", error);
            const errorMsg = error.reason || error.message || "Failed to buy tokens.";
            alert(`Transaction Failed: ${errorMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveMarketplace = async () => {
        if (!signer || !account || !selectedProperty || !propertyDetails) {
            alert("Please connect wallet and select a property first.");
            return;
        }
        // Check if user has any tokens to approve (myBalance is formatted string)
         if (parseFloat(propertyDetails.myBalance) <= 0) {
            alert("You don't have any tokens of this property to approve for sale.");
            return;
        }

        setIsApproving(true);
        setApprovalStatus("Processing approval for maximum amount...");
        console.log(`Approving Marketplace (${TOKEN_MARKETPLACE_ADDRESS}) for maximum token spending (${selectedProperty.tokenAddress})...`);

        try {
            const tokenContract = new ethers.Contract(selectedProperty.tokenAddress, PropertyTokenABI.abi, signer);
            const amountToApprove = ethers.MaxUint256; // Approve max
            console.log(`Amount to approve (MaxUint256): ${amountToApprove.toString()}`);

            const approveTx = await tokenContract.approve(TOKEN_MARKETPLACE_ADDRESS, amountToApprove);

            setApprovalStatus("Waiting for approval transaction confirmation...");
            console.log("Approval transaction sent:", approveTx.hash);
            await approveTx.wait();
            setApprovalStatus(`Successfully approved Marketplace for maximum spending!`);
            console.log("Approval confirmed:", approveTx.hash);

            const decimals = propertyDetails.decimals;
            const newAllowance = await tokenContract.allowance(account, TOKEN_MARKETPLACE_ADDRESS);
            console.log(`New allowance check: ${ethers.formatUnits(newAllowance, decimals)} tokens`);

        } catch (error) {
            console.error("Error during approval:", error);
            const errorMsg = error.reason || error.message || "Approval failed.";
            setApprovalStatus(`Approval failed: ${errorMsg}`);
            alert(`Approval failed: ${errorMsg}`);
        } finally {
            setIsApproving(false);
             setTimeout(() => setApprovalStatus(''), 7000);
        }
    };

  // handleSellTokens remains the same (checks allowance before listing)
    const handleSellTokens = async () => {
        if (!marketplaceContract || !signer || !selectedProperty || !account) return;

        const amountToSell = parseFloat(sellAmount);
        const priceInEth = parseFloat(sellPrice);
        if (isNaN(amountToSell) || amountToSell <= 0 || isNaN(priceInEth) || priceInEth <= 0) {
            alert("Please enter valid positive amounts and prices."); return;
        }

        setIsLoading(true); // Use main loading state, or add separate sell loading state

        try {
            const tokenAddress = selectedProperty.tokenAddress;
            const tokenContract = new ethers.Contract(tokenAddress, PropertyTokenABI.abi, signer);
            const decimals = propertyDetails.decimals; // Get decimals from state
            const amountInSmallestUnit = ethers.parseUnits(sellAmount.toString(), decimals);
            const priceInWei = ethers.parseEther(sellPrice.toString());

            const balance = await tokenContract.balanceOf(account);
            if (balance < amountInSmallestUnit) { // Compare BigInts directly
                alert("Insufficient token balance."); setIsLoading(false); return;
            }

            const allowance = await tokenContract.allowance(account, TOKEN_MARKETPLACE_ADDRESS);
            console.log(`Allowance Check - Required: ${amountInSmallestUnit.toString()}, Allowed: ${allowance.toString()}`);
            if (allowance < amountInSmallestUnit) { // Use BigInt comparison
                alert(`Marketplace allowance insufficient. Please approve tokens first.`); setIsLoading(false); return;
            }

            console.log("Sufficient allowance confirmed. Listing tokens...");
            const listTx = await marketplaceContract.listTokens(tokenAddress, priceInWei, amountInSmallestUnit);

            console.log("Listing transaction sent:", listTx.hash);
            await listTx.wait();
            console.log("Listing confirmed!");
            alert(`Successfully listed ${sellAmount} tokens for sale!`);

            setShowSellModal(false);
            setSellAmount("1");
            setSellPrice("0.01");
            loadPropertyDetails(selectedProperty); 

        } catch (error) {
            console.error("Error listing tokens:", error);
            const errorMsg = error.reason || error.message || "Failed to list tokens.";
            alert(`Listing Failed: ${errorMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

  // Load properties initially when dependencies are ready
  useEffect(() => {
    if (contract && account && marketplaceContract) { // Ensure all contracts/signer ready
        console.log("Contract and account ready, loading initial properties.");
        loadAllProperties();
    } else {
        console.log("Conditions not met for initial property load", { contract: !!contract, account: !!account, marketplace: !!marketplaceContract });
    }
  }, [contract, account, marketplaceContract]); // Dependencies for initial load


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
            <button onClick={() => loadAllProperties()} disabled={isLoading}> 
              {isLoading ? "Loading..." : "Refresh Properties"}
            </button>
          </div>

          {isLoading ? (
            <div className="loading">Loading properties...</div>
          ) : allProperties.length === 0 ? (
            <div className="no-properties">No properties listed yet in the marketplace.</div>
          ) : (
            <div className="property-cards">
              {allProperties.map((property, index) => {
                 const hasListings = propertyDetails?.tokenAddress === property.tokenAddress && propertyDetails.activeListings.length > 0;
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
                      {hasListings && (
                        <div className="listing-badge">
                          For Sale
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
          {isLoadingDetails ? ( // Use separate loading state
            <div className="loading">Loading property details...</div>
          ) : selectedProperty && propertyDetails ? (
            <div className="property-details">
              <h3>{propertyDetails.name} ({propertyDetails.symbol})</h3>

              <div className="detail-row"><span className="detail-label">Total Supply:</span><span className="detail-value">{propertyDetails.totalSupply} tokens</span></div>
              <div className="detail-row"><span className="detail-label">Your Balance:</span><span className="detail-value">{propertyDetails.myBalance} tokens</span></div>
              <div className="detail-row"><span className="detail-label">Owner:</span><span className="detail-value owner-address">{propertyDetails.owner.substring(0, 6)}...{propertyDetails.owner.substring(propertyDetails.owner.length - 4)}{propertyDetails.owner.toLowerCase() === account.toLowerCase() && " (You)"}</span></div>
              <div className="detail-row"><span className="detail-label">Token Address:</span><span className="detail-value token-address">{propertyDetails.tokenAddress}</span></div>


              <div className="listing-info" style={{ marginTop: '15px' }}>
                  <h4>Active Listings</h4>
                  {propertyDetails.activeListings.length === 0 ? (
                      <p>No active listings for this property.</p>
                  ) : (
                      <ul className="active-listings-list">
                          {propertyDetails.activeListings.map((listing, idx) => (
                              <li key={idx} className="listing-item">
                                  <div>
                                      <span className="detail-label">Seller: </span>
                                      <span className="detail-value seller-address">
                                          {listing.seller.substring(0, 6)}...{listing.seller.substring(listing.seller.length - 4)}
                                          {listing.seller.toLowerCase() === account.toLowerCase() && " (You)"}
                                      </span>
                                  </div>
                                  <div>
                                      <span className="detail-label">Price: </span>
                                      <span className="detail-value">{ethers.formatEther(listing.pricePerToken)} ETH/token</span>
                                  </div>
                                  <div>
                                      <span className="detail-label">Available: </span>
                                      <span className="detail-value">{ethers.formatUnits(listing.availableTokens, propertyDetails.decimals)} tokens</span>
                                  </div>
                                  {listing.seller.toLowerCase() !== account.toLowerCase() && (
                                      <button
                                          className="buy-button small-buy-button"
                                          onClick={() => {
                                              // Set the specific listing to buy and open modal
                                              setSelectedListingForBuy(listing);
                                              setShowBuyModal(true);
                                          }}
                                          style={{ marginBottom: '15px' }}
                                      >
                                          Buy
                                      </button>
                                  )}
                              </li>
                          ))}
                      </ul>
                  )}
              </div>

              <div className="actions-container" style={{ marginTop: '20px' }}>

                {parseFloat(propertyDetails.myBalance) > 0 && (
                  <button
                    className="sell-button"
                    onClick={() => setShowSellModal(true)}
                  >
                    List Tokens for Sale
                  </button>
                )}

                {parseFloat(propertyDetails.myBalance) > 0 && (
                    <div className="approval-section" style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                        <h4>Approve Marketplace</h4>
                        <p className="small-text">Allow the marketplace contract to handle your tokens for listing/selling.</p>
                        <div className="form-group">
                            <button
                                onClick={handleApproveMarketplace}
                                disabled={isApproving}
                                className="approve-button"
                            >
                                {isApproving ? "Approving..." : "Approve My Tokens"} {/* Updated text */}
                            </button>
                        </div>
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

      {showBuyModal && selectedListingForBuy && propertyDetails && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Buy {propertyDetails.name} Tokens</h3>

            <div className="modal-content">
              <div className="form-group">
                <label>From Seller:</label>
                <p className="seller-address">{selectedListingForBuy.seller.substring(0,8)}...</p>
              </div>
              <div className="form-group">
                <label>Available:</label>
                <p>{ethers.formatUnits(selectedListingForBuy.availableTokens, propertyDetails.decimals)} tokens</p>
              </div>
              <div className="form-group">
                <label>Price per token:</label>
                <p>{ethers.formatEther(selectedListingForBuy.pricePerToken)} ETH</p>
              </div>
              <div className="form-group">
                <label>Amount to buy:</label>
                <input
                  type="number"
                  min="1"
                  max={ethers.formatUnits(selectedListingForBuy.availableTokens, propertyDetails.decimals)}
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Total cost:</label>
                <p>{(parseFloat(ethers.formatEther(selectedListingForBuy.pricePerToken)) * parseFloat(buyAmount || "0")).toFixed(6)} ETH</p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => {setShowBuyModal(false); setSelectedListingForBuy(null);}} 
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

      {showSellModal && propertyDetails && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Sell {propertyDetails.name} Tokens</h3>
            <div className="modal-content">
               <div className="form-group"><label>Your balance:</label><p>{propertyDetails.myBalance} tokens</p></div>
               <div className="form-group"><label>Amount to sell:</label><input type="number" min="1" max={parseFloat(propertyDetails.myBalance)} value={sellAmount} onChange={(e) => setSellAmount(e.target.value)}/></div>
               <div className="form-group"><label>Price per token (ETH):</label><input type="number" step="any" min="0.000001" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}/></div>
               <div className="form-group"><label>Total value:</label><p>{(parseFloat(sellPrice || "0") * parseFloat(sellAmount || "0")).toFixed(6)} ETH</p></div>
              <div className="note" style={{marginTop: '10px', fontSize: '0.85em', color: '#666'}}>
                <strong>Note:</strong> Ensure you have approved the marketplace using the 'Approve My Tokens' button on the main details panel before listing.
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowSellModal(false)}>Cancel</button>
              <button className="confirm-button" onClick={handleSellTokens} disabled={isLoading}>
                {isLoading ? "Processing..." : "List for Sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}