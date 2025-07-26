import 'dotenv/config';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const wallet = new ethers.Wallet(process.env.ETH_WALLET_PRIVATE_KEY, provider);

const main = async () => {
  console.log('--- ETH TESTNET ---');
  console.log('Addr:', await wallet.getAddress());
  console.log('Chain ID:', (await provider.getNetwork()).chainId);
  console.log('Block:', await provider.getBlockNumber());
  console.log('Balance (ETH):', ethers.formatEther(await provider.getBalance(wallet.address)));
};

main().catch(console.error); 