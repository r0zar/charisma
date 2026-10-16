/* eslint-disable @next/next/no-img-element */

/** A token's logo, or its first letter when it has none */
export function TokenLogo({ src, symbol, size = 28 }: { src?: string; symbol: string; size?: number }) {
  const style = { width: size, height: size };
  if (!src) {
    return (
      <span style={style} className="grid shrink-0 place-items-center rounded-full bg-surface-raised text-[11px] font-bold text-ink-muted">
        {symbol.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" style={style} loading="lazy" className="shrink-0 rounded-full bg-surface-raised object-cover" />;
}
