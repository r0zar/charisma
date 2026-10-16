import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PriceChart } from '@/components/price-chart';
import { SiteHeader } from '@/components/site-header';
import { Ticker } from '@/components/ticker';
import { CopyButton, TokenLive } from '@/components/token-live';
import { formatCompact, formatPrice } from '@/lib/format';
import { getMarket, getTokenStats } from '@/lib/market';

export const revalidate = 60;
const API = 'https://prices.charisma.rocks/api/v1';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

async function load(id: string) {
  const market = await getMarket();
  const token = market.tokens.find(t => t.contractId === id);
  return { market, token };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { token } = await load(decodeURIComponent((await params).id));
  return token
    ? { title: `${token.symbol} ${formatPrice(token.usd)} · ${token.name} | Charisma Prices`, description: `${token.name} (${token.symbol}) price, charts and history on Stacks.` }
    : { title: 'Token not found | Charisma Prices' };
}

export default async function TokenPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const [{ market, token }, stats] = await Promise.all([load(id), getTokenStats(id)]);
  if (!token) notFound();
  const base = token.type === 'SUBNET' && token.base ? market.tokens.find(t => t.contractId === token.base) : undefined;

  const facts: [string, string][] = [
    ['Liquidity on Charisma', token.liquidityUsd ? formatCompact(token.liquidityUsd) : '—'],
    ['$1 round trip loses', token.roundTripLoss === null ? '—' : `${token.roundTripLoss.toFixed(2)}%`],
    ['All-time high', stats.ath ? `${formatPrice(stats.ath.usd)} · ${day(stats.ath.day)}` : '—'],
    ['All-time low', stats.atl ? `${formatPrice(stats.atl.usd)} · ${day(stats.atl.day)}` : '—'],
    ['Tracked since', stats.since ? day(stats.since) : '—'],
    ['Last priced', new Date(token.updatedAt).toUTCString().slice(5, 22) + ' UTC'],
  ];
  const examples = [
    ['Price now', `${API}/prices/${token.contractId}`],
    ['Hourly candles, last 7 days', `${API}/prices/${token.contractId}/history?interval=1h`],
    ['Daily candles in sBTC, all time', `${API}/prices/${token.contractId}/history?interval=1d&quote=sbtc`],
  ];

  return (
    <>
      <SiteHeader />
      <Ticker tokens={market.tokens} />
      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-5">
        <nav aria-label="Breadcrumb" className="text-xs text-ink-muted"><Link href="/" className="hover:text-ink">Markets</Link> / {token.symbol}</nav>
        <TokenLive initial={token} />
        {base && (
          <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-body">
            This is the Blaze subnet version of <Link href={`/token/${base.contractId}`} className="font-semibold text-accent-text hover:underline">{base.symbol}</Link>. It always trades 1:1 with it, so it shares its price.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <PriceChart token={token.contractId} />
          <aside className="grid min-w-0 grid-cols-1 content-start gap-4">
            <section className="rounded-lg border border-line bg-surface">
              <h2 className="border-b border-line px-3 py-2 text-sm font-semibold">Stats</h2>
              <dl className="divide-y divide-line-soft text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 px-3 py-2">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="text-right font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="rounded-lg border border-line bg-surface">
              <h2 className="border-b border-line px-3 py-2 text-sm font-semibold">Use this price in your app</h2>
              <ul className="grid gap-3 p-3">
                {examples.map(([label, url]) => (
                  <li key={label} className="min-w-0">
                    <p className="mb-1 text-xs text-ink-muted">{label}</p>
                    <span className="flex items-center gap-1 rounded bg-surface-sunken py-1 pl-2 pr-1">
                      <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-body hover:text-ink" title={url}>{url.replace('https://prices.charisma.rocks', '')}</a>
                      <CopyButton text={url} label={`Copy: ${label}`} />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">Free and open. <Link href="/docs" className="text-accent-text hover:underline">Read the API docs</Link></p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
