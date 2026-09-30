import type { ReactNode } from 'react';
import type { Period, PlatformStats, Ranked, TokenRanked } from '@/lib/analytics/platform-stats';

/** $1.23M, $45.6K, $789 */
export const usd = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: n >= 10_000 ? 1 : 0 });
export const count = (n: number) => Math.round(n).toLocaleString('en-US');
const shortAddress = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;
const month = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="text-xs uppercase tracking-wide text-white/50">{label}</div>
            <div className="mt-2 font-mono text-3xl font-semibold text-white/95">{value}</div>
            {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
        </div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="text-sm font-medium text-white/70">{title}</h2>
            {children}
        </section>
    );
}

function PeriodRow({ rows }: { rows: [string, Period][] }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {rows.map(([label, p]) => (
                <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="text-xs text-white/50">{label}</div>
                    <div className="mt-1 font-mono text-xl text-white/90">{usd(p.volumeUsd)}</div>
                    <div className="text-xs text-white/40">{count(p.trades)} trades</div>
                </div>
            ))}
        </div>
    );
}

/** Weekly volume as plain bars; hover shows the week */
function WeeklyChart({ weeks }: { weeks: PlatformStats['weekly'] }) {
    const max = Math.max(...weeks.map(w => w.volumeUsd), 1);
    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex h-48 items-end gap-[2px]">
                {weeks.map(w => (
                    <div
                        key={w.weekStart}
                        title={`Week of ${new Date(w.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}: ${usd(w.volumeUsd)} · ${count(w.trades)} trades`}
                        className="flex-1 rounded-t bg-orange-400/70 transition-colors hover:bg-orange-300"
                        style={{ height: `${Math.max((w.volumeUsd / max) * 100, w.trades > 0 ? 1.5 : 0)}%` }}
                    />
                ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-white/40">
                <span>{month(weeks[0].weekStart)}</span>
                <span>Now</span>
            </div>
        </div>
    );
}

function Table({ head, rows }: { head: string; rows: { key: string; name: ReactNode; volumeUsd: number; trades: number }[] }) {
    return (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
            <div className="grid grid-cols-[24px_1fr_auto_auto] gap-3 border-b border-white/[0.06] px-4 py-2 text-xs text-white/40">
                <span>#</span><span>{head}</span><span className="w-24 text-right">Volume</span><span className="w-16 text-right">Trades</span>
            </div>
            {rows.map((row, i) => (
                <div key={row.key} className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.03]">
                    <span className="text-white/40">{i + 1}</span>
                    <span className="min-w-0 truncate text-white/90">{row.name}</span>
                    <span className="w-24 text-right font-mono text-white/80">{usd(row.volumeUsd)}</span>
                    <span className="w-16 text-right font-mono text-white/50">{count(row.trades)}</span>
                </div>
            ))}
        </div>
    );
}

const tokenRows = (tokens: TokenRanked[]) => tokens.map(t => ({
    key: t.id,
    volumeUsd: t.volumeUsd,
    trades: t.trades,
    name: (
        <span className="flex items-center gap-2">
            {t.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={t.image} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
                : <span className="h-5 w-5 rounded-full bg-white/10" />}
            {t.symbol}
        </span>
    ),
}));

const walletRows = (wallets: Ranked[]) => wallets.map(w => ({
    key: w.id,
    volumeUsd: w.volumeUsd,
    trades: w.trades,
    name: (
        <a href={`https://explorer.hiro.so/address/${w.id}?chain=mainnet`} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-orange-300">
            {shortAddress(w.id)}
        </a>
    ),
}));

/** Public proof of life: what's been traded on Charisma, by whom and in what */
export default function AnalyticsPage({ stats }: { stats: PlatformStats }) {
    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
            <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-white/95">Charisma, by the numbers</h1>
                <p className="text-sm text-white/60">Every swap and filled order that succeeded on chain since {month(stats.firstTradeAt)}. Updated every 15 minutes.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card label="Total volume" value={usd(stats.volumeUsd)} />
                <Card label="Trades" value={count(stats.trades)} />
                <Card label="Traders" value={count(stats.traders)} hint="Unique wallets" />
                <Card label="Liquidity (TVL)" value={usd(stats.tvlUsd)} hint="In Charisma pools now" />
            </div>

            <Section title="Recent">
                <PeriodRow rows={[['Last 24 hours', stats.last24h], ['Last 7 days', stats.last7d], ['Last 30 days', stats.last30d]]} />
            </Section>

            <Section title="On average">
                <PeriodRow rows={[['Per day', stats.perDay], ['Per week', stats.perWeek], ['Per month', stats.perMonth]]} />
            </Section>

            <Section title="Weekly volume">
                <WeeklyChart weeks={stats.weekly} />
            </Section>

            <div className="grid gap-8 lg:grid-cols-2">
                <Section title="Top tokens">
                    <Table head="Token" rows={tokenRows(stats.topTokens)} />
                </Section>
                <Section title="Top traders">
                    <Table head="Wallet" rows={walletRows(stats.topWallets)} />
                </Section>
            </div>

            <p className="text-xs text-white/40">
                Volume is the amount put into each trade, valued at today&apos;s prices. Subnet trades count as the token they hold. Trades in tokens without a price are counted but add no volume.
            </p>
        </div>
    );
}
