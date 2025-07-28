const TestToken = artifacts.require("./contracts/tron/TestToken.sol");

module.exports = async function (deployer, network, accounts) {
  console.log('🪙 Deploying TRC-20 TestToken...');
  console.log('📝 Network:', network);
  console.log('📝 Deployer address:', accounts[0]);

  try {
    console.log('\n📄 Deploying TestToken...');
    await deployer.deploy(TestToken, "Test USD Token", "TUSD");
    const testToken = await TestToken.deployed();
    console.log('✅ TestToken deployed to:', testToken.address);
    
    // Test the token
    const name = await testToken.name();
    const symbol = await testToken.symbol();
    console.log('🏷️  Token:', name, '(' + symbol + ')');
    
    console.log('\n🔗 TronScan URL:');
    console.log(`https://nile.tronscan.org/#/contract/${testToken.address}`);

  } catch (error) {
    console.error('❌ TestToken deployment failed:', error.message);
    throw error;
  }
}; 