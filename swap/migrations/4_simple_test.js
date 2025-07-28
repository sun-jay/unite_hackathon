const SimpleTest = artifacts.require("./contracts/tron/SimpleTest.sol");

module.exports = async function (deployer, network, accounts) {
  console.log('🧪 Testing simplest contract deployment...');
  console.log('📝 Network:', network);
  console.log('📝 Deployer address:', accounts[0]);

  try {
    console.log('\n🚀 Deploying SimpleTest...');
    await deployer.deploy(SimpleTest);
    const simpleTest = await SimpleTest.deployed();
    console.log('✅ SimpleTest deployed to:', simpleTest.address);
    
    // Test the contract
    const number = await simpleTest.getNumber();
    console.log('🔢 Initial number:', number.toString());
    
    console.log('\n🔗 TronScan URL:');
    console.log(`https://nile.tronscan.org/#/contract/${simpleTest.address}`);

  } catch (error) {
    console.error('❌ Simple deployment failed:', error.message);
    throw error;
  }
}; 