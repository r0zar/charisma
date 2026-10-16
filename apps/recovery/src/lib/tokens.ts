/** The recovery IOUs, the tokens they redeem for, and the engine that pays out (shared by server and browser) */

export const CHARISMA = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
export const ENGINE = `${CHARISMA}.recovery-engine`;
/** Wallets that belong to Charisma: the deployer, the old DAO / bitgear deployer, tearout.btc, and kraqen.btc (an admin who made the IOU pools) */
export const CHARISMA_WALLETS = [
  CHARISMA,
  'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ',
  'SP1WXD5423MC1W0M4NSE9WF03X0561ARFX3Y9AQ3F',
  'SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE',
];

export type IouKey = 'welsh' | 'roo' | 'stx';

export interface RecoveryToken {
  key: IouKey;
  iou: { contractId: string; asset: string; symbol: string; name: string };
  original: { contractId: string; asset: string | null; symbol: string; name: string; image: string };
  /** Base units ever issued. iouWELSH and iouROO were minted once and can only shrink. */
  issued: bigint;
  /** What the IOU stood in for */
  lost: string;
}

export const DECIMALS = 6;

export const TOKENS: RecoveryToken[] = [
  {
    key: 'welsh',
    iou: { contractId: `${CHARISMA}.synthetic-welsh`, asset: 'synthetic-welsh', symbol: 'iouWELSH', name: 'Synthetic Welsh' },
    original: { contractId: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', asset: 'welshcorgicoin', symbol: 'WELSH', name: 'Welshcorgicoin', image: 'https://charisma.rocks/welsh-logo.png' },
    issued: 86943663098322n,
    lost: 'WELSH staked in Charisma',
  },
  {
    key: 'roo',
    iou: { contractId: `${CHARISMA}.synthetic-roo`, asset: 'synthetic-roo', symbol: 'iouROO', name: 'Synthetic Roo' },
    original: { contractId: 'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo', asset: 'kangaroo', symbol: 'ROO', name: 'Kangaroo', image: 'https://charisma.rocks/roo-logo.png' },
    issued: 1176056176569n,
    lost: 'ROO staked in Charisma',
  },
  {
    key: 'stx',
    iou: { contractId: `${CHARISMA}.synthetic-stx`, asset: 'synthetic-stx', symbol: 'synSTX', name: 'Synthetic STX' },
    original: { contractId: '.stx', asset: null, symbol: 'STX', name: 'Stacks', image: 'https://charisma.rocks/stx-logo.png' },
    // Minted to LP holders through lp-index-recovery; 1 synSTX has been burned since
    issued: 114317053502n,
    lost: 'STX in the Velar CHA pools',
  },
];

/** Whole tokens from base units */
export const whole = (units: bigint) => Number(units) / 10 ** DECIMALS;
