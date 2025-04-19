// scripts/deploy_marketplace.js

const hre = require("hardhat");

async function main() {
  console.log("Starting TokenMarketplace deployment...");

  // Get the deployer signer object
  const [deployer] = await hre.ethers.getSigners();
  console.log("Attempting deployment with account:", deployer.address);

  const balanceWei = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balanceWei), "ETH");

  try {
    // Get the contract factory
    const TokenMarketplace = await hre.ethers.getContractFactory("TokenMarketplace");
    console.log("Deploying TokenMarketplace contract...");

    // Start the deployment transaction
    const marketplace = await TokenMarketplace.deploy();
    console.log("Deployment transaction sent. Contract instance created (pre-mining).");
    
    console.log(`Waiting for deployment to be confirmed...`);

    // Wait for the deployment using waitForDeployment()
    const deployedMarketplace = await marketplace.waitForDeployment();

    // Log address AFTER waiting
    console.log("✅ TokenMarketplace deployment confirmed!");
    console.log("   Contract Address:", await deployedMarketplace.getAddress());
    console.log("   Deployed by:", deployer.address);

  } catch (error) {
    console.error("💥 Deployment Failed!");
    console.error("   Error Details:", error);
    process.exit(1);
  }
}

// Standard Hardhat pattern
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script execution failed unexpectedly:", error);
    process.exit(1);
  });