import 'dotenv/config';
import { TronWeb } from 'tronweb';

const tronWeb = new TronWeb({
  fullHost: process.env.TRON_FULLNODE,
  eventServer: process.env.TRON_EVENTSERVER,
  privateKey: process.env.TRON_WALLET_PRIVATE_KEY
});

const main = async () => {
  const base58 = tronWeb.address.fromPrivateKey(process.env.TRON_WALLET_PRIVATE_KEY);
  const hex = tronWeb.address.toHex(base58);
  const block = await tronWeb.trx.getCurrentBlock();
  const acct = await tronWeb.trx.getAccount(base58).catch(() => ({}));
  const trx = (acct.balance || 0) / 1e6;

  console.log('--- TRON NILE ---');
  console.log('Addr (Base58):', base58);
  console.log('Addr (Hex):', hex);
  console.log('Latest block:', block.block_header.raw_data.number);
  console.log('Balance (TRX):', trx);
};

main().catch(console.error); 