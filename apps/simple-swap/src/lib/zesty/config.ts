/**
 * Zesty trades sBTC against ZEST. Each token lives in the wallet (mainnet) and in Zesty (its subnet token).
 */
export const ZESTY_TOKENS = {
  sbtc: {
    symbol: 'sBTC',
    decimals: 8,
    mainnet: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    subnet: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1',
    asset: 'sbtc-token',
  },
  zest: {
    symbol: 'ZEST',
    decimals: 6,
    mainnet: 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.zest-token',
    subnet: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.zest-token-subnet',
    asset: 'zest',
  },
} as const;

export type ZestyTokenKey = keyof typeof ZESTY_TOKENS;
export type ZestyToken = (typeof ZESTY_TOKENS)[ZestyTokenKey];
