import 'dotenv/config';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const wallet = new ethers.Wallet(process.env.ETH_WALLET_PRIVATE_KEY, provider);

const main = async () => {
  console.log('--- ETH TEST TRANSACTION ---');
  console.log('From:', await wallet.getAddress());
  
  const tx = await wallet.sendTransaction({ 
    to: await wallet.getAddress(), 
    value: 0n 
  });
  
  console.log('ETH tx:', tx.hash);
  console.log('Waiting for confirmation...');
  
  await tx.wait();
  console.log('Transaction confirmed!');
  console.log('View on Sepolia Etherscan: https://sepolia.etherscan.io/tx/' + tx.hash);
};

main().catch(console.error); 