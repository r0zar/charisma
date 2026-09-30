/** Sats per ZEST (or any sats amount) for display; plain module so server pages and share images can use it too */
export const formatSats = (sats: number) => `${sats.toLocaleString('en-US', { maximumFractionDigits: sats < 1000 ? 1 : 0 })} sats`;
