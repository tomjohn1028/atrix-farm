import { SolanaProvider } from '@saberhq/solana-contrib';
import { FarmSDK } from './farmSdk/farmSdk';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { BN, Provider } from '@project-serum/anchor';
import Wallet from '@project-serum/sol-wallet-adapter';
import * as anchor from '@project-serum/anchor';

const FARM_PROGRAM = 'BLDDrex4ZSWBgPYaaH6CQCzkJXWfzCiiur9cSFJT8t3x';
const USDT_USDC_FARM_KEY = new PublicKey(
  '7v3wm3Y5AtpS2hDzDe8ZsaRtecbtPU9P4Ci2TCwyL7dE'
);
const ENDPOINT = 'https://solana-api.projectserum.com';
export const connection = new Connection(ENDPOINT);
export const wallet = anchor.Wallet.local();
const provider = new Provider(connection, wallet, { commitment: 'processed' });

const main = async () => {
  const solProvider = SolanaProvider.load({
    connection: provider.connection,
    sendConnection: provider.connection,
    wallet,
    opts: {},
  });
  const sdk = FarmSDK.load({
    provider: solProvider,
    address: FARM_PROGRAM,
  });
  const tx = new Transaction();
  const ix = await sdk.fullCropAction({
    farmKey: USDT_USDC_FARM_KEY,
    action: 'stake',
    authority: wallet.publicKey,
    payer: wallet.publicKey,
    amount: new BN(10_000),
  });
  tx.add(ix);
  const res = await provider.send(tx);
  console.log(res);
};

main();
