/** Display helpers for base-unit amounts. */

/** "1,234.5" from base units; compact ("12.3K") above 10,000 when `compact` */
export function formatUnits(base: string | number | bigint, decimals = 6, compact = false): string {
    const n = Number(base) / 10 ** decimals;
    if (compact && Math.abs(n) >= 10_000) {
        return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
    }
    // Instant balances can go below zero (orders promising more than the wallet holds): size the digits by magnitude
    const size = Math.abs(n);
    return n.toLocaleString(undefined, { maximumFractionDigits: size >= 100 ? 0 : size >= 1 ? 2 : 6 });
}

/** whole CHA → micro-CHA, or null when the text isn't a positive number */
export function toMicro(text: string, decimals = 6): bigint | null {
    if (!/^\d*\.?\d*$/.test(text.trim()) || !text.trim() || text.trim() === '.') return null;
    const [whole, frac = ''] = text.trim().split('.');
    const value = BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
    return value > 0n ? value : null;
}

/** "2d 4h", "3m 05s", "0:42" */
export function formatCountdown(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

export const shortAddress = (a: string, n = 4) => (a.length > n * 2 + 3 ? `${a.slice(0, n)}…${a.slice(-n)}` : a);

export const explorerTx = (txid: string) => `https://explorer.hiro.so/txid/${txid.startsWith('0x') ? txid : `0x${txid}`}?chain=mainnet`;

/** Same-origin URL for a remote token image, so canvases and WebGL textures stay untainted. */
export const proxiedImage = (url: string, width = 128) =>
    url.startsWith('data:') ? url : `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
