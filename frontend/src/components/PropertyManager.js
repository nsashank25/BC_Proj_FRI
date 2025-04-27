import { useEffect, useState } from "react";
import { ethers } from "ethers";
import PropertyManagerABI from "../contracts/PropertyManager.json";
import PropertyTokenABI from "../contracts/PropertyToken.json"; 
import { PROPERTY_MANAGER_ADDRESS } from "../utils/config";
import './propmng.css';

export default function PropertyManager() {
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState(0);
  const [myProperties, setMyProperties] = useState([]);
  const [propertyBalances, setPropertyBalances] = useState({});
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
        alert("MetaMask is not installed. Please install it to use this app.");
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
      setMyProperties([]);
      setPropertyBalances({});
    } else {
      // Switched accounts
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setSigner(signer);
      setAccount(address);
      const contract = new ethers.Contract(
        PROPERTY_MANAGER_ADDRESS,
        PropertyManagerABI.abi,
        signer
      );
      setContract(contract);
      
      loadMyProperties(contract, address);
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
      
      // Cleanup
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        }
      };
    }
  }, []);

  const createProperty = async () => {
    if (!contract || !signer) return;
    try {
      setIsLoading(true);
      const tx = await contract.createProperty(
        propertyName, 
        symbol, 
        parseInt(supply), 
        "ipfs://metadata"
      );
      
      console.log("Transaction sent:", tx.hash);
      
      await tx.wait();
      alert("Property token created successfully!");
      setPropertyName("");
      setSymbol("");
      setSupply(0);
      
      // Reload properties
      await loadMyProperties(contract, account);
    } catch (error) {
      console.error("Error creating property:", error);
      alert("Failed to create property: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyProperties = async (contractInstance, accountAddress) => {
    const contract = contractInstance || window.contract;
    const account = accountAddress || window.account;
    
    if (!contract || !account) return;
    
    try {
      setIsLoading(true);
      const tokenAddresses = await contract.getMyProperties(account);
      console.log("My token addresses:", tokenAddresses);
      const allProperties = await contract.getAllProperties();
      const myProps = allProperties.filter(prop => 
        tokenAddresses.includes(prop.tokenAddress)
      );
      
      console.log("My properties:", myProps);
      setMyProperties(myProps);
      
      await loadTokenBalances(myProps, account);
    } catch (error) {
      console.error("Error loading my properties:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadTokenBalances = async (properties, accountAddress) => {
    if (!signer || !properties.length) return;
    
    const balances = {};
    
    for (const property of properties) {
      try {
        const tokenContract = new ethers.Contract(
          property.tokenAddress,
          PropertyTokenABI.abi,
          signer
        );
        
        // Get balance of connected account
        const balance = await tokenContract.balanceOf(accountAddress);
        
        // Get token decimals
        const decimals = await tokenContract.decimals();
        
        // Format balance with proper decimals
        balances[property.tokenAddress] = ethers.formatUnits(balance, decimals);
      } catch (error) {
        console.error(`Error loading balance for token ${property.tokenAddress}:`, error);
        balances[property.tokenAddress] = "Error";
      }
    }
    
    console.log("Token balances:", balances);
    setPropertyBalances(balances);
  };

  // Load properties once when contract and account are available
  useEffect(() => {
    if (contract && account) {
      loadMyProperties(contract, account);
    }
  }, [contract, account]);

  if (!isConnected) {
    return (
      <div className="connect-container">
        <h2>Connect your wallet to continue</h2>
        <button onClick={connectWallet}>Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <div className="account-info">
        <h2>Connected Account: {account.substring(0, 6)}...{account.substring(account.length - 4)}</h2>
        <button onClick={() => setIsConnected(false)}>Disconnect</button>
      </div>

      <div className="create-property">
        <h3>Create New Property Token</h3>
        <div className="form-group">
          <label>Property Name:</label>
          <input 
            placeholder="e.g. Luxury Villa" 
            value={propertyName} 
            onChange={(e) => setPropertyName(e.target.value)} 
          />
        </div>
        
        <div className="form-group">
          <label>Token Symbol:</label>
          <input 
            placeholder="e.g. VILLA" 
            value={symbol} 
            onChange={(e) => setSymbol(e.target.value)} 
          />
        </div>
        
        <div className="form-group">
          <label>Total Supply:</label>
          <input 
            placeholder="e.g. 1000" 
            type="number" 
            value={supply} 
            onChange={(e) => setSupply(e.target.value)} 
          />
        </div>
        
        <button onClick={createProperty} disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Property Token"}
        </button>
      </div>

      <div className="properties-list">
        <h3>My Properties</h3>
        <button onClick={() => loadMyProperties(contract, account)} disabled={isLoading}>
          {isLoading ? "Loading..." : "Refresh Properties"}
        </button>
        
        {isLoading ? (
          <p>Loading your properties...</p>
        ) : myProperties.length === 0 ? (
          <p>You don't have any properties yet. Create one to get started!</p>
        ) : (
          <ul>
            {myProperties.map((prop, i) => (
              <li key={i} className="property-item">
                <div className="property-header">
                  <h4>{prop.name}</h4>
                  <span className="token-balance">
                    Balance: {propertyBalances[prop.tokenAddress] || "Loading..."} tokens
                  </span>
                </div>
                <div className="property-details">
                  <p><strong>Token Address:</strong> {prop.tokenAddress}</p>
                  <p><strong>Metadata URI:</strong> {prop.metadataURI}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}