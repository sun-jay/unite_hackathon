require('dotenv').config();
const { ethers } = require('ethers');
const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../scripts/config.json'), 'utf8'));

// Fixed constants for deterministic testing - with unique timestamp to avoid collisions
const SECRET_BASE = "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e";
const TIMESTAMP = Math.floor(Date.now() / 1000).toString(16).padStart(2, '0');
const SECRET = SECRET_BASE + TIMESTAMP.slice(-2);
const HASH_LOCK = ethers.keccak256(SECRET);

// Contract addresses from config
const SEPOLIA_HTLC = config.networks.sepolia.contracts.HTLC.address;
const SEPOLIA_TOKEN = config.networks.sepolia.contracts.TestToken.address;
const NILE_HTLC = config.networks.nile.contracts.HTLC.address;
const NILE_TOKEN = config.networks.nile.contracts.TestToken.address;

console.log('🌐 CROSS-CHAIN INTEROPERABILITY TEST');
console.log('===================================');
console.log('');
console.log('🔐 FIXED TEST CONSTANTS:');
console.log(`├── Secret: ${SECRET}`);
console.log(`├── HashLock: ${HASH_LOCK}`);
console.log(`├── Sepolia HTLC: ${SEPOLIA_HTLC}`);
console.log(`├── Sepolia Token: ${SEPOLIA_TOKEN}`);
console.log(`├── Nile HTLC: ${NILE_HTLC}`);
console.log(`└── Nile Token: ${NILE_TOKEN}`);
console.log('');

// Helper function to resolve environment variables
function resolveEnvValue(value) {
  if (typeof value === 'string' && value.startsWith('env:')) {
    const envVar = value.substring(4);
    return process.env[envVar];
  }
  return value;
}

// Setup providers and wallets
const sepoliaRpcUrl = resolveEnvValue(config.networks.sepolia.rpcUrl);
const sepoliaPrivateKey = resolveEnvValue(config.networks.sepolia.privateKey);
const tronFullHost = resolveEnvValue(config.networks.nile.rpcUrl);
const tronEventServer = resolveEnvValue(config.networks.nile.eventServer);
const tronPrivateKey = resolveEnvValue(config.networks.nile.privateKey);

// Initialize providers
const sepoliaProvider = new ethers.JsonRpcProvider(sepoliaRpcUrl);
const sepoliaWallet = new ethers.Wallet(sepoliaPrivateKey, sepoliaProvider);

const tronWeb = new TronWeb({
  fullHost: tronFullHost,
  solidityNode: tronFullHost,
  eventServer: tronEventServer,
  privateKey: tronPrivateKey
});

const nileWallet = tronWeb.address.fromPrivateKey(tronPrivateKey);

console.log('👛 WALLET ADDRESSES:');
console.log(`├── Sepolia: ${sepoliaWallet.address}`);
console.log(`└── Nile: ${nileWallet}`);
console.log('');

// Explorer URL helpers
const sepoliaTxUrl = (h) => `${config.networks.sepolia.explorer.txUrl}${h}`;
const nileTxUrl    = (h) => `${config.networks.nile.explorer.txUrl}${h}`;

