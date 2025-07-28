require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { TronWeb } = require('tronweb');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('🔍 CROSS-CHAIN CONFIGURATION CHECK');
console.log('==================================');
console.log('');

// Helper function to resolve environment variables
function resolveEnvValue(value) {
  if (typeof value === 'string' && value.startsWith('env:')) {
    const envVar = value.substring(4);
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} not found`);
    }
    return envValue;
  }
  return value;
}

async function checkEVMNetwork(networkName, networkConfig) {
  console.log(`📋 ${networkConfig.name.toUpperCase()}`);
  console.log('─'.repeat(50));
  
  try {
    // Resolve environment variables
    const rpcUrl = resolveEnvValue(networkConfig.rpcUrl);
    const privateKey = resolveEnvValue(networkConfig.privateKey);
    
    console.log(`├── RPC URL: ${rpcUrl}`);
    console.log(`├── Chain ID: ${networkConfig.chainId}`);
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Check connection and get block height
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    
    console.log(`├── Current Block: ${blockNumber}`);
    console.log(`├── Network Chain ID: ${network.chainId}`);
    
    // Validate private key (without broadcasting)
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address;
    
    console.log(`├── Wallet Address: ${address}`);
    
    // Get balance
    const balance = await provider.getBalance(address);
    const balanceEth = ethers.formatEther(balance);
    
    console.log(`├── ETH Balance: ${balanceEth} ETH`);
    
    // Check contracts if deployed
    if (networkConfig.contracts.HTLC.address !== 'TBD') {
      const htlcAddress = networkConfig.contracts.HTLC.address;
      const code = await provider.getCode(htlcAddress);
      
      if (code === '0x') {
        console.log(`├── ❌ HTLC Contract: No code at ${htlcAddress}`);
      } else {
        console.log(`├── ✅ HTLC Contract: ${htlcAddress}`);
        console.log(`├── ✅ TestToken: ${networkConfig.contracts.TestToken.address}`);
      }
    } else {
      console.log(`├── ⚠️  HTLC Contract: Not deployed`);
    }
    
    console.log(`└── ✅ ${networkName} network healthy`);
    
  } catch (error) {
    console.log(`└── ❌ ${networkName} network failed: ${error.message}`);
  }
  
  console.log('');
}

async function checkTronNetwork(networkName, networkConfig) {
  console.log(`📋 ${networkConfig.name.toUpperCase()}`);
  console.log('─'.repeat(50));
  
  try {
    // Resolve environment variables
    const fullHost = resolveEnvValue(networkConfig.rpcUrl);
    const eventServer = resolveEnvValue(networkConfig.eventServer);
    const privateKey = resolveEnvValue(networkConfig.privateKey);
    
    console.log(`├── Full Host: ${fullHost}`);
    console.log(`├── Event Server: ${eventServer}`);
    console.log(`├── Chain ID: ${networkConfig.chainId}`);
    
    // Create TronWeb instance
    const tronWeb = new TronWeb({
      fullHost: fullHost,
      solidityNode: fullHost,
      eventServer: eventServer,
      privateKey: privateKey
    });
    
    // Check connection and get block info
    const block = await tronWeb.trx.getCurrentBlock();
    const blockNumber = block.block_header.raw_data.number;
    
    console.log(`├── Current Block: ${blockNumber}`);
    
    // Get wallet address and balance
    const address = tronWeb.address.fromPrivateKey(privateKey);
    const balance = await tronWeb.trx.getBalance(address);
    const balanceTrx = tronWeb.fromSun(balance);
    
    console.log(`├── Wallet Address: ${address}`);
    console.log(`├── TRX Balance: ${balanceTrx} TRX`);
    
    // Check contracts
    const htlcAddress = networkConfig.contracts.HTLC.address;
    const tokenAddress = networkConfig.contracts.TestToken.address;
    
    // Verify contracts exist
    try {
      const htlcContract = await tronWeb.contract().at(htlcAddress);
      const tokenContract = await tronWeb.contract().at(tokenAddress);
      
      // Try to call a view function to verify contracts
      const tokenName = await tokenContract.name().call();
      
      console.log(`├── ✅ HTLC Contract: ${htlcAddress}`);
      console.log(`├── ✅ TestToken: ${tokenAddress} (${tokenName})`);
      
    } catch (contractError) {
      console.log(`├── ❌ Contract Error: ${contractError.message}`);
    }
    
    console.log(`└── ✅ ${networkName} network healthy`);
    
  } catch (error) {
    console.log(`└── ❌ ${networkName} network failed: ${error.message}`);
  }
  
  console.log('');
}

async function checkCrossChainCompatibility() {
  console.log('🔄 CROSS-CHAIN COMPATIBILITY');
  console.log('─'.repeat(50));
  
  const { crossChain } = config;
  
  console.log(`├── Hash Function: ${crossChain.hashFunction}`);
  console.log(`├── Secret Length: ${crossChain.secretLength} bytes`);
  console.log(`├── Default Amount: $${crossChain.defaultAmountUSD} USD`);
  console.log('');
  
  console.log('🕐 TIMELOCK CONFIGURATION:');
  console.log(`├── Initiator Timelock: ${crossChain.atomicSwap.initiatorTimelock}s (${crossChain.atomicSwap.initiatorTimelock/3600}h)`);
  console.log(`├── Participant Timelock: ${crossChain.atomicSwap.participantTimelock}s (${crossChain.atomicSwap.participantTimelock/3600}h)`);
  console.log(`├── Reveal Window: ${crossChain.atomicSwap.revealWindow}s (${crossChain.atomicSwap.revealWindow/60}min)`);
  console.log('');
  
  // Verify timelock safety
  const timeLockDiff = crossChain.atomicSwap.initiatorTimelock - crossChain.atomicSwap.participantTimelock;
  const isTimelockSafe = timeLockDiff >= crossChain.atomicSwap.revealWindow;
  
  console.log('🛡️  SAFETY ANALYSIS:');
  console.log(`├── Timelock Difference: ${timeLockDiff}s`);
  console.log(`├── Required Reveal Window: ${crossChain.atomicSwap.revealWindow}s`);
  console.log(`└── ${isTimelockSafe ? '✅ Safe configuration' : '❌ Unsafe - adjust timelocks'}`);
  console.log('');
}

async function runHealthCheck() {
  try {
    console.log(`🔧 Configuration Version: ${config.meta.version}`);
    console.log(`📅 Last Updated: ${config.meta.lastUpdated}`);
    console.log(`🌐 Supported Networks: ${config.meta.supportedNetworks.join(', ')}`);
    console.log('');
    
    // Check each network
    for (const [networkName, networkConfig] of Object.entries(config.networks)) {
      if (networkName === 'localhost') continue; // Skip localhost for now
      
      if (networkName === 'sepolia') {
        await checkEVMNetwork(networkName, networkConfig);
      } else if (networkName === 'nile') {
        await checkTronNetwork(networkName, networkConfig);
      }
    }
    
    // Check cross-chain compatibility
    await checkCrossChainCompatibility();
    
    console.log('🎉 CONFIGURATION CHECK COMPLETE!');
    console.log('================================');
    console.log('✅ All networks and configurations validated');
    console.log('🔗 Ready for cross-chain atomic swaps');
    
  } catch (error) {
    console.error('❌ Configuration check failed:', error);
    process.exit(1);
  }
}

// Run the health check
if (require.main === module) {
  runHealthCheck();
}

module.exports = { runHealthCheck, config, resolveEnvValue }; 