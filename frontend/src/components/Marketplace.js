// src/components/Marketplace.js

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import PropertyManagerABI from "../contracts/PropertyManager.json";
import PropertyTokenABI from "../contracts/PropertyToken.json";
import { PROPERTY_MANAGER_ADDRESS } from "../utils/config";
import './Marketplace.css';


export default function Marketplace() {
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [allProperties, setAllProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyDetails, setPropertyDetails] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          PROPERTY_MANAGER_ADDRESS,
          PropertyManagerABI.abi,
          signer
        );
        const address = await signer.getAddress();
        
        setSigner(signer);
        setAccount(address);
        setContract(contract);
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
      setContract(new ethers.Contract(
        PROPERTY_MANAGER_ADDRESS,
        PropertyManagerABI.abi,
        signer
      ));
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
    } catch (error) {
      console.error("Error loading all properties:", error);
    } finally {
      setIsLoading(false);
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
      
      const details = {
        name: property.name,
        symbol,
        tokenAddress: property.tokenAddress,
        metadataURI: property.metadataURI,
        totalSupply: formattedSupply,
        decimals,
        myBalance,
        owner
      };
      
      console.log("Property details:", details);
      setPropertyDetails(details);
    } catch (error) {
      console.error("Error loading property details:", error);
      setPropertyDetails(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load all properties when contract is available
  useEffect(() => {
    if (contract) {
      loadAllProperties();
    }
  }, [contract]);

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
              {allProperties.map((property, index) => (
                <div 
                  key={index} 
                  className={`property-card ${selectedProperty?.tokenAddress === property.tokenAddress ? 'selected' : ''}`}
                  onClick={() => loadPropertyDetails(property)}
                >
                  <div className="property-card-image">
                    {/* Placeholder image - in a real app you might fetch from IPFS */}
                    <div className="placeholder-image">{property.name.charAt(0)}</div>
                  </div>
                  <div className="property-card-content">
                  <h4 className="property-title">{property.name}</h4>
                    <p className="token-address">
                      {property.tokenAddress.substring(0, 6)}...{property.tokenAddress.substring(property.tokenAddress.length - 4)}
                    </p>
                  </div>
                </div>
              ))}
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
              
              <div className="detail-row">
                <span className="detail-label">Metadata:</span>
                <span className="detail-value">{propertyDetails.metadataURI}</span>
              </div>
              
              {/* This button would be used to buy tokens in a real implementation */}
              <button 
                className="buy-button"
                disabled={propertyDetails.owner.toLowerCase() === account.toLowerCase()}
              >
                {propertyDetails.owner.toLowerCase() === account.toLowerCase() 
                  ? "You own this property" 
                  : "Buy Tokens"
                }
              </button>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a property to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}