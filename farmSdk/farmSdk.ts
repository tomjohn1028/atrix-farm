import {
  Address,
  BN,
  Program,
  Provider as AnchorProvider,
} from '@project-serum/anchor';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  ConfirmOptions,
  Transaction,
  Signer,
} from '@solana/web3.js';
import type { Provider } from '@saberhq/solana-contrib';
import {
  DEFAULT_PROVIDER_OPTIONS,
  TransactionEnvelope,
} from '@saberhq/solana-contrib';
import { getOrCreateATA } from '@saberhq/token-utils';
import { FARM_ADDRESS, FARM_IDL } from './constants';
import {
  findCropAddress,
  findFarmAddress,
  findHarvesterAddress,
  findStakerAddress,
} from './pda';
import { TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import { Crop, Farm, Harvester, Staker } from './types';
import { WRAPPED_SOL_MINT } from '@project-serum/serum/lib/token-instructions';

export class FarmSDK {
  constructor(public readonly provider: any, public readonly program: any) {}

  public static load({
    provider,
    address = FARM_ADDRESS,
    confirmOptions = DEFAULT_PROVIDER_OPTIONS,
  }: {
    provider: Provider;
    address?: Address;
    confirmOptions?: ConfirmOptions;
  }) {
    const anchorProvider = new AnchorProvider(
      provider.connection,
      provider.wallet,
      confirmOptions,
    );
    const farmProgram = new Program(FARM_IDL, address, anchorProvider);
    return new FarmSDK(provider, farmProgram);
  }

  public async fetchFarm(farmKey: PublicKey): Promise<Farm | null> {
    return this.program.account.farmAccount.fetchNullable(farmKey);
  }

  public async fetchStaker(stakerKey: PublicKey): Promise<Staker | null> {
    return this.program.account.stakerAccount.fetchNullable(stakerKey);
  }

  public async fetchCrop(cropKey: PublicKey): Promise<Crop | null> {
    return this.program.account.cropAccount.fetchNullable(cropKey);
  }

  public async fetchHarvester(
    harvesterKey: PublicKey,
  ): Promise<Harvester | null> {
    return this.program.account.harvesterAccount.fetchNullable(harvesterKey);
  }

  public async createFarm({
    stakeMint,
    authority,
  }: {
    stakeMint: PublicKey;
    authority: PublicKey;
  }) {
    const txe = new TransactionEnvelope(this.provider, []);
    const farmBaseKeypair = Keypair.generate();
    const [farmAccount, farmBump] = findFarmAddress(
      farmBaseKeypair.publicKey,
      this.program.programId,
    );
    const { address: farmStakeTokenAccount, instruction: createFarmStakeATA } =
      await getOrCreateATA({
        provider: this.provider,
        mint: stakeMint,
        owner: farmAccount,
      });
    if (createFarmStakeATA) {
      txe.instructions.push(createFarmStakeATA);
    }
    txe.instructions.push(
      this.program.instruction.createFarm(farmBump, {
        accounts: {
          base: farmBaseKeypair.publicKey,
          farmAccount,
          stakeMint,
          farmStakeTokenAccount,
          authority,
          payer: authority,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        },
      }),
    );
    txe.signers.push(farmBaseKeypair);
    return {
      farmAccount,
      farmStakeTokenAccount,
      txe,
    };
  }

  public async createCrop({
    farmKey,
    rewardMint,
    authority,
  }: {
    farmKey: PublicKey;
    rewardMint: PublicKey;
    authority: PublicKey;
  }) {
    const txe = new TransactionEnvelope(this.provider, []);
    const [cropAccount, cropBump] = findCropAddress(
      farmKey,
      rewardMint,
      this.program.programId,
    );
    const {
      address: cropRewardTokenAccount,
      instruction: createCropRewardATA,
    } = await getOrCreateATA({
      provider: this.provider,
      mint: rewardMint,
      owner: cropAccount,
    });
    if (createCropRewardATA) {
      txe.instructions.push(createCropRewardATA);
    }
    txe.instructions.push(
      this.program.instruction.createCrop(cropBump, {
        accounts: {
          farmAccount: farmKey,
          cropAccount,
          rewardMint,
          cropRewardTokenAccount,
          authority,
          payer: authority,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
        },
      }),
    );
    return {
      cropAccount,
      cropRewardTokenAccount,
      txe,
    };
  }

  public async setCropRewardRate({
    farmKey,
    cropKey,
    authority,
    rate,
    farmStakeTokenAccount,
  }: {
    farmKey: PublicKey;
    cropKey: PublicKey;
    authority: PublicKey;
    rate: BN;
    farmStakeTokenAccount?: PublicKey;
  }) {
    const txe = new TransactionEnvelope(this.provider, []);
    if (!farmStakeTokenAccount) {
      const farmAccount: any = await this.program.account.farmAccount.fetch(
        farmKey,
      );
      farmStakeTokenAccount = farmAccount.farmStakeTokenAccount;
    }
    txe.instructions.push(
      this.program.instruction.setCropRewardRate(rate, {
        accounts: {
          farmAccount: farmKey,
          farmStakeTokenAccount,
          cropAccount: cropKey,
          authority,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
      }),
    );
    return txe;
  }

  public async depositCropRewards({
    cropKey,
    authority,
    amount,
    ownerRewardTokenAccount,
    cropRewardTokenAccount,
  }: {
    cropKey: PublicKey;
    authority: PublicKey;
    amount: BN;
    ownerRewardTokenAccount: PublicKey;
    cropRewardTokenAccount?: PublicKey;
  }) {
    const txe = new TransactionEnvelope(this.provider, []);
    if (!cropRewardTokenAccount) {
      const cropAccount: any = await this.program.account.cropAccount.fetch(
        cropKey,
      );
      cropRewardTokenAccount = cropAccount.cropRewardTokenAccount;
    }
    txe.instructions.push(
      this.program.instruction.depositCropRewards(amount, {
        accounts: {
          cropAccount: cropKey,
          authority,
          cropRewardTokenAccount,
          ownerRewardTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }),
    );
    return txe;
  }

  public async createStaker({
    farmKey,
    authority,
    payer,
  }: {
    farmKey: PublicKey;
    authority: PublicKey;
    payer: PublicKey;
  }) {
    const txe = new TransactionEnvelope(this.provider, []);
    const [stakerKey, stakerBump] = findStakerAddress(
      farmKey,
      authority,
      this.program.programId,
    );
    txe.instructions.push(
      this.program.instruction.createStaker(stakerBump, {
        accounts: {
          farmAccount: farmKey,
          stakerAccount: stakerKey,
          authority,
          payer,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        },
      }),
    );
    return {
      stakerKey,
      txe,
    };
  }

  public async createHarvester({
    cropKey,
    authority,
    payer,
    rewardMint,
  }: {
    cropKey: PublicKey;
    authority: PublicKey;
    payer: PublicKey;
    rewardMint: PublicKey;
  }) {
    const txe = new TransactionEnvelope(this.provider, []);
    const [harvesterKey, bump] = findHarvesterAddress(
      cropKey,
      authority,
      this.program.programId,
    );
    txe.instructions.push(
      this.program.instruction.createHarvester(bump, {
        accounts: {
          cropAccount: cropKey,
          harvesterAccount: harvesterKey,
          authority,
          payer,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        },
      }),
    );
    return {
      harvesterKey,
      txe,
    };
  }

  public async findUserCropAccounts({
    farmKey,
    rewardMint,
    authority,
  }: {
    farmKey: PublicKey;
    rewardMint: PublicKey;
    authority: PublicKey;
  }) {
    const [cropAccount] = findCropAddress(
      farmKey,
      rewardMint,
      this.program.programId,
    );
    const { address: cropRewardTokenAccount } = await getOrCreateATA({
      provider: this.provider,
      mint: rewardMint,
      owner: cropAccount,
    });
    const [harvesterAccount] = findHarvesterAddress(
      cropAccount,
      authority,
      this.program.programId,
    );
    const { address: userRewardTokenAccount } = await getOrCreateATA({
      provider: this.provider,
      mint: rewardMint,
      owner: authority,
    });
    return {
      cropAccount,
      cropRewardTokenAccount,
      harvesterAccount,
      userRewardTokenAccount,
    };
  }

  public async cropActionAccs({
    farmKey,
    rewardMint,
    authority,
    userStakeTokenAcc,
  }: {
    farmKey: PublicKey;
    rewardMint: PublicKey;
    authority: PublicKey;
    // todo use, if already have farm stakemint
    stakeMint?: PublicKey;
    // todo or use ATA
    userStakeTokenAcc?: PublicKey;
  }) {
    const farmAccount: any = await this.program.account.farmAccount.fetch(
      farmKey,
    );
    const { address: farmStakeTokenAccount } = await getOrCreateATA({
      provider: this.provider,
      mint: farmAccount.stakeMint,
      owner: farmKey,
    });
    const [stakerKey] = findStakerAddress(
      farmKey,
      authority,
      this.program.programId,
    );
    const userRewardATA = await getOrCreateATA({
      provider: this.provider,
      mint: rewardMint,
      owner: authority,
    });
    const userCropAccounts = await this.findUserCropAccounts({
      farmKey,
      rewardMint,
      authority,
    });

    return {
      userRewardATA,
      accounts: {
        farmAccount: farmKey,
        stakerAccount: stakerKey,
        farmStakeTokenAccount,
        userCropAccounts,
        userStakeTokenAccount: userStakeTokenAcc,
        authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    };
  }

  public async cropActions({
    farmKey,
    rewardMint,
    authority,
    userStakeTokenAcc,
  }: {
    farmKey: PublicKey;
    rewardMint: PublicKey;
    authority: PublicKey;
    // todo use, if already have farm stakemint
    stakeMint?: PublicKey;
    // todo or use ATA
    userStakeTokenAcc?: PublicKey;
  }) {
    const { userRewardATA, accounts: userCropActionAccs } =
      await this.cropActionAccs({
        farmKey,
        rewardMint,
        authority,
        userStakeTokenAcc,
      });

    const addCreateATA = (txe: TransactionEnvelope) => {
      if (userRewardATA.instruction) {
        txe.instructions.push(userRewardATA.instruction);
      }
    };

    const stake = async (amount: BN) => {
      const txe = new TransactionEnvelope(this.provider, []);
      addCreateATA(txe);
      txe.instructions.push(
        this.program.instruction.stake(amount, {
          accounts: userCropActionAccs,
        }),
      );
      return txe;
    };

    const claim = async () => {
      const txe = new TransactionEnvelope(this.provider, []);
      addCreateATA(txe);
      txe.instructions.push(
        this.program.instruction.claim({
          accounts: userCropActionAccs,
        }),
      );
      return txe;
    };

    const unstake = async (amount: BN) => {
      const txe = new TransactionEnvelope(this.provider, []);
      addCreateATA(txe);
      txe.instructions.push(
        this.program.instruction.unstake(amount, {
          accounts: userCropActionAccs,
        }),
      );
      return txe;
    };

    return { stake, claim, unstake };
  }

  public async dualCropActionAccs({
    farmKey,
    rewardMints,
    authority,
    userStakeTokenAcc,
  }: {
    farmKey: PublicKey;
    rewardMints: Array<PublicKey>;
    authority: PublicKey;
    // todo use, if already have farm stakemint
    stakeMint?: PublicKey;
    // todo or use ATA
    userStakeTokenAcc?: PublicKey;
  }) {
    const farmAccount: any = await this.program.account.farmAccount.fetch(
      farmKey,
    );
    const { address: farmStakeTokenAccount } = await getOrCreateATA({
      provider: this.provider,
      mint: farmAccount.stakeMint,
      owner: farmKey,
    });
    const [stakerKey] = findStakerAddress(
      farmKey,
      authority,
      this.program.programId,
    );
    const userRewardATAs = await Promise.all(
      rewardMints.map(rewardMint => {
        return getOrCreateATA({
          provider: this.provider,
          mint: rewardMint,
          owner: authority,
        });
      }),
    );
    const userCropAccounts = await Promise.all(
      rewardMints.map(async (rewardMint, i) =>
        this.findUserCropAccounts({
          farmKey,
          rewardMint,
          authority,
        }),
      ),
    );

    // console.log(
    //   'new',
    //   stringifyPubkeyObj({
    //     farmAccount: farmKey,
    //     stakerAccount: stakerKey,
    //     farmStakeTokenAccount,
    //     userCrop1Accounts: userCropAccounts[0],
    //     userCrop2Accounts: userCropAccounts[1],
    //     userStakeTokenAccount: userStakeTokenAcc,
    //     authority,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //     clock: SYSVAR_CLOCK_PUBKEY,
    //   })
    // );

    return {
      userRewardATAs,
      accounts: {
        farmAccount: farmKey,
        stakerAccount: stakerKey,
        farmStakeTokenAccount,
        userCrop1Accounts: userCropAccounts[0],
        userCrop2Accounts: userCropAccounts[1],
        userStakeTokenAccount: userStakeTokenAcc,
        authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    };
  }

  public async dualCropActions({
    farmKey,
    rewardMints,
    authority,
    userStakeTokenAcc,
  }: {
    farmKey: PublicKey;
    rewardMints: Array<PublicKey>;
    authority: PublicKey;
    // todo or use ATA
    userStakeTokenAcc?: PublicKey;
  }) {
    const { userRewardATAs, accounts: userDualCropActionAccs } =
      await this.dualCropActionAccs({
        farmKey,
        rewardMints,
        authority,
        userStakeTokenAcc,
      });

    const addCreateATA = (txe: TransactionEnvelope) => {
      userRewardATAs.forEach(res => {
        if (res.instruction) {
          txe.instructions.push(res.instruction);
        }
      });
    };

    const stake = async (amount: BN) => {
      const txe = new TransactionEnvelope(this.provider, []);
      addCreateATA(txe);
      txe.instructions.push(
        this.program.instruction.stakeDualCrop(amount, {
          accounts: userDualCropActionAccs,
        }),
      );
      return txe;
    };

    const claim = async () => {
      const txe = new TransactionEnvelope(this.provider, []);
      addCreateATA(txe);
      txe.instructions.push(
        this.program.instruction.claimDualCrop({
          accounts: userDualCropActionAccs,
        }),
      );
      return txe;
    };

    const unstake = async (amount: BN) => {
      const txe = new TransactionEnvelope(this.provider, []);
      addCreateATA(txe);
      txe.instructions.push(
        this.program.instruction.unstakeDualCrop(amount, {
          accounts: userDualCropActionAccs,
        }),
      );
      return txe;
    };

    return { stake, claim, unstake };
  }

  public async fullCropAction({
    farmKey,
    authority,
    userStakeTokenAcc,
    payer,
    action,
    amount,
  }: {
    farmKey: PublicKey;
    authority: PublicKey;
    // todo or use ATA
    userStakeTokenAcc?: PublicKey;
    payer: PublicKey;
    action: 'stake' | 'unstake' | 'claim';
    amount?: BN;
  }) {
    const tx = new Transaction();
    const signers: Array<any> = [];
    const farm = await this.fetchFarm(farmKey);

    if (!farm) throw new Error('Invalid farm' + farmKey.toString());

    const wrappedSolAccount = Keypair.generate();
    const crops = await Promise.all(
      farm.cropAccounts
        .filter(cropKey => !!cropKey)
        .map(cropKey => this.fetchCrop(cropKey)),
    );
    if (!userStakeTokenAcc) {
      // stake mint is SOL
      if (farm.stakeMint.equals(WRAPPED_SOL_MINT)) {
        const { tx: wrapTx, signers: wrapSigners } = await wrapSol(
          this.provider,
          wrappedSolAccount as Keypair,
          amount ?? Z_BN,
        );
        tx.add(wrapTx);
        signers.push(...wrapSigners);
        userStakeTokenAcc = wrappedSolAccount.publicKey;
      }
      // stake mint is normal SPL token
      else {
        const { address: userStakeATA, instruction: createStakeATAIx } =
          await getOrCreateATA({
            provider: this.provider,
            owner: authority,
            payer,
            mint: farm.stakeMint,
          });
        userStakeTokenAcc = userStakeATA;
        if (createStakeATAIx) {
          console.log('creating stake ata');
          tx.add(createStakeATAIx);
        }
      }
    }

    const { stakerKey, txe: createStakerTxe } = await this.createStaker({
      farmKey,
      authority,
      payer,
    });
    const staker = await this.fetchStaker(stakerKey);
    if (!staker) {
      console.log('creating stakr');
      tx.add(createStakerTxe.build());
    }

    for (let i = 0; i < crops.length; i++) {
      const crop = crops[i];
      if (!crop) continue;
      const cropKey = farm.cropAccounts[i];
      const { harvesterKey, txe: createHarvesterTxe } =
        await this.createHarvester({
          cropKey,
          authority,
          payer,
          rewardMint: crop.rewardMint,
        });
      const harvester = await this.fetchHarvester(harvesterKey);
      if (!harvester) {
        console.log('creating harvester', i);
        tx.add(createHarvesterTxe.build());
      }
    }

    if (crops.length === 1) {
      const txe = await (
        await this.cropActions({
          farmKey,
          rewardMint: crops[0]?.rewardMint!,
          authority,
          userStakeTokenAcc,
        })
      )[action](amount!);
      tx.add(txe.build());
    } else if (crops.length === 2) {
      const txe = await (
        await this.dualCropActions({
          farmKey,
          rewardMints: crops.map(crop => crop!.rewardMint),
          authority,
          userStakeTokenAcc,
        })
      )[action](amount!);
      tx.add(txe.build());
    } else {
      throw new Error('Invalid crops length ' + crops.length);
    }

    if (farm.stakeMint.equals(WRAPPED_SOL_MINT)) {
      const { tx: unwrapTx, signers: unwrapSigners } = unwrapSol(
        this.provider,
        wrappedSolAccount as Keypair,
      );
      tx.add(unwrapTx);
      signers.push(...unwrapSigners);
    }

    return tx;
  }
}

async function wrapSol(
  provider: Provider,
  wrappedSolAccount: Keypair,
  amount: BN,
): Promise<{ tx: Transaction; signers: Array<Signer | undefined> }> {
  const tx = new Transaction();
  const signers = [wrappedSolAccount];
  // Create new, rent exempt account.
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: wrappedSolAccount.publicKey,
      lamports:
        unsafeBNtoNum(amount) +
        (await Token.getMinBalanceRentForExemptAccount(provider.connection)),
      space: 165,
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  tx.add(
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      WRAPPED_SOL_MINT,
      wrappedSolAccount.publicKey,
      provider.wallet.publicKey,
    ),
  );

  return { tx, signers };
}

function unwrapSol(
  provider: Provider,
  wrappedSolAccount: Keypair,
): { tx: Transaction; signers: Array<Signer | undefined> } {
  const tx = new Transaction();
  tx.add(
    Token.createCloseAccountInstruction(
      TOKEN_PROGRAM_ID,
      wrappedSolAccount.publicKey,
      provider.wallet.publicKey,
      provider.wallet.publicKey,
      [],
    ),
  );
  return { tx, signers: [] };
}

const Z_BN = new BN(0);
const unsafeBNtoNum = (bn: BN) => Number(bn.toString());
