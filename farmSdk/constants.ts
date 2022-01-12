import { PublicKey } from '@solana/web3.js';
import _FARM_IDL from './idl/farm.json';
import { Buffer } from 'buffer';
export const FARM_ADDRESS = new PublicKey(
  'BLDDrex4ZSWBgPYaaH6CQCzkJXWfzCiiur9cSFJT8t3x'
);
export const FARM_IDL = _FARM_IDL as any;
export const FARM_SEED = Buffer.from('atrix-farm');
export const CROP_SEED = Buffer.from('atrix-farm-crop');
export const FARM_STAKE_SEED = Buffer.from('atrix-farm-stake');
export const FARM_HARVESTER_SEED = Buffer.from('atrix-farm-harvester');
