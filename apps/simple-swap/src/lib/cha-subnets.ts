import { CHARISMA_SUBNET_V2_CONTRACT_ID } from 'blaze-sdk';
import { fromUnits } from './units';

/**
 * CHA lives in two Blaze subnets during the v2 migration (packages/clarity/contracts/drafts/BLAZE-V2.md):
 * - v1 (charisma-token-subnet-v1): where existing balances are; it keeps working, and is spent first
 * - v2 (charisma-token-subnet-v2): where new deposits and anything paid into the subnet land
 * Swap shows them as one CHA (subnet) entry with one combined balance. The v1 contract id stands for that entry,
 * because that's where people's CHA is today; the real source is picked when something is spent.
 */
export const CHA_SUBNET_V1 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1';
export const CHA_SUBNET_V2 = CHARISMA_SUBNET_V2_CONTRACT_ID;

export const isChaSubnet = (contractId?: string | null) => contractId === CHA_SUBNET_V1 || contractId === CHA_SUBNET_V2;

/** Whether a subnet token should be its own row in pickers and lists: the v2 CHA subnet folds into the v1 row */
export const isListedSubnet = (contractId: string) => contractId !== CHA_SUBNET_V2;

/**
 * How `amount` (base units) of subnet CHA gets paid: from the old subnet first, then the new one, and when neither
 * covers it, wallet CHA tops up v2 (deposits land in v2). Each payment is one signed intent from one subnet, so a
 * balance split across both can't pay for more than either holds; the error says so and points to the upgrade.
 */
export function chaPlan(amount: bigint, freeV1: bigint, freeV2: bigint, wallet = 0n): { source: string; deposit: bigint } {
    if (freeV1 >= amount) return { source: CHA_SUBNET_V1, deposit: 0n };
    if (freeV2 >= amount) return { source: CHA_SUBNET_V2, deposit: 0n };
    if (freeV2 + wallet >= amount) return { source: CHA_SUBNET_V2, deposit: amount - freeV2 };
    if (freeV1 + freeV2 + wallet >= amount) {
        throw new Error('Your subnet CHA is split between Blaze v1 and v2, and neither part covers this amount. Upgrade your v1 CHA to Blaze v2 (free, one signature) and try again.');
    }
    throw new Error(`Not enough CHA: this needs ${fromUnits(amount, 6)} and you have ${fromUnits(freeV1 + freeV2 + wallet, 6)}.`);
}

/** Where CHA paid into the subnet should land: always v2 */
export const chaDestination = () => CHA_SUBNET_V2;
