import { ArrowUpRight } from 'lucide-react';
import { LINKS } from '@/lib/site';
import { count, getPlatformStats, usd, type PlatformStats } from '@/lib/stats';

/** Live numbers from Swap's Analytics; says so plainly when they can't be read */
export async function StatsStrip() {
  let stats: PlatformStats;
  try {
    stats = await getPlatformStats();
  } catch (e) {
    console.error(e);
    return (
      <div className="cx-card flex flex-wrap items-center justify-between gap-3">
        <span className="text-[15px] text-ink-muted">Live numbers can’t be read right now.</span>
        <a className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent-text no-underline" href={LINKS.analytics}>See them on Analytics<ArrowUpRight className="size-4" /></a>
      </div>
    );
  }
  const since = new Date(stats.firstTradeAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const tiles = [
    ['Trades', count(stats.trades), `Since ${since}`],
    ['Traders', count(stats.traders), 'Unique wallets'],
    ['Liquidity', usd(stats.tvlUsd), 'In Charisma pools now'],
    ['Protocol fees', '0%', 'Charisma takes nothing'],
  ];
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, note]) => (
          <div key={label} className="cx-stat"><span className="cx-label">{label}</span><span className="cx-stat-value">{value}</span><span className="cx-stat-note">{note}</span></div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-ink-muted">Read from the chain, updated every 15 minutes. <a className="text-accent-text no-underline" href={LINKS.analytics}>See the numbers</a></p>
    </div>
  );
}
