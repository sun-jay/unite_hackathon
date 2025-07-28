require('dotenv').config();
const { TronWeb } = require('tronweb');

// Initialize TronWeb with Nile testnet
const tronWeb = new TronWeb({
  fullHost: process.env.TRON_FULLNODE || 'https://nile.trongrid.io',
  solidityNode: process.env.TRON_FULLNODE || 'https://nile.trongrid.io',
  eventServer: process.env.TRON_EVENTSERVER || 'https://nile.trongrid.io',
  privateKey: process.env.TRON_WALLET_PRIVATE_KEY
});

async function checkWallet() {
  try {
    console.log('🔍 Checking Tron wallet information...');
    
    if (!process.env.TRON_WALLET_PRIVATE_KEY) {
      console.log('❌ TRON_WALLET_PRIVATE_KEY not found in environment');
      return;
    }
    
    // Get the address from private key
    const address = tronWeb.address.fromPrivateKey(process.env.TRON_WALLET_PRIVATE_KEY);
    console.log('📝 Tron Address (Base58):', address);
    
    // Convert to hex format
    const hexAddress = tronWeb.address.toHex(address);
    console.log('📝 Tron Address (Hex):', hexAddress);
    
    // Get account balance
    try {
      const accountInfo = await tronWeb.trx.getAccount(address);
      const balance = accountInfo.balance || 0;
      
      console.log('\n💰 TRX Balance:', (balance / 1000000).toFixed(6), 'TRX');
      
    } catch (error) {
      console.log('⚠️  Could not fetch account balance:', error.message);
    }

    // Get account resources (bandwidth and energy)
    try {
      const resources = await tronWeb.trx.getAccountResources(address);
      
      console.log('\n📊 Account Resources:');
      console.log('  • Free bandwidth limit:', resources.freeNetLimit || 0);
      console.log('  • Staked bandwidth limit:', resources.NetLimit || 0);
      console.log('  • Total bandwidth available:', (resources.freeNetLimit || 0) + (resources.NetLimit || 0));
      console.log('  • Energy limit:', resources.EnergyLimit || 0);
      
      // Show usage if available
      if (resources.freeNetUsed || resources.NetUsed || resources.EnergyUsed) {
        console.log('\n📈 Resource Usage:');
        console.log('  • Bandwidth used:', (resources.freeNetUsed || 0) + (resources.NetUsed || 0));
        console.log('  • Energy used:', resources.EnergyUsed || 0);
      }
      
      const totalBandwidth = (resources.freeNetLimit || 0) + (resources.NetLimit || 0);
      const totalEnergy = resources.EnergyLimit || 0;
      
      if (totalBandwidth === 0 && totalEnergy === 0) {
        console.log('\n⚠️  WARNING: No bandwidth or energy available!');
        console.log('🎁 Get free TRX from Nile faucet:');
        console.log('   https://nileex.io/join/getJoinPage');
        console.log('   Use address:', address);
      } else {
        console.log('\n✅ Resources look good for deployment!');
      }
      
    } catch (error) {
      console.log('\n⚠️  Could not fetch resource info:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkWallet(); 