const HTLC = artifacts.require("./contracts/tron/HTLC.sol");
const TestToken = artifacts.require("./contracts/tron/TestToken.sol");
const fs = require('fs');
const path = require('path');

module.exports = async function (deployer, network, accounts) {
  console.log('🚀 Deploying to Tron Nile testnet...');
  console.log('📝 Network:', network);
  console.log('📝 Deployer address:', accounts[0]);

  try {
    // Deploy TestToken first
    console.log('\n📄 Deploying TestToken...');
    await deployer.deploy(TestToken, "Test USD Token", "TUSD");
    const testToken = await TestToken.deployed();
    console.log('✅ TestToken deployed to:', testToken.address);

    // Deploy HTLC
    console.log('\n🔒 Deploying HTLC...');
    await deployer.deploy(HTLC);
    const htlc = await HTLC.deployed();
    console.log('✅ HTLC deployed to:', htlc.address);
    
    // Get current block number as deployment block
    const currentBlock = await web3.eth.getBlockNumber();
    console.log('📊 Deployment block:', currentBlock);

    // Save deployment info
    const deploymentInfo = {
      network: "nile",
      chainId: "0x094a538d", // Nile testnet chain ID
      contracts: {
        HTLC: {
          address: htlc.address,
          contractPath: "contracts/tron/HTLC.sol",
          deployedBlock: currentBlock,
          features: [
            "TRC-20 compatible",
            "Indexed events for relayer filtering", 
            "keccak256 hash locks (EVM compatible)",
            "Strict timelock semantics",
            "Single-use safety mechanisms",
            "Complete access control",
            "ReentrancyGuard protection"
          ]
        },
        TestToken: {
          address: testToken.address,
          contractPath: "contracts/tron/TestToken.sol",
          deployedBlock: currentBlock,
          name: "Test USD Token",
          symbol: "TUSD"
        }
      },
      deployer: accounts[0],
      timestamp: new Date().toISOString(),
      status: "✅ DEPLOYED TO TRON NILE TESTNET",
      notes: "Tron HTLC deployed to Nile. Mirrors EVM HTLC exactly. Same keccak256 hash function."
    };

    // Ensure artifacts/state directory exists
    const artifactsDir = path.join(__dirname, "..", "artifacts", "state");
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Write deployment info
    fs.writeFileSync(
      path.join(artifactsDir, "tron.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log('\n🎉 Tron deployment complete!');
    console.log('📁 Deployment info saved to artifacts/state/tron.json');
    console.log('\n📋 Summary:');
    console.log('├── HTLC:', htlc.address);
    console.log('├── TestToken:', testToken.address);
    console.log('└── Network: Tron Nile');
    console.log('\n🔗 TronScan URLs:');
    console.log(`├── HTLC: https://nile.tronscan.org/#/contract/${htlc.address}`);
    console.log(`└── TestToken: https://nile.tronscan.org/#/contract/${testToken.address}`);

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}; 