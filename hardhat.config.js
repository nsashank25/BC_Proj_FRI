require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.21",
  networks: {
    hardhat: {
      // Default Hardhat network
    },
    ganache: {
      url: "http://127.0.0.1:7545", // Ensure this matches your Ganache RPC Server
      // accounts: array is removed
      chainId: 1337 // Ensure this matches your Ganache Network ID
    }
  }
};