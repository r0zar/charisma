import { DECIMALS } from './tokens';

/** Base units → "31.2M", "596K", "8,705.4", "0.25" */
export function amount(units: string | bigint, digits = 2): string {
  const n = Number(BigInt(units)) / 10 ** DECIMALS;
  if (n === 0) return '0';
  if (n >= 100_000) return n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : digits });
}

/** "$8,891", "$12.40", "<$0.01" */
export function usd(n: number): string {
  if (n > 0 && n < 0.01) return '<$0.01';
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 });
}

/** Percent with sensible precision: "1.34%", "0.0009%" */
export function pct(part: bigint, whole: bigint): string {
  if (whole === 0n) return '0%';
  const p = (Number(part) / Number(whole)) * 100;
  return `${p >= 10 ? p.toFixed(1) : p >= 0.1 ? p.toFixed(2) : p > 0 ? p.toPrecision(1) : '0'}%`;
}

export const smaller = (a: bigint, b: bigint) => (a < b ? a : b);

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

/** A price with about 4 significant digits; tiny prices fold leading zeros into a subscript ($0.0₄1434) */
export function price(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : 4 });
  let zeros = Math.floor(-Math.log10(n));
  let sig = Math.round(n * 10 ** (zeros + 4));
  if (sig >= 10000) { zeros -= 1; sig = Math.round(sig / 10); }
  const digits = sig.toString().replace(/0+$/, '') || '0';
  if (zeros < 4) return `$0.${'0'.repeat(zeros)}${digits}`;
  return `$0.0${String(zeros).split('').map(d => SUBSCRIPT[Number(d)]).join('')}${digits}`;
}
