require('dotenv').config();
const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// Load deployment artifacts
const tronArtifacts = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/state/tron.json'), 'utf8'));

// Initialize TronWeb for Nile testnet
const tronWeb = new TronWeb({
  fullHost: process.env.TRON_FULLNODE,
  solidityNode: process.env.TRON_FULLNODE,
  eventServer: process.env.TRON_EVENTSERVER,
  privateKey: process.env.TRON_WALLET_PRIVATE_KEY
});

// Contract addresses from deployment
const HTLC_ADDRESS = tronArtifacts.contracts.HTLC.address;
const TOKEN_ADDRESS = tronArtifacts.contracts.TestToken.address;

console.log('🌐 TRON NILE LIVE TEST BENCH');
console.log('===========================');
console.log(`🔒 HTLC Address: ${HTLC_ADDRESS}`);
console.log(`🪙 Token Address: ${TOKEN_ADDRESS}`);
console.log('');

async function runTestBench() {
  try {
    console.log('🚀 Starting live Tron HTLC test bench...');
    console.log('');

    // Get wallet address
    const walletAddress = tronWeb.address.fromPrivateKey(process.env.TRON_WALLET_PRIVATE_KEY);
    console.log(`📝 Wallet Address: ${walletAddress}`);

    // Get contract instances
    const htlcContract = await tronWeb.contract().at(HTLC_ADDRESS);
    const tokenContract = await tronWeb.contract().at(TOKEN_ADDRESS);

    console.log('✅ Contract instances loaded');
    console.log('');

    // Test 1: Check contract basic info
    console.log('📋 TEST 1: Contract Information');
    console.log('─────────────────────────────────');
    
    try {
      const tokenName = await tokenContract.name().call();
      const tokenSymbol = await tokenContract.symbol().call();
      console.log(`├── Token Name: ${tokenName}`);
      console.log(`├── Token Symbol: ${tokenSymbol}`);
      console.log(`└── ✅ Contract info retrieved successfully`);
    } catch (error) {
      console.log(`└── ❌ Contract info failed: ${error.message}`);
    }
    console.log('');

    // Test 2: Check balances
    console.log('📋 TEST 2: Balance Check');
    console.log('─────────────────────────────────');
    
    try {
      const tokenBalance = await tokenContract.balanceOf(walletAddress).call();
      const trxBalance = await tronWeb.trx.getBalance(walletAddress);
      console.log(`├── Token Balance: ${tronWeb.fromSun(tokenBalance)} TUSD`);
      console.log(`├── TRX Balance: ${tronWeb.fromSun(trxBalance)} TRX`);
      console.log(`└── ✅ Balances retrieved successfully`);
    } catch (error) {
      console.log(`└── ❌ Balance check failed: ${error.message}`);
    }
    console.log('');

    // Test 3: Mint tokens if needed
    console.log('📋 TEST 3: Token Minting');
    console.log('─────────────────────────────────');
    
    try {
      const currentBalance = await tokenContract.balanceOf(walletAddress).call();
      const balanceInTokens = tronWeb.fromSun(currentBalance);
      
      if (balanceInTokens < 100) {
        console.log(`├── Current balance: ${balanceInTokens} TUSD (insufficient)`);
        console.log(`├── Minting 1000 TUSD...`);
        
        const mintTx = await tokenContract.mint(walletAddress, tronWeb.toSun(1000)).send();
        console.log(`├── Mint TX: ${mintTx}`);
        
        // Wait for confirmation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const newBalance = await tokenContract.balanceOf(walletAddress).call();
        console.log(`├── New Balance: ${tronWeb.fromSun(newBalance)} TUSD`);
        console.log(`└── ✅ Tokens minted successfully`);
      } else {
        console.log(`├── Current balance: ${balanceInTokens} TUSD (sufficient)`);
        console.log(`└── ✅ No minting needed`);
      }
    } catch (error) {
      console.log(`└── ❌ Token minting failed: ${error.message}`);
    }
    console.log('');

    // Test 4: Approve HTLC contract
    console.log('📋 TEST 4: Token Approval');
    console.log('─────────────────────────────────');
    
    try {
      const approveAmount = tronWeb.toSun(500);
      console.log(`├── Approving ${tronWeb.fromSun(approveAmount)} TUSD to HTLC...`);
      
      const approveTx = await tokenContract.approve(HTLC_ADDRESS, approveAmount).send();
      console.log(`├── Approve TX: ${approveTx}`);
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const allowance = await tokenContract.allowance(walletAddress, HTLC_ADDRESS).call();
      console.log(`├── Allowance: ${tronWeb.fromSun(allowance)} TUSD`);
      console.log(`└── ✅ Approval successful`);
    } catch (error) {
      console.log(`└── ❌ Approval failed: ${error.message}`);
    }
    console.log('');

    // Test 5: Create HTLC Lock
    console.log('📋 TEST 5: HTLC Lock');
    console.log('─────────────────────────────────');
    
    try {
      // Generate test data
      const secret = "supersecret123";
      const hashLock = tronWeb.sha3(secret);
      const amount = tronWeb.toSun(100);
      const beneficiary = walletAddress; // Use same address for simplicity
      const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      
      console.log(`├── Secret: ${secret}`);
      console.log(`├── Hash Lock: ${hashLock}`);
      console.log(`├── Amount: ${tronWeb.fromSun(amount)} TUSD`);
      console.log(`├── Beneficiary: ${beneficiary}`);
      console.log(`├── Timelock: ${timelock} (${new Date(timelock * 1000).toISOString()})`);
      console.log(`├── Creating lock...`);
      
      const lockTx = await htlcContract.lock(
        hashLock,
        TOKEN_ADDRESS,
        amount,
        beneficiary,
        timelock
      ).send();
      
      console.log(`├── Lock TX: ${lockTx}`);
      console.log(`└── ✅ Lock created successfully`);
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check lock details
      const lockData = await htlcContract.getLock(hashLock).call();
      console.log(`├── Lock verified - Amount: ${tronWeb.fromSun(lockData.amount)} TUSD`);
      console.log('');

      // Test 6: HTLC Withdraw
      console.log('📋 TEST 6: HTLC Withdraw');
      console.log('─────────────────────────────────');
      
      console.log(`├── Withdrawing with secret: ${secret}`);
      
      // Convert secret to proper bytes32 format for TronWeb
      // The contract expects raw bytes padded to 32 bytes
      const secretHex = tronWeb.toHex(secret).substring(2); // Remove 0x prefix
      const paddedSecret = '0x' + secretHex.padEnd(64, '0'); // Pad to 64 hex chars (32 bytes)
      console.log(`├── Secret as bytes32: ${paddedSecret}`);
      
      const withdrawTx = await htlcContract.withdraw(paddedSecret).send();
      console.log(`├── Withdraw TX: ${withdrawTx}`);
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check final balance
      const finalBalance = await tokenContract.balanceOf(walletAddress).call();
      console.log(`├── Final Token Balance: ${tronWeb.fromSun(finalBalance)} TUSD`);
      console.log(`└── ✅ Withdraw successful`);
      
    } catch (error) {
      console.log(`└── ❌ HTLC operations failed: ${error.message}`);
    }
    console.log('');

    console.log('🎉 TEST BENCH COMPLETE!');
    console.log('========================');
    console.log('✅ All tests executed against live Nile contracts');
    console.log(`🔗 View on TronScan: https://nile.tronscan.org/#/address/${walletAddress}`);

  } catch (error) {
    console.error('❌ Test bench failed:', error);
  }
}

// Run the test bench
if (require.main === module) {
  runTestBench();
}

module.exports = { runTestBench }; 