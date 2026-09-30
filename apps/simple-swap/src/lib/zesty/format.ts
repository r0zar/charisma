/**
 * A sats price (sats per ZEST), which can have a decimal like any price. Amounts of sats use formatSatsAmount.
 * Plain module so server pages and share images can use it too.
 */
export const formatSats = (sats: number) => `${sats.toLocaleString('en-US', { maximumFractionDigits: sats < 1000 ? 1 : 0 })} sats`;

/** An amount of sats: whole sats only, since a sat can't be split */
export const formatSatsAmount = (sats: number) => `${Math.round(sats).toLocaleString('en-US')} sats`;
