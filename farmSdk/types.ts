import { PublicKey } from '@solana/web3.js';

export type Harvester = {
  authority: PublicKey;
};

export type Staker = {
  authority: PublicKey;
};

export type Farm = {
  authority: PublicKey;
  stakeMint: PublicKey;
  cropAccounts: Array<PublicKey>;
};

export type Crop = {
  authority: PublicKey;
  rewardMint: PublicKey;
};
