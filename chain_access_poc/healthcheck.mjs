import 'dotenv/config';
import { ethers } from 'ethers';
import { TronWeb } from 'tronweb';

// ETH Setup
const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const ethWallet = new ethers.Wallet(process.env.ETH_WALLET_PRIVATE_KEY, ethProvider);

// Tron Setup
const tronWeb = new TronWeb({
  fullHost: process.env.TRON_FULLNODE,
  eventServer: process.env.TRON_EVENTSERVER,
  privateKey: process.env.TRON_WALLET_PRIVATE_KEY
});

const checkEthereum = async () => {
  try {
    console.log('🔍 CHECKING ETHEREUM SEPOLIA...');
    const address = await ethWallet.getAddress();
    const network = await ethProvider.getNetwork();
    const blockNumber = await ethProvider.getBlockNumber();
    const balance = await ethProvider.getBalance(ethWallet.address);
    
    console.log('✅ ETH Connection Successful');
    console.log('  Address:', address);
    console.log('  Chain ID:', network.chainId.toString());
    console.log('  Latest Block:', blockNumber);
    console.log('  Balance:', ethers.formatEther(balance), 'ETH');
    return true;
  } catch (error) {
    console.log('❌ ETH Connection Failed:', error.message);
    return false;
  }
};

const checkTron = async () => {
  try {
    console.log('\n🔍 CHECKING TRON NILE...');
    const base58 = tronWeb.address.fromPrivateKey(process.env.TRON_WALLET_PRIVATE_KEY);
    const hex = tronWeb.address.toHex(base58);
    const block = await tronWeb.trx.getCurrentBlock();
    const acct = await tronWeb.trx.getAccount(base58).catch(() => ({}));
    const trx = (acct.balance || 0) / 1e6;
    
    console.log('✅ TRON Connection Successful');
    console.log('  Address (Base58):', base58);
    console.log('  Address (Hex):', hex);
    console.log('  Latest Block:', block.block_header.raw_data.number);
    console.log('  Balance:', trx, 'TRX');
    return true;
  } catch (error) {
    console.log('❌ TRON Connection Failed:', error.message);
    return false;
  }
};

const main = async () => {
  console.log('🚀 CROSS-CHAIN CONNECTIVITY HEALTHCHECK\n');
  
  if (!process.env.ETH_WALLET_PRIVATE_KEY || !process.env.TRON_WALLET_PRIVATE_KEY) {
    console.log('❌ Please configure your .env file with real values!');
    console.log('   Copy .env.example to .env and fill in your details.');
    return;
  }
  
  const ethSuccess = await checkEthereum();
  const tronSuccess = await checkTron();
  
  console.log('\n📊 SUMMARY:');
  console.log('  Ethereum Sepolia:', ethSuccess ? '✅ Ready' : '❌ Failed');
  console.log('  Tron Nile:', tronSuccess ? '✅ Ready' : '❌ Failed');
  
  if (ethSuccess && tronSuccess) {
    console.log('\n🎉 Both chains are ready for cross-chain operations!');
  } else {
    console.log('\n⚠️  Fix connection issues before proceeding.');
  }
};

main().catch(console.error); 