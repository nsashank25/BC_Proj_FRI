// scripts/deploy_rental.js

const hre = require("hardhat");

async function main() {
  console.log("Starting PropertyRental deployment...");

  // Get the deployer signer object
  const [deployer] = await hre.ethers.getSigners();
  console.log("Attempting deployment with account:", deployer.address);

  const balanceWei = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balanceWei), "ETH");

  try {
    // First, get the PropertyManager address
    // Note: This assumes PropertyManager has already been deployed
    // You can either hardcode the address here or use a configuration file
    console.log("Getting previously deployed PropertyManager address...");
    
    // Replace this with your actual PropertyManager address or use a config file
    // For demonstration, we'll deploy a new PropertyManager first
    const PropertyManager = await hre.ethers.getContractFactory("PropertyManager");
    console.log("Deploying PropertyManager contract...");
    const propertyManager = await PropertyManager.deploy();
    await propertyManager.waitForDeployment();
    const propertyManagerAddress = await propertyManager.getAddress();
    console.log("✅ PropertyManager deployed at:", propertyManagerAddress);

    // Now deploy the PropertyRental contract
    const PropertyRental = await hre.ethers.getContractFactory("PropertyRental");
    console.log("Deploying PropertyRental contract...");
    
    // Use the PropertyManager address as a constructor parameter
    const propertyRental = await PropertyRental.deploy(propertyManagerAddress);
    console.log("Deployment transaction sent. Contract instance created (pre-mining).");
    
    console.log(`Waiting for deployment to be confirmed...`);

    // Wait for the deployment using waitForDeployment()
    const deployedRental = await propertyRental.waitForDeployment();

    // Log address AFTER waiting
    console.log("✅ PropertyRental deployment confirmed!");
    console.log("   Contract Address:", await deployedRental.getAddress());
    console.log("   Deployed by:", deployer.address);
    console.log("   Connected to PropertyManager at:", propertyManagerAddress);

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