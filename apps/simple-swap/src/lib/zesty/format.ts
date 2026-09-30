/**
 * A sats price (sats per ZEST): whole sats, like amounts. Below 100 sats one decimal is kept, so a tiny price
 * doesn't round to a misleading "0 sats". Plain module so server pages and share images can use it too.
 */
export const formatSats = (sats: number) => `${sats.toLocaleString('en-US', { maximumFractionDigits: sats < 100 ? 1 : 0 })} sats`;

/** An amount of sats: whole sats only, since a sat can't be split */
export const formatSatsAmount = (sats: number) => `${Math.round(sats).toLocaleString('en-US')} sats`;
