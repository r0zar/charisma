import { CHARISMA_SUBNET_V2_CONTRACT_ID, SBTC_SUBNET_V2_CONTRACT_ID, SUBNET_V2_OF, WELSH_SUBNET_V2_CONTRACT_ID, knownBlazeVersion, type BlazeVersion } from 'blaze-sdk';
import { fromUnits } from './units';

/**
 * During the Blaze v2 migration (packages/clarity/contracts/drafts/BLAZE-V2.md) every token that had a v1 subnet lives
 * in two subnets (CHA, WELSH and sBTC first; the rest since 2026-10-05):
 * - v1: where existing balances are; it keeps working, and is spent first
 * - v2: where new deposits and anything paid into the subnet land
 * Swap shows each pair as one subnet entry with one combined balance. The v1 contract id stands for that entry,
 * because that's where people's balances are today; the real source is picked when something is spent.
 */
export interface SubnetPair {
    v1: string;
    v2: string;
    symbol: string;
    decimals: number;
    /** Below this much on v1 (base units) the upgrade isn't offered */
    minUpgrade: bigint;
}

const v1Of = (v2: string) => Object.keys(SUBNET_V2_OF).find(v1 => SUBNET_V2_OF[v1] === v2)!;
const pair = (v2: string, symbol: string, decimals: number, minUpgrade: bigint): SubnetPair => ({ v1: v1Of(v2), v2, symbol, decimals, minUpgrade });

export const SUBNET_PAIRS: SubnetPair[] = [
    pair(CHARISMA_SUBNET_V2_CONTRACT_ID, 'CHA', 6, 1_000_000n),
    pair(WELSH_SUBNET_V2_CONTRACT_ID, 'WELSH', 6, 1_000_000n),
    pair(SBTC_SUBNET_V2_CONTRACT_ID, 'sBTC', 8, 1_000n),
    // the upgrade is offered from one whole token on v1
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmt-token-subnet-v2', 'DMT', 6, 1_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.roo-token-subnet-v2', '$ROO', 6, 1_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v2', 'LEO', 6, 1_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.pepe-token-subnet-v2', 'PEPE', 3, 1_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.zest-token-subnet-v2', 'ZEST', 6, 1_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.aeusdc-token-subnet-v2', 'aeUSDC', 6, 1_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.usda-token-subnet-v2', 'USDA', 6, 1_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.usdh-token-subnet-v2', 'USDh', 8, 100_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.susdh-token-subnet-v2', 'sUSDh', 8, 100_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wps-token-subnet-v2', 'WPS', 6, 1_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nope-token-subnet-v2', 'NOT', 0, 1n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.skull-token-subnet-v2', 'SKULL', 6, 1_000_000n),
    pair('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hoot-token-subnet-v2', 'HOOT', 6, 1_000_000n),
];

/** The pair a subnet belongs to, from either side, or null for a subnet with one version */
export const pairOf = (contractId?: string | null) => SUBNET_PAIRS.find(p => p.v1 === contractId || p.v2 === contractId) ?? null;

/** Whether a subnet token should be its own row in pickers and lists: a pair's v2 subnet folds into its v1 row */
export const isListedSubnet = (contractId: string) => !SUBNET_PAIRS.some(p => p.v2 === contractId);

/** The Blaze a subnet row's flame stands for: a pair's one row is its combined balance, which lands in v2 */
export const rowBlazeVersion = (contractId?: string | null): BlazeVersion =>
    !contractId ? 1 : pairOf(contractId) ? 2 : knownBlazeVersion(contractId) ?? 1;

/** Where something paid into `contractId` should land: a pair's v2, else the subnet itself */
export const landingSubnet = (contractId: string) => pairOf(contractId)?.v2 ?? contractId;

/**
 * How `amount` (base units) of a pair gets paid: from the old subnet first, then the new one, and when neither covers
 * it, wallet funds top up v2 (deposits land in v2). Each payment is one signed intent from one subnet, so a balance
 * split across both can't pay for more than either holds; the error says so and points to the upgrade.
 */
export function planSpend(pair: SubnetPair, amount: bigint, freeV1: bigint, freeV2: bigint, wallet = 0n): { source: string; deposit: bigint } {
    if (freeV1 >= amount) return { source: pair.v1, deposit: 0n };
    if (freeV2 >= amount) return { source: pair.v2, deposit: 0n };
    if (freeV2 + wallet >= amount) return { source: pair.v2, deposit: amount - freeV2 };
    if (freeV1 + freeV2 + wallet >= amount) {
        throw new Error(`Your subnet ${pair.symbol} is split between Blaze v1 and v2, and neither part covers this amount. Upgrade your v1 ${pair.symbol} to Blaze v2 (free, one signature) and try again.`);
    }
    throw new Error(`Not enough ${pair.symbol}: this needs ${fromUnits(amount, pair.decimals)} and you have ${fromUnits(freeV1 + freeV2 + wallet, pair.decimals)}.`);
}
