import Link from 'next/link';
import type { TokenPrice } from '@/lib/market';
import { formatPrice } from '@/lib/format';
import { Change } from './change';
import { TokenLogo } from './token-logo';

/** A slow-scrolling strip of the most liquid tokens' prices and 24h change */
export function Ticker({ tokens }: { tokens: TokenPrice[] }) {
  const items = tokens.filter(t => t.type !== 'SUBNET').slice(0, 24);
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-6 pr-6" aria-hidden={hidden || undefined}>
      {items.map(t => (
        <li key={t.contractId}>
          <Link href={`/token/${t.contractId}`} tabIndex={hidden ? -1 : undefined} className="flex items-center gap-1.5 whitespace-nowrap text-xs hover:text-ink">
            <TokenLogo src={t.image} symbol={t.symbol} size={16} />
            <span className="font-semibold text-ink">{t.symbol}</span>
            <span className="tabular-nums text-ink-body">{formatPrice(t.usd)}</span>
            <Change value={t.change['24h']} />
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="ticker group overflow-hidden border-b border-line bg-surface-sunken py-2">
      <div className="ticker-track flex w-max group-hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
