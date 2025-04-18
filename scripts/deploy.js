const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Get the deployer signer object
  const [deployer] = await hre.ethers.getSigners();
  console.log("Attempting deployment with account:", deployer.address);

  // Get the balance using hre.ethers.provider.getBalance(address)
  const balanceWei = await hre.ethers.provider.getBalance(deployer.address);

  // The FIX: Use ethers.formatEther instead of hre.ethers.utils.formatEther
  console.log("Account balance:", hre.ethers.formatEther(balanceWei), "ETH");

  try {
      // Get the contract factory
      const PropertyManager = await hre.ethers.getContractFactory("PropertyManager");
      console.log("Deploying PropertyManager contract...");

      // Start the deployment transaction
      const manager = await PropertyManager.deploy();
      console.log("Deployment transaction sent. Contract instance created (pre-mining).");
      if (manager.deployTransaction) {
          console.log(`   Transaction Hash: ${manager.deployTransaction.hash}`);
      } else {
          console.log("   (Deploy transaction details might not be immediately available)");
      }

      console.log(`Waiting for deployment to be confirmed...`);

      // Wait for the deployment using waitForDeployment()
      const deployedManager = await manager.waitForDeployment();

      // Log address AFTER waiting
      console.log("✅ PropertyManager deployment confirmed!");
      console.log("   Contract Address:", await deployedManager.getAddress());
      console.log("   Deployed by:", deployer.address);

  } catch (error) {
      console.error("💥 Deployment Failed!");
      if (error.transactionHash) {
        console.error("   Transaction Hash:", error.transactionHash);
      }
      console.error("   Error Details:", error);
      console.error("\nCheck Ganache logs (Logs tab in the GUI) for potential revert reasons if the transaction was sent.");
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