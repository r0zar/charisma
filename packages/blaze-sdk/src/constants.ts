import { stringAsciiCV, uintCV, tupleCV } from "@stacks/transactions";

export const BLAZE_V1_DOMAIN = tupleCV({
    name: stringAsciiCV('BLAZE_PROTOCOL'),
    version: stringAsciiCV('v1.0'),
    'chain-id': uintCV(1),
});

// Constants
/** Router that pays out only to whoever signed the order */
export const MULTIHOP_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1";
/** Earlier router: the submitter chooses the payout address. Used for signatures made for it, and for payouts to others (Twitter triggers). */
export const LEGACY_MULTIHOP_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9";
export const MULTIHOP_CONTRACT_IDS = [MULTIHOP_CONTRACT_ID, LEGACY_MULTIHOP_CONTRACT_ID];
export const BLAZE_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1";

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
