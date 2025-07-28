const HTLC = artifacts.require("./contracts/tron/HTLC.sol");
const TestToken = artifacts.require("./contracts/tron/TestToken.sol");
const fs = require('fs');
const path = require('path');

module.exports = async function (deployer, network, accounts) {
  console.log('🚀 Deploying to LOCAL Tron development network...');
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

    // Save deployment info
    const deploymentInfo = {
      network: "development",
      chainId: "9", // Local Tron development chain ID
      contracts: {
        HTLC: {
          address: htlc.address,
          contractPath: "contracts/tron/HTLC.sol"
        },
        TestToken: {
          address: testToken.address,
          contractPath: "contracts/tron/TestToken.sol",
          name: "Test USD Token",
          symbol: "TUSD"
        }
      },
      deployer: accounts[0],
      timestamp: new Date().toISOString(),
      status: "✅ DEPLOYED TO LOCAL TRON",
      notes: "Local Tron deployment for development and testing."
    };

    // Ensure artifacts/state directory exists
    const artifactsDir = path.join(__dirname, "..", "artifacts", "state");
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Write deployment info
    fs.writeFileSync(
      path.join(artifactsDir, "local-tron.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log('\n🎉 Local Tron deployment complete!');
    console.log('📁 Deployment info saved to artifacts/state/local-tron.json');
    console.log('\n📋 Summary:');
    console.log('├── HTLC:', htlc.address);
    console.log('├── TestToken:', testToken.address);
    console.log('└── Network: Local Tron Development');

  } catch (error) {
    console.error('❌ Local Tron deployment failed:', error);
    throw error;
  }
}; 