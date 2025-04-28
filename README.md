# BC_Proj_FRI
Fractional Real Estate Investment using Blockchain implemented in Solidity

Steps to Run:
# Deploying the Contracts:

```npx hardhat run scripts/deploy_mp.js --network ganache```

```npx hardhat run scripts/deploy_app.js --network ganache```

# Copy ABIs and Contract Addresses:

```./copy_init.sh``` should copy the ABIs into respective folder in frontend/, manually copy the contract addresses into frontend/src/untils/config.js

# Install node modules:

```npm install```  in both root dir and frontend/

Provided that ganache workspace is active and you have imported the test accounts into MetaMask, running ```npm start``` from frontend/ should let you access the dApp.
