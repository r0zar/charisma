import { stringAsciiCV, uintCV, tupleCV } from "@stacks/transactions";

export const BLAZE_V1_DOMAIN = tupleCV({
    name: stringAsciiCV('BLAZE_PROTOCOL'),
    version: stringAsciiCV('v1.0'),
    'chain-id': uintCV(1),
});

/** Blaze v2 signs the same tuple under domain version v2.0, so a v1 signature can never be replayed on v2 */
export const BLAZE_V2_DOMAIN = tupleCV({
    name: stringAsciiCV('BLAZE_PROTOCOL'),
    version: stringAsciiCV('v2.0'),
    'chain-id': uintCV(1),
});

// Constants
/** Router that pays out only to whoever signed the order, for subnets on either Blaze version: the default */
export const MULTIHOP_V2_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2";
/** The v1 router: pays the signer, v1 subnets only. Used for signatures made for it. */
export const MULTIHOP_V1_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1";
export const MULTIHOP_CONTRACT_ID = MULTIHOP_V2_CONTRACT_ID;
/** Earlier router: the submitter chooses the payout address. Used for signatures made for it, and for payouts to others (Twitter triggers). */
export const LEGACY_MULTIHOP_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9";
export const MULTIHOP_CONTRACT_IDS = [MULTIHOP_V2_CONTRACT_ID, MULTIHOP_V1_CONTRACT_ID, LEGACY_MULTIHOP_CONTRACT_ID];
/** Routers that pay only the signer (the router's own check, not the submitter's choice) */
export const SIGNER_ONLY_ROUTERS = [MULTIHOP_V2_CONTRACT_ID, MULTIHOP_V1_CONTRACT_ID];
export const BLAZE_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1";
export const BLAZE_V2_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v2";
/** CHA on Blaze v2, and the sublink that moves CHA in and out of it */
export const CHARISMA_SUBNET_V2_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v2";
export const CHARISMA_SUBLINK_V2_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-sublink-v2";
/** WELSH on Blaze v2, and its sublink */
export const WELSH_SUBNET_V2_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v2";
export const WELSH_SUBLINK_V2_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-sublink-v2";
/** sBTC on Blaze v2, and its sublink */
export const SBTC_SUBNET_V2_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v2";
export const SBTC_SUBLINK_V2_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-sublink-v2";
/** Each Blaze v1 subnet that has a Blaze v2 successor, and that successor */
export const SUBNET_V2_OF: Record<string, string> = {
    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1": CHARISMA_SUBNET_V2_CONTRACT_ID,
    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1": WELSH_SUBNET_V2_CONTRACT_ID,
    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1": SBTC_SUBNET_V2_CONTRACT_ID,
};

// Token constants for STX handling
export const STX_CONTRACT_ID = ".stx";
export const WRAPPED_STX_CONTRACT_ID = "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx";

export const DEFAULT_ROUTER_CONFIG = routerConfigFor(MULTIHOP_CONTRACT_ID);

/** Router config for a router contract id */
export function routerConfigFor(contractId: string) {
    const [routerAddress, routerName] = contractId.split('.');
    return { routerAddress, routerName };
}

/**
 * Most a solver will pay in network fees for one transaction: 0.01 STX. The fee estimator follows the
 * mempool, which spam can push to several STX; confirmed contract calls typically pay ~0.001 STX.
 */
export const MAX_SOLVER_FEE_USTX = 10_000n;
