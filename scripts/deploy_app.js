// scripts/deploy_platform.js
const hre = require("hardhat");
// No need to require 'ethers' separately, use hre.ethers

async function main() {
  console.log("Starting full platform deployment...");

  // Get the deployer signer object
  const [deployer] = await hre.ethers.getSigners();
  console.log("Attempting deployment with account:", deployer.address);

  // Get and log balance using hre.ethers
  const balanceWei = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balanceWei), "ETH"); // Use hre.ethers.formatEther

  let deployedPMAddress = "";
  let deployedMPAddress = "";
  let deployedPRAddress = "";

  try {
      // --- 1. Deploy PropertyManager ---
      const PropertyManager = await hre.ethers.getContractFactory("PropertyManager");
      console.log("Deploying PropertyManager...");
      const propertyManager = await PropertyManager.deploy();
      const deployedPM = await propertyManager.waitForDeployment(); // Wait and get confirmed instance
      deployedPMAddress = await deployedPM.getAddress(); // Get address from confirmed instance
      console.log("✅ PropertyManager deployed to:", deployedPMAddress);

      // --- 2. Deploy TokenMarketplace ---
      // Note: Your current TokenMarketplace constructor doesn't take arguments.
      // If it needed the PropertyManager address later, you would pass it here:
      // const tokenMarketplace = await TokenMarketplace.deploy(deployedPMAddress);
      const TokenMarketplace = await hre.ethers.getContractFactory("TokenMarketplace");
      console.log("Deploying TokenMarketplace...");
      const tokenMarketplace = await TokenMarketplace.deploy();
      const deployedMP = await tokenMarketplace.waitForDeployment();
      deployedMPAddress = await deployedMP.getAddress();
      console.log("✅ TokenMarketplace deployed to:", deployedMPAddress);

      // --- 3. Deploy PropertyRental ---
      const PropertyRental = await hre.ethers.getContractFactory("PropertyRental");
      console.log("Deploying PropertyRental...");
      // **Crucially, pass the PropertyManager address to the constructor**
      const propertyRental = await PropertyRental.deploy(deployedPMAddress);
      const deployedPR = await propertyRental.waitForDeployment();
      deployedPRAddress = await deployedPR.getAddress();
      console.log("✅ PropertyRental deployed to:", deployedPRAddress);


      console.log("\n--- Deployment Summary ---");
      console.log("PropertyManager Address:", deployedPMAddress);
      console.log("TokenMarketplace Address:", deployedMPAddress);
      console.log("PropertyRental Address:", deployedPRAddress);
      console.log("-------------------------");


  } catch (error) {
      console.error("💥 Deployment Failed!");
      if (error.transactionHash) {
        console.error("   Transaction Hash:", error.transactionHash);
      }
      console.error("   Error Details:", error);
      console.error("\nCheck Ganache logs...");
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