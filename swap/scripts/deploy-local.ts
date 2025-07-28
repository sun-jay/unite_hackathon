import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Deploying HTLC to LOCAL Hardhat network...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log("📝 Deployer address:", deployerAddress);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "ETH");

  // Deploy TestToken first (using fully qualified name for EVM version)
  console.log("\n📄 Deploying EVM TestToken...");
  const TestTokenFactory = await ethers.getContractFactory("contracts/evm/TestToken.sol:TestToken");
  const testToken = await TestTokenFactory.deploy("Test USD Token", "TUSD");
  await testToken.waitForDeployment();
  const testTokenAddress = await testToken.getAddress();
  
  console.log("✅ TestToken deployed to:", testTokenAddress);

  // Deploy HTLC (using fully qualified name for EVM version)
  console.log("\n🔒 Deploying EVM HTLC...");
  const HTLCFactory = await ethers.getContractFactory("contracts/evm/HTLC.sol:HTLC");
  const htlc = await HTLCFactory.deploy();
  await htlc.waitForDeployment();
  const htlcAddress = await htlc.getAddress();

  console.log("✅ HTLC deployed to:", htlcAddress);

  // Get deployment transaction details
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();

  // Save deployment info
  const deploymentInfo = {
    network: "localhost",
    chainId: Number(network.chainId),
    blockNumber: blockNumber,
    contracts: {
      HTLC: {
        address: htlcAddress,
        deploymentBlock: blockNumber,
        contractPath: "contracts/evm/HTLC.sol"
      },
      TestToken: {
        address: testTokenAddress,
        deploymentBlock: blockNumber,
        contractPath: "contracts/evm/TestToken.sol"
      }
    },
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    status: "✅ DEPLOYED TO LOCAL HARDHAT",
    notes: "Local EVM deployment for development and testing."
  };

  // Ensure artifacts/state directory exists
  const artifactsDir = path.join(__dirname, "..", "artifacts", "state");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Write deployment info
  fs.writeFileSync(
    path.join(artifactsDir, "local-evm.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n🎉 Local EVM deployment complete!");
  console.log("📁 Deployment info saved to artifacts/state/local-evm.json");
  console.log("\n📋 Summary:");
  console.log("├── HTLC:", htlcAddress);
  console.log("├── TestToken:", testTokenAddress);
  console.log("└── Network: Local Hardhat (ChainID: 31337)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Local deployment failed:", error);
    process.exit(1);
  }); 