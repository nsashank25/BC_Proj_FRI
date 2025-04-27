const hre = require("hardhat");

async function main() {
  console.log("Starting PropertyRental deployment...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Attempting deployment with account:", deployer.address);

  const balanceWei = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balanceWei), "ETH");

  try {
    console.log("Getting previously deployed PropertyManager address...");
    
    const PropertyManager = await hre.ethers.getContractFactory("PropertyManager");
    console.log("Deploying PropertyManager contract...");
    const propertyManager = await PropertyManager.deploy();
    await propertyManager.waitForDeployment();
    const propertyManagerAddress = await propertyManager.getAddress();
    console.log("PropertyManager deployed at:", propertyManagerAddress);

    const PropertyRental = await hre.ethers.getContractFactory("PropertyRental");
    console.log("Deploying PropertyRental contract...");
    
    const propertyRental = await PropertyRental.deploy(propertyManagerAddress);
    console.log("Deployment transaction sent. Contract instance created (pre-mining).");
    
    console.log(`Waiting for deployment to be confirmed...`);

    const deployedRental = await propertyRental.waitForDeployment();

    console.log("   PropertyRental deployment confirmed!");
    console.log("   Contract Address:", await deployedRental.getAddress());
    console.log("   Deployed by:", deployer.address);
    console.log("   Connected to PropertyManager at:", propertyManagerAddress);

  } catch (error) {
    console.error("   Deployment Failed!");
    console.error("   Error Details:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script execution failed unexpectedly:", error);
    process.exit(1);
  });