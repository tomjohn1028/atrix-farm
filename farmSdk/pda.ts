import { utils, BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import {
  CROP_SEED,
  FARM_ADDRESS,
  FARM_HARVESTER_SEED,
  FARM_SEED,
  FARM_STAKE_SEED,
} from './constants';
import { sha256 as sha256Sync } from 'js-sha256';
import { findProgramAddressSync } from './utils';

export const findFarmAddress = (
  base: PublicKey,
  programID: PublicKey = FARM_ADDRESS
): [PublicKey, number] => {
  return findProgramAddressSync([FARM_SEED, base.toBytes()], programID);
};

export const findCropAddress = (
  farmKey: PublicKey,
  rewardMint: PublicKey,
  programID: PublicKey = FARM_ADDRESS
): [PublicKey, number] => {
  return findProgramAddressSync(
    [CROP_SEED, farmKey.toBytes(), rewardMint.toBytes()],
    programID
  );
};

export const findStakerAddress = (
  farmKey: PublicKey,
  authority: PublicKey,
  programID: PublicKey = FARM_ADDRESS
): [PublicKey, number] => {
  return findProgramAddressSync(
    [FARM_STAKE_SEED, authority.toBytes(), farmKey.toBytes()],
    programID
  );
};

export const findHarvesterAddress = (
  cropKey: PublicKey,
  authority: PublicKey,
  programID: PublicKey = FARM_ADDRESS
): [PublicKey, number] => {
  return findProgramAddressSync(
    [FARM_HARVESTER_SEED, authority.toBytes(), cropKey.toBytes()],
    programID
  );
};
