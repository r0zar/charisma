const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

/**
 * A price with about 4 significant digits. Tiny prices fold their leading zeros into a subscript count,
 * so 0.000001437 reads $0.0₅1437.
 */
export function formatPrice(n: number, prefix = '$'): string {
  if (!Number.isFinite(n)) return '—';
  if (n < 0) return '−' + formatPrice(-n, prefix);
  if (n >= 1000) return prefix + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n === 0) return `${prefix}0`;
  let zeros = Math.floor(-Math.log10(n));
  let sig = Math.round(n * 10 ** (zeros + 4));
  if (sig >= 10000) { zeros -= 1; sig = Math.round(sig / 10); }
  const digits = sig.toString().replace(/0+$/, '') || '0';
  if (zeros < 4) return `${prefix}0.${'0'.repeat(zeros)}${digits}`;
  const count = String(zeros).split('').map(d => SUBSCRIPT[Number(d)]).join('');
  return `${prefix}0.0${count}${digits}`;
}

/** $1.65M, $612K, $940 */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return '$' + n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: n >= 1000 ? 2 : 0 });
}

/** +2.12%, -0.63%, or — when unknown */
export function formatChange(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—';
  const abs = Math.abs(pct);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

/** sBTC price as sats per token */
export function formatSats(sbtc: number): string {
  const sats = sbtc * 1e8;
  const text = sats >= 100 ? sats.toLocaleString('en-US', { maximumFractionDigits: sats >= 10000 ? 0 : 1 }) : formatPrice(sats, '');
  return `${text} sats`;
}

/** "12s ago", "4m ago", "3h ago" */
export function formatAge(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** SP2ZNG…Z55KS.charisma-token → SP2Z…55KS.charisma-token */
export const shortId = (id: string) => {
  const [addr, name] = id.split('.');
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}.${name}` : id;
};
