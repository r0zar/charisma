import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PriceChart } from '@/components/price-chart';
import { SiteHeader } from '@/components/site-header';
import { Ticker } from '@/components/ticker';
import { CopyPrompt } from '@/components/copy-prompt';
import { TokenLive } from '@/components/token-live';
import { formatCompact, formatPrice } from '@/lib/format';
import { aiPrompt } from '@/lib/ai-prompt';
import { getMarket, getTokenStats } from '@/lib/market';

export const revalidate = 60;

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

  const facts: [string, string, string?][] = [
    ['Liquidity on Charisma', token.liquidityUsd ? formatCompact(token.liquidityUsd) : '—', 'Dollar value of this token held in Charisma\'s pools'],
    ['Round-trip cost', token.roundTripLoss === null ? '—' : `${token.roundTripLoss.toFixed(2)}%`, 'How much buying about $1 and selling it straight back loses. 1–3% is healthy; over 25% means thin liquidity and a less reliable price.'],
    ['All-time high', stats.ath ? `${formatPrice(stats.ath.usd)} · ${day(stats.ath.day)}` : '—'],
    ['All-time low', stats.atl ? `${formatPrice(stats.atl.usd)} · ${day(stats.atl.day)}` : '—'],
    ['Tracked since', stats.since ? day(stats.since) : '—'],
    ['Last priced', new Date(token.updatedAt).toUTCString().slice(5, 22) + ' UTC'],
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
                {facts.map(([label, value, hint]) => (
                  <div key={label} className="flex justify-between gap-3 px-3 py-2">
                    <dt className="text-ink-muted"><span title={hint} className={hint ? 'cursor-help underline decoration-dotted decoration-ink-faint underline-offset-4' : ''}>{label}</span></dt>
                    <dd className="text-right font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="grid gap-3 rounded-lg border border-line bg-surface p-3">
              <h2 className="text-sm font-semibold">Build with this price</h2>
              <p className="text-sm text-ink-body">Paste one prompt into ChatGPT, Claude or any AI. It explains the whole free API, set up for {token.symbol}.</p>
              <CopyPrompt text={aiPrompt(token)} />
              <p className="text-xs text-ink-muted">Prefer to read? <Link href="/docs" className="text-accent-text hover:underline">API docs</Link> · <a href="/llms.txt" className="text-accent-text hover:underline">llms.txt</a></p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
