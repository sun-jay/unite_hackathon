import 'dotenv/config';
import { TronWeb } from 'tronweb';

const tronWeb = new TronWeb({ 
  fullHost: process.env.TRON_FULLNODE, 
  privateKey: process.env.TRON_WALLET_PRIVATE_KEY 
});

const main = async () => {
  const addr = tronWeb.address.fromPrivateKey(process.env.TRON_WALLET_PRIVATE_KEY);
  
  console.log('--- TRON TEST TRANSACTION ---');
  console.log('From/To:', addr);
  
  const tx = await tronWeb.trx.sendTransaction(addr, 1); // 1 SUN = 0.000001 TRX
  
  console.log('TRON tx id:', tx.txid);
  console.log('View on Nile Tronscan: https://nile.tronscan.org/#/transaction/' + tx.txid);
};

main().catch(console.error); 