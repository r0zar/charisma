import { stringAsciiCV, uintCV, tupleCV } from "@stacks/transactions";

export const BLAZE_V1_DOMAIN = tupleCV({
    name: stringAsciiCV('BLAZE_PROTOCOL'),
    version: stringAsciiCV('v1.0'),
    'chain-id': uintCV(1),
});

// Constants
export const MULTIHOP_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9";
export const BLAZE_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1";

// Token constants for STX handling
export const STX_CONTRACT_ID = ".stx";
export const WRAPPED_STX_CONTRACT_ID = "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx";

export const DEFAULT_ROUTER_CONFIG = {
    routerAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    routerName: 'x-multihop-rc9'
};