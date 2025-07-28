const HTLC = artifacts.require("./contracts/tron/HTLC.sol");

module.exports = async function (deployer, network, accounts) {
  console.log('🚀 Simple HTLC deployment to Tron Nile...');
  console.log('📝 Network:', network);
  console.log('📝 Deployer address:', accounts[0]);

  try {
    // Deploy only HTLC first
    console.log('\n🔒 Deploying HTLC...');
    await deployer.deploy(HTLC);
    const htlc = await HTLC.deployed();
    console.log('✅ HTLC deployed to:', htlc.address);
    
    console.log('\n🔗 TronScan URL:');
    console.log(`https://nile.tronscan.org/#/contract/${htlc.address}`);

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    throw error;
  }
}; 