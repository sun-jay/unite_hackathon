import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Testing HTLC on Sepolia testnet...");

  // Contract addresses from deployment
  const HTLC_ADDRESS = "0x3C8eEe8729F93c23813b3E20AC3B625e30Dd1152";
  const TEST_TOKEN_ADDRESS = "0xC8BF4b7211e838F2DD80c8d341CC8A9C9e22Be77";

  const [signer] = await ethers.getSigners();
  console.log("📝 Testing with account:", await signer.getAddress());

  // Connect to deployed contracts
  const htlc = await ethers.getContractAt("HTLC", HTLC_ADDRESS);
  const testToken = await ethers.getContractAt("TestToken", TEST_TOKEN_ADDRESS);

  console.log("🔗 Connected to contracts:");
  console.log("├── HTLC:", await htlc.getAddress());
  console.log("└── TestToken:", await testToken.getAddress());

  // Test basic contract interaction
  try {
    // Check if we can call view functions
    const testHashLock = ethers.keccak256(ethers.toUtf8Bytes("test"));
    const lockInfo = await htlc.getLock(testHashLock);
    console.log("✅ HTLC getLock() working - contract is live!");

    // Check TestToken info
    const tokenName = await testToken.name();
    const tokenSymbol = await testToken.symbol();
    console.log(`✅ TestToken working: ${tokenName} (${tokenSymbol})`);

    console.log("\n🎉 Sepolia deployment verification SUCCESSFUL!");
    console.log("🔗 View contracts on Etherscan:");
    console.log(`├── HTLC: https://sepolia.etherscan.io/address/${HTLC_ADDRESS}`);
    console.log(`└── TestToken: https://sepolia.etherscan.io/address/${TEST_TOKEN_ADDRESS}`);

  } catch (error) {
    console.error("❌ Contract interaction failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }); 