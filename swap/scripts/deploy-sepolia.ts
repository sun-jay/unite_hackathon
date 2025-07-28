import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 DEPLOYING TO SEPOLIA TESTNET");
  console.log("===============================");
  console.log("");

  // Get signer
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log(`📝 Deployer address: ${deployerAddress}`);
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();
  
  console.log(`📊 Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`📊 Current Block: ${blockNumber}`);
  console.log("");

  // Deploy TestToken
  console.log("🪙 Deploying TestToken...");
  const TestToken = await ethers.getContractFactory("contracts/evm/TestToken.sol:TestToken");
  const testToken = await TestToken.deploy("Test USD Token", "TUSD");
  await testToken.waitForDeployment();
  
  const testTokenAddress = await testToken.getAddress();
  console.log(`✅ TestToken deployed to: ${testTokenAddress}`);
  
  // Deploy HTLC
  console.log("");
  console.log("🔒 Deploying HTLC...");
  const HTLC = await ethers.getContractFactory("contracts/evm/HTLC.sol:HTLC");
  const htlc = await HTLC.deploy();
  await htlc.waitForDeployment();
  
  const htlcAddress = await htlc.getAddress();
  console.log(`✅ HTLC deployed to: ${htlcAddress}`);
  
  // Wait for additional confirmations
  console.log("");
  console.log("⏳ Waiting for confirmations...");
  const htlcTx = htlc.deploymentTransaction();
  const testTokenTx = testToken.deploymentTransaction();
  
  if (htlcTx) {
    await htlcTx.wait(2); // Wait for 2 confirmations on Sepolia
  }
  if (testTokenTx) {
    await testTokenTx.wait(2);
  }
  
  const finalBlockNumber = await ethers.provider.getBlockNumber();
  console.log(`✅ Confirmations received. Final block: ${finalBlockNumber}`);
  
  // Create artifacts
  const deploymentInfo = {
    network: "sepolia",
    chainId: `0x${network.chainId.toString(16)}`,
    contracts: {
      HTLC: {
        address: htlcAddress,
        contractPath: "contracts/evm/HTLC.sol",
        deploymentTx: htlcTx?.hash || "",
        deployedBlock: htlcTx?.blockNumber || finalBlockNumber,
        features: [
          "ERC-20 compatible", 
          "Indexed events for relayer filtering",
          "keccak256 hash locks (Tron compatible)",
          "Strict timelock semantics",
          "Single-use safety mechanisms",
          "Complete access control",
          "OpenZeppelin SafeERC20 + ReentrancyGuard"
        ]
      },
      TestToken: {
        address: testTokenAddress,
        contractPath: "contracts/evm/TestToken.sol",
        deploymentTx: testTokenTx?.hash || "",
        deployedBlock: testTokenTx?.blockNumber || finalBlockNumber,
        name: "Test USD Token",
        symbol: "TUSD",
        decimals: 18
      }
    },
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    status: "✅ DEPLOYED TO SEPOLIA TESTNET",
    notes: "EVM HTLC deployed to Sepolia. Mirrors Tron HTLC exactly. Same keccak256 hash function.",
    gasUsed: {
      htlc: htlcTx?.gasLimit?.toString() || "estimated",
      testToken: testTokenTx?.gasLimit?.toString() || "estimated"
    }
  };

  // Ensure artifacts directory exists
  const artifactsDir = path.join(__dirname, "../artifacts/state");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Save deployment info
  const artifactPath = path.join(artifactsDir, "sepolia.json");
  fs.writeFileSync(artifactPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("");
  console.log("🎉 SEPOLIA DEPLOYMENT COMPLETE!");
  console.log("================================");
  console.log(`📁 Deployment info saved to artifacts/state/sepolia.json`);
  console.log("");
  console.log("📋 Summary:");
  console.log(`├── 🔒 HTLC: ${htlcAddress}`);
  console.log(`├── 🪙 TestToken: ${testTokenAddress}`);
  console.log(`├── 🌐 Network: Ethereum Sepolia`);
  console.log(`└── 📊 Block: ${finalBlockNumber}`);
  console.log("");
  console.log("🔗 Etherscan URLs:");
  console.log(`├── HTLC: https://sepolia.etherscan.io/address/${htlcAddress}`);
  console.log(`└── TestToken: https://sepolia.etherscan.io/address/${testTokenAddress}`);
  console.log("");
  console.log("🎯 Next steps:");
  console.log("├── Update config.json with these addresses");
  console.log("├── Run npm run config:check to verify");
  console.log("└── Test with live contracts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 