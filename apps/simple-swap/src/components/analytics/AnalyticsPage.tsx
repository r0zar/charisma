import type { ReactNode } from 'react';
import type { Period, PlatformStats, TokenRanked, WalletRanked } from '@/lib/analytics/platform-stats';

/** $1.23M, $45.6K, $789 */
export const usd = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: n >= 10_000 ? 1 : 0 });
export const count = (n: number) => Math.round(n).toLocaleString('en-US');
const shortAddress = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;
const month = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const ANALYTICS_URL = 'https://swap.charisma.rocks/analytics';

/** Opens X with a ready-made post about these numbers (and the page, for its share card) */
function ShareOnX({ text }: { text: string }) {
    const href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(ANALYTICS_URL)}`;
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted hover:border-line-strong hover:text-ink transition-colors"
        >
            Share on 𝕏
        </a>
    );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-xl border border-line bg-surface p-5">
            <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
            <div className="mt-2 font-mono text-3xl font-semibold text-ink">{value}</div>
            {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
        </div>
    );
}

function Section({ title, share, children }: { title: string; share: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-ink-body">{title}</h2>
                <ShareOnX text={share} />
            </div>
            {children}
        </section>
    );
}

function PeriodRow({ rows }: { rows: [string, Period][] }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {rows.map(([label, p]) => (
                <div key={label} className="rounded-xl border border-line bg-surface p-4">
                    <div className="text-xs text-ink-muted">{label}</div>
                    <div className="mt-1 font-mono text-xl text-ink">{usd(p.volumeUsd)}</div>
                    <div className="text-xs text-ink-muted">{count(p.trades)} trades</div>
                </div>
            ))}
        </div>
    );
}

/** Weekly volume as plain bars; hover shows the week */
function WeeklyChart({ weeks }: { weeks: PlatformStats['weekly'] }) {
    const max = Math.max(...weeks.map(w => w.volumeUsd), 1);
    return (
        <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex h-48 items-end gap-[2px]">
                {weeks.map(w => (
                    <div
                        key={w.weekStart}
                        title={`Week of ${new Date(w.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}: ${usd(w.volumeUsd)} · ${count(w.trades)} trades`}
                        className="flex-1 rounded-t bg-accent/70 transition-colors hover:bg-accent"
                        style={{ height: `${Math.max((w.volumeUsd / max) * 100, w.trades > 0 ? 1.5 : 0)}%` }}
                    />
                ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-muted">
                <span>{month(weeks[0].weekStart)}</span>
                <span>Now</span>
            </div>
        </div>
    );
}

function Table({ head, rows }: { head: string; rows: { key: string; name: ReactNode; volumeUsd: number; trades: number }[] }) {
    return (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="grid grid-cols-[24px_1fr_auto_auto] gap-3 border-b border-line-soft px-4 py-2 text-xs text-ink-muted">
                <span>#</span><span>{head}</span><span className="w-24 text-right">Volume</span><span className="w-16 text-right">Trades</span>
            </div>
            {rows.map((row, i) => (
                <div key={row.key} className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface">
                    <span className="text-ink-muted">{i + 1}</span>
                    <span className="min-w-0 truncate text-ink">{row.name}</span>
                    <span className="w-24 text-right font-mono text-ink-body">{usd(row.volumeUsd)}</span>
                    <span className="w-16 text-right font-mono text-ink-muted">{count(row.trades)}</span>
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
                : <span className="h-5 w-5 rounded-full bg-surface-hover" />}
            {t.symbol}
        </span>
    ),
}));

const walletRows = (wallets: WalletRanked[]) => wallets.map(w => ({
    key: w.id,
    volumeUsd: w.volumeUsd,
    trades: w.trades,
    name: (
        <a href={`https://explorer.hiro.so/address/${w.id}?chain=mainnet`} target="_blank" rel="noopener noreferrer" className="hover:text-accent-text">
            {w.bns
                ? <>{w.bns} <span className="font-mono text-xs text-ink-muted">{shortAddress(w.id)}</span></>
                : <span className="font-mono">{shortAddress(w.id)}</span>}
        </a>
    ),
}));

const ranked = (rows: string[]) => rows.map((row, i) => `${i + 1}. ${row}`).join('\n');

/** Public proof of life: what's been traded on Charisma, by whom and in what */
export default function AnalyticsPage({ stats }: { stats: PlatformStats }) {
    const since = month(stats.firstTradeAt);
    const share = {
        headline: `Charisma, by the numbers 📊\n\n${usd(stats.volumeUsd)} traded\n${count(stats.trades)} trades\n${count(stats.traders)} traders\n${usd(stats.tvlUsd)} in liquidity\n\nAll on chain, on Stacks.`,
        recent: `Last 30 days on Charisma: ${usd(stats.last30d.volumeUsd)} across ${count(stats.last30d.trades)} trades.\nLast 7 days: ${usd(stats.last7d.volumeUsd)} across ${count(stats.last7d.trades)}.`,
        average: `On an average day, Charisma sees ${count(stats.perDay.trades)} trades. That's ${count(stats.perMonth.trades)} a month, and ${usd(stats.perMonth.volumeUsd)} in volume.`,
        weekly: `Every week of trading on Charisma since ${since}, straight from the chain 📈`,
        tokens: `Most traded on Charisma 🔥\n\n${ranked(stats.topTokens.slice(0, 3).map(t => `$${t.symbol}: ${usd(t.volumeUsd)}`))}`,
        traders: `Top traders on Charisma 🏆\n\n${ranked(stats.topWallets.slice(0, 3).map(w => w.bns ?? shortAddress(w.id)))}`,
    };
    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
            <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-ink">Charisma, by the numbers</h1>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-muted">Every trade through Charisma's routers since {since}, read from the chain. Updated every 15 minutes.</p>
                    <ShareOnX text={share.headline} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card label="Total volume" value={usd(stats.volumeUsd)} />
                <Card label="Trades" value={count(stats.trades)} />
                <Card label="Traders" value={count(stats.traders)} hint="Unique wallets" />
                <Card label="Liquidity (TVL)" value={usd(stats.tvlUsd)} hint="In Charisma pools now" />
            </div>

            <Section title="Recent" share={share.recent}>
                <PeriodRow rows={[['Last 24 hours', stats.last24h], ['Last 7 days', stats.last7d], ['Last 30 days', stats.last30d]]} />
            </Section>

            <Section title="On average" share={share.average}>
                <PeriodRow rows={[['Per day', stats.perDay], ['Per week', stats.perWeek], ['Per month', stats.perMonth]]} />
            </Section>

            <Section title="Weekly volume" share={share.weekly}>
                <WeeklyChart weeks={stats.weekly} />
            </Section>

            <div className="grid gap-8 lg:grid-cols-2">
                <Section title="Top tokens" share={share.tokens}>
                    <Table head="Token" rows={tokenRows(stats.topTokens)} />
                </Section>
                <Section title="Top traders" share={share.traders}>
                    <Table head="Wallet" rows={walletRows(stats.topWallets)} />
                </Section>
            </div>

            <p className="text-xs text-ink-muted">
                Volume is the amount put into each trade, valued at today&apos;s prices. Subnet trades count as the token they hold. Trades in tokens without a price are counted but add no volume.
            </p>
        </div>
    );
}
