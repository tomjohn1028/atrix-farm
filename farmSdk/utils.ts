import { utils, BN } from '@project-serum/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { sha256 as sha256Sync } from 'js-sha256';

export function getATASync(owner: PublicKey, mint: PublicKey) {
  return findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

const toBuffer = (arr: Buffer | Uint8Array | Array<number>): Buffer => {
  if (arr instanceof Buffer) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  } else {
    return Buffer.from(arr);
  }
};

export function createProgramAddressSync(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey
): PublicKey {
  const MAX_SEED_LENGTH = 32;

  let buffer = Buffer.alloc(0);
  seeds.forEach(function (seed) {
    if (seed.length > MAX_SEED_LENGTH) {
      throw new TypeError(`Max seed length exceeded`);
    }
    buffer = Buffer.concat([buffer, toBuffer(seed)]);
  });
  buffer = Buffer.concat([
    buffer,
    programId.toBuffer(),
    Buffer.from('ProgramDerivedAddress'),
  ]);
  let hash = sha256Sync(new Uint8Array(buffer));
  let publicKeyBytes = new BN(hash, 16).toArray(undefined, 32);
  if (PublicKey.isOnCurve(new Uint8Array(publicKeyBytes))) {
    throw new Error(`Invalid seeds, address must fall off the curve`);
  }
  return new PublicKey(publicKeyBytes);
}

export function findProgramAddressSync(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey
): [PublicKey, number] {
  let nonce = 255;
  let address: PublicKey | undefined;
  while (nonce != 0) {
    try {
      const seedsWithNonce = seeds.concat(Buffer.from([nonce]));
      address = createProgramAddressSync(seedsWithNonce, programId);
    } catch (err) {
      if (err instanceof TypeError) {
        throw err;
      }
      nonce--;
      continue;
    }
    return [address, nonce];
  }
  throw new Error(`Unable to find a viable program address nonce`);
}