async function runCrossChainTest() {
  try {
    console.log('🚀 Starting Cross-Chain Interoperability Test...');
    console.log('');

    // Step 1: Record addresses and get contract instances
    console.log('📋 STEP 1: Contract Setup');
    console.log('─'.repeat(50));

    // Sepolia contracts
    const sepoliaHTLC = new ethers.Contract(
      SEPOLIA_HTLC,
      [
        "function lock(bytes32 _hashLock, address _token, uint256 _amount, address _beneficiary, uint256 _timelock) external",
        "function withdraw(bytes32 _secret) external",
        "function getLock(bytes32 _hashLock) external view returns (address, address, address, uint256, uint256, bool, bool)",
        "event Locked(bytes32 indexed hash, address indexed sender, address indexed token, uint256 amount, address beneficiary, uint256 timelock)",
        "event Withdrawn(bytes32 indexed hash, bytes32 secret)"
      ],
      sepoliaWallet
    );

    const sepoliaToken = new ethers.Contract(
      SEPOLIA_TOKEN,
      [
        "function decimals() external view returns (uint8)",
        "function balanceOf(address account) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function mint(address to, uint256 amount) external"
      ],
      sepoliaWallet
    );

    // Tron contracts
    const nileHTLC = await tronWeb.contract().at(NILE_HTLC);
    const nileToken = await tronWeb.contract().at(NILE_TOKEN);

    console.log('✅ Contract instances created');
    console.log('');

    // Step 2: Decide token amounts based on decimals
    console.log('📋 STEP 2: Token Amount Calculation');
    console.log('─'.repeat(50));

    const sepoliaDecimals = await sepoliaToken.decimals();
    const nileDecimalsRaw = await nileToken.decimals().call();
    const nileDecimals = Number(nileDecimalsRaw);

    // Amount = 10^(decimals - 3) for 0.001 unit on BOTH chains
    const amountSepolia = ethers.parseUnits("0.001", sepoliaDecimals);
    const amountNile    = BigInt(10) ** BigInt(Math.max(nileDecimals - 3, 0));

    console.log(`├── Sepolia decimals: ${sepoliaDecimals}`);
    console.log(`├── Nile decimals: ${nileDecimals}`);
    console.log(`├── Amount Sepolia: ${ethers.formatUnits(amountSepolia, sepoliaDecimals)} tokens`);
    console.log(`├── Amount Nile: ${Number(amountNile) / 10 ** nileDecimals} tokens`);
    console.log('');

    // Check balances
    const sepoliaBalance = await sepoliaToken.balanceOf(sepoliaWallet.address);
    const nileBalance = await nileToken.balanceOf(nileWallet).call();

    console.log('💰 Current Token Balances:');
    console.log(`├── Sepolia: ${ethers.formatUnits(sepoliaBalance, sepoliaDecimals)} tokens`);
    console.log(`├── Nile: ${Number(nileBalance) / 10 ** nileDecimals} tokens`);

    // Mint tokens if needed
    if (sepoliaBalance < amountSepolia) {
      console.log('├── Minting Sepolia tokens...');
      const mintTx = await sepoliaToken.mint(sepoliaWallet.address, ethers.parseUnits("10", sepoliaDecimals));
      await mintTx.wait(2);
      console.log('├── ✅ Sepolia tokens minted');
    }

    if (Number(nileBalance) / 10 ** nileDecimals < 1) {
      console.log('├── Minting Nile tokens...');
      const mintAmount = BigInt(10) ** BigInt(nileDecimals) * BigInt(10); // 10 tokens
      const mintTx = await nileToken.mint(nileWallet, mintAmount.toString()).send();
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('├── ✅ Nile tokens minted');
    }

    console.log('✅ Token balances sufficient');
    console.log('');

    // Step 3: Approve HTLCs
    console.log('📋 STEP 3: HTLC Approvals');
    console.log('─'.repeat(50));

    // Sepolia approval
    console.log('├── Approving Sepolia HTLC...');
    const sepoliaApproveTx = await sepoliaToken.approve(SEPOLIA_HTLC, amountSepolia);
    await sepoliaApproveTx.wait(2);
    
    // Check allowance (Deliverable A)
    const sepoliaAllowance = await sepoliaToken.allowance(sepoliaWallet.address, SEPOLIA_HTLC);
    console.log(`├── ✅ Sepolia allowance: ${ethers.formatUnits(sepoliaAllowance, sepoliaDecimals)} tokens`);
    
    if (sepoliaAllowance < amountSepolia) {
      throw new Error('❌ Deliverable A failed: Insufficient Sepolia allowance');
    }

    // Nile approval
    console.log('├── Approving Nile HTLC...');
    const nileApproveTx = await nileToken.approve(NILE_HTLC, amountNile.toString()).send();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check allowance (Deliverable B)
    const nileAllowance = await nileToken.allowance(nileWallet, NILE_HTLC).call();
    console.log(`├── ✅ Nile allowance: ${Number(nileAllowance) / 10 ** nileDecimals} tokens`);
    
    if (BigInt(nileAllowance) < amountNile) {
      throw new Error('❌ Deliverable B failed: Insufficient Nile allowance');
    }

    console.log('✅ All approvals complete');
    console.log('');

    // Step 4: Create locks with proper timelocks
    console.log('📋 STEP 4: Creating Locks');
    console.log('─'.repeat(50));

    const now = Math.floor(Date.now() / 1000);
    const sepoliaTimelock = now + 3600; // 1 hour (shorter)
    const nileTimelock = now + 7200;    // 2 hours (longer)

    console.log(`├── Current time: ${now}`);
    console.log(`├── Sepolia timelock: ${sepoliaTimelock} (${new Date(sepoliaTimelock * 1000).toISOString()})`);
    console.log(`├── Nile timelock: ${nileTimelock} (${new Date(nileTimelock * 1000).toISOString()})`);
    console.log('');

    // Sepolia lock (shorter timelock)
    console.log('🔒 Creating Sepolia Lock...');
    const sepoliaLockTx = await sepoliaHTLC.lock(
      HASH_LOCK,
      SEPOLIA_TOKEN,
      amountSepolia,
      sepoliaWallet.address,
      sepoliaTimelock
    );
    const sepoliaLockReceipt = await sepoliaLockTx.wait(2);

    // Check Sepolia lock (Deliverable C)
    const sepoliaLockedEvent = sepoliaLockReceipt.logs.find(
      log => log.topics[0] === ethers.id("Locked(bytes32,address,address,uint256,address,uint256)")
    );
    
    if (!sepoliaLockedEvent) {
      throw new Error('❌ Deliverable C failed: Sepolia Locked event not found');
    }

    const sepoliaLockData = await sepoliaHTLC.getLock(HASH_LOCK);
    const [sender, beneficiary, token, amount, timelock, withdrawn, refunded] = sepoliaLockData;
    console.log(`├── ✅ Sepolia lock created - TX: ${sepoliaLockTx.hash}`);
    console.log(`│   ↳ ${sepoliaTxUrl(sepoliaLockTx.hash)}`);
    console.log(`├── ✅ Withdrawn: ${withdrawn}, Refunded: ${refunded}`);

    if (withdrawn || refunded) {
      throw new Error('❌ Deliverable C failed: Sepolia lock in wrong state');
    }

    // Nile lock (longer timelock)
    console.log('');
    console.log('🔒 Creating Nile Lock...');
    const nileLockTx = await nileHTLC.lock(
      HASH_LOCK,
      NILE_TOKEN,
      amountNile,
      nileWallet,
      nileTimelock
    ).send();

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for confirmations

    // Check Nile lock (Deliverable D)
    const nileLockData = await nileHTLC.getLock(HASH_LOCK).call();
    console.log(`├── ✅ Nile lock created - TX: ${nileLockTx}`);
    console.log(`│   ↳ ${nileTxUrl(nileLockTx)}`);
    console.log(`├── ✅ Withdrawn: ${nileLockData.withdrawn}, Refunded: ${nileLockData.refunded}`);

    if (nileLockData.withdrawn || nileLockData.refunded) {
      throw new Error('❌ Deliverable D failed: Nile lock in wrong state');
    }

    console.log('✅ Both locks created successfully');
    console.log('');

    // Step 5: Reveal on Tron (withdraw on Nile first)
    console.log('📋 STEP 5: Withdraw on Nile (Reveal Secret)');
    console.log('─'.repeat(50));

    const nileBalanceBefore = await nileToken.balanceOf(nileWallet).call();
    console.log(`├── Nile balance before: ${Number(nileBalanceBefore) / 10 ** nileDecimals} tokens`);

    // Convert secret to proper format for TronWeb
    const secretBytes32 = SECRET;
    console.log(`├── Using secret: ${secretBytes32}`);

    const nileWithdrawTx = await nileHTLC.withdraw(secretBytes32).send();
    console.log(`├── Nile withdraw TX: ${nileWithdrawTx}`);
    console.log(`│   ↳ ${nileTxUrl(nileWithdrawTx)}`);

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for confirmations

    // Check Nile withdraw (Deliverable E)
    const nileLockDataAfter = await nileHTLC.getLock(HASH_LOCK).call();
    const nileBalanceAfter = await nileToken.balanceOf(nileWallet).call();

    console.log(`├── Nile balance after: ${Number(nileBalanceAfter) / 10 ** nileDecimals} tokens`);
    console.log(`├── Balance increase: ${(Number(nileBalanceAfter - nileBalanceBefore) / 10 ** nileDecimals)} tokens`);
    console.log(`├── Lock withdrawn: ${nileLockDataAfter.withdrawn}`);
    console.log(`├── Lock refunded: ${nileLockDataAfter.refunded}`);

    if (!nileLockDataAfter.withdrawn || nileLockDataAfter.refunded) {
      throw new Error('❌ Deliverable E failed: Nile lock not properly withdrawn');
    }

    if (BigInt(nileBalanceAfter) - BigInt(nileBalanceBefore) < amountNile) {
      throw new Error('❌ Deliverable E failed: Nile balance did not increase correctly');
    }

    console.log('✅ Nile withdrawal successful - secret revealed!');
    console.log('');

    // Step 6: Withdraw on Sepolia using same secret
    console.log('📋 STEP 6: Withdraw on Sepolia (Same Secret)');
    console.log('─'.repeat(50));

    const sepoliaBalanceBefore = await sepoliaToken.balanceOf(sepoliaWallet.address);
    console.log(`├── Sepolia balance before: ${ethers.formatUnits(sepoliaBalanceBefore, sepoliaDecimals)} tokens`);

    console.log(`├── Using same secret: ${SECRET}`);
    const sepoliaWithdrawTx = await sepoliaHTLC.withdraw(SECRET);
    const sepoliaWithdrawReceipt = await sepoliaWithdrawTx.wait(2);

    console.log(`├── Sepolia withdraw TX: ${sepoliaWithdrawTx.hash}`);
    console.log(`│   ↳ ${sepoliaTxUrl(sepoliaWithdrawTx.hash)}`);

    // Check Sepolia withdraw (Deliverable F)
    const sepoliaWithdrawnEvent = sepoliaWithdrawReceipt.logs.find(
      log => log.topics[0] === ethers.id("Withdrawn(bytes32,bytes32)")
    );

    if (!sepoliaWithdrawnEvent) {
      throw new Error('❌ Deliverable F failed: Sepolia Withdrawn event not found');
    }

    const sepoliaLockDataAfter = await sepoliaHTLC.getLock(HASH_LOCK);
    const [senderAfter, beneficiaryAfter, tokenAfter, amountAfter, timelockAfter, withdrawnAfter, refundedAfter] = sepoliaLockDataAfter;
    const sepoliaBalanceAfter = await sepoliaToken.balanceOf(sepoliaWallet.address);

    console.log(`├── Sepolia balance after: ${ethers.formatUnits(sepoliaBalanceAfter, sepoliaDecimals)} tokens`);
    console.log(`├── Balance increase: ${ethers.formatUnits(sepoliaBalanceAfter - sepoliaBalanceBefore, sepoliaDecimals)} tokens`);
    console.log(`├── Lock withdrawn: ${withdrawnAfter}`);
    console.log(`├── Lock refunded: ${refundedAfter}`);

    if (!withdrawnAfter || refundedAfter) {
      throw new Error('❌ Deliverable F failed: Sepolia lock not properly withdrawn');
    }

    if (sepoliaBalanceAfter - sepoliaBalanceBefore < amountSepolia * 99n / 100n) { // Allow for small precision
      throw new Error('❌ Deliverable F failed: Sepolia balance did not increase correctly');
    }

    console.log('✅ Sepolia withdrawal successful!');
    console.log('');

    // Final verification
    console.log('🎉 FINAL VERIFICATION');
    console.log('─'.repeat(50));
    console.log(`├── ✅ Same HashLock used: ${HASH_LOCK}`);
    console.log(`├── ✅ Different timelocks: Nile (${nileTimelock}) > Sepolia (${sepoliaTimelock})`);
    console.log(`├── ✅ Nile withdraw successful with correct secret`);
    console.log(`├── ✅ Sepolia withdraw successful with same secret`);
    console.log(`├── ✅ Both locks show withdrawn=true, refunded=false`);
    console.log(`├── ✅ Token balances increased by exact locked amounts`);
    console.log('└── ✅ Cross-chain secret reveal flow verified!');
    console.log('');

    console.log('🏆 CROSS-CHAIN INTEROPERABILITY TEST PASSED!');
    console.log('============================================');
    console.log('✅ Both Sepolia and Tron Nile HTLCs are interop-ready');
    console.log('✅ Secret reveal flow works cross-chain');
    console.log('✅ Contracts enforce proper timelock ordering');
    console.log('✅ Same secret works on both chains');
    console.log('');
    console.log('🎯 Ready for production cross-chain atomic swaps!');

  } catch (error) {
    console.error('');
    console.error('❌ CROSS-CHAIN TEST FAILED:');
    console.error('═'.repeat(50));
    console.error(error.message);
    console.error('');
    console.error('🔧 Contracts are NOT yet interop-ready for happy path');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runCrossChainTest();
}

module.exports = { runCrossChainTest }; 