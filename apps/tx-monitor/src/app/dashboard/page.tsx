import { AlertTriangle, Ban, CheckCircle, Clock, ExternalLink, Trash2, XCircle, type LucideIcon } from 'lucide-react';
import { getLastCronRun, getQueuedTransactions } from '@/lib/transaction-monitor';
import { getActivityTimeline } from '@/lib/activity-storage';
import type { ActivityItem, ActivityType, TokenInfo } from '@/lib/activity-types';
import { TransactionLookup } from '@/components/TransactionLookup';
import { RefreshButton } from './refresh-button';

export const metadata = { title: 'Dashboard · Transaction Monitor' };
export const revalidate = 30;

const DAY = 24 * 60 * 60 * 1000;
/** The cron runs every minute; three quiet minutes means something's wrong */
const STALE_MS = 3 * 60 * 1000;

type Outcome = 'Confirmed' | 'Failed' | 'Dropped' | 'Cancelled' | 'Waiting';
const LOOK: Record<Outcome, { icon: LucideIcon; tone: string }> = {
    Confirmed: { icon: CheckCircle, tone: 'text-success' },
    Failed: { icon: XCircle, tone: 'text-danger' },
    Dropped: { icon: Trash2, tone: 'text-danger' },
    Cancelled: { icon: Ban, tone: 'text-ink-muted' },
    Waiting: { icon: Clock, tone: 'text-warning' },
};
const KIND: Record<ActivityType, string> = {
    instant_swap: 'Swap', order_filled: 'Order', order_cancelled: 'Order', dca_update: 'DCA', twitter_trigger: 'Tweet trigger',
};

/** Where a transaction ended up, and why, in plain words */
function outcomeOf(a: ActivityItem): { outcome: Outcome; why?: string } {
    const tx = a.metadata?.txStatus as string | undefined;
    if (a.status === 'completed') return { outcome: 'Confirmed' };
    if (a.status === 'cancelled') return { outcome: 'Cancelled', why: 'Cancelled by its owner' };
    if (a.status === 'failed') {
        if (tx === 'dropped') return { outcome: 'Dropped', why: 'The network dropped it before it ran. Nothing moved, no fee' };
        if (tx === 'abort_by_post_condition') return { outcome: 'Failed', why: 'A safety check stopped it, usually because the price moved' };
        if (tx === 'abort_by_response') return { outcome: 'Failed', why: 'The contract refused it' };
        return { outcome: 'Failed' };
    }
    return { outcome: 'Waiting' };
}

const ago = (ms: number) => {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
};
const amount = (t: TokenInfo, raw = t.amount) =>
    `${(Number(raw) / 10 ** (t.decimals ?? 6)).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${t.symbol}`;
/** What came out: the recorded amount, or just the token when none was recorded (older swaps paid in STX) or it didn't run */
const received = (a: ActivityItem, outcome: Outcome) => {
    const raw = [a.toToken.amount, a.metadata?.actualOutputAmount as string | undefined].find(v => Number(v) > 0);
    return outcome === 'Confirmed' && raw ? amount(a.toToken, raw) : a.toToken.symbol;
};
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const explorer = (txid: string) => `https://explorer.hiro.so/txid/0x${txid.replace(/^0x/, '')}?chain=mainnet`;

export default async function DashboardPage() {
    const [lastRun, watching, timeline] = await Promise.all([getLastCronRun(), getQueuedTransactions(), getActivityTimeline({ limit: 200 })]);
    const activities = timeline.activities.map(a => ({ a, ...outcomeOf(a) }));
    const healthy = !!lastRun && Date.now() - lastRun < STALE_MS;

    const tally = (days: number) => {
        const since = Date.now() - days * DAY;
        const count = (o: Outcome) => activities.filter(x => x.a.timestamp >= since && x.outcome === o).length;
        const confirmed = count('Confirmed'), failed = count('Failed'), dropped = count('Dropped');
        const settled = confirmed + failed + dropped;
        return { confirmed, failed, dropped, rate: settled ? Math.round((confirmed / settled) * 100) : null };
    };
    const windows = [{ label: 'Last 7 days', ...tally(7) }, { label: 'Last 30 days', ...tally(30) }];

    return (
        <div className="container mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
                <RefreshButton />
            </div>

            {/* Is it working? */}
            <div className={`flex items-center gap-3 rounded-2xl border p-4 ${healthy ? 'border-success/30 bg-success-soft' : 'border-warning/40 bg-warning-soft'}`}>
                {healthy ? <CheckCircle className="h-5 w-5 shrink-0 text-success" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />}
                <p className="text-sm">
                    {healthy
                        ? <><span className="font-semibold">All good.</span> Checked {ago(lastRun!)}, watching {watching.length} transaction{watching.length === 1 ? '' : 's'} right now.</>
                        : <><span className="font-semibold">The monitor hasn&apos;t checked in {lastRun ? `since ${ago(lastRun)}` : 'yet'}.</span> Transactions sent meanwhile will update once it runs again.</>}
                </p>
            </div>

            {/* How have transactions been turning out? */}
            <div className="grid gap-4 sm:grid-cols-2">
                {windows.map(w => (
                    <div key={w.label} className="rounded-2xl border border-line bg-surface p-5">
                        <div className="flex items-baseline justify-between">
                            <p className="text-xs uppercase tracking-[0.1em] text-ink-muted">{w.label}</p>
                            {w.rate !== null && <p className="text-sm text-ink-muted"><span className="font-mono font-semibold text-ink">{w.rate}%</span> went through</p>}
                        </div>
                        <div className="mt-3 flex gap-6 font-mono text-lg">
                            <span><span className="text-success">{w.confirmed}</span> <span className="font-sans text-xs text-ink-muted">confirmed</span></span>
                            <span><span className="text-danger">{w.failed}</span> <span className="font-sans text-xs text-ink-muted">failed</span></span>
                            <span><span className="text-danger">{w.dropped}</span> <span className="font-sans text-xs text-ink-muted">dropped</span></span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Being watched right now */}
            {watching.length > 0 && (
                <section className="rounded-2xl border border-line bg-surface p-5">
                    <h2 className="font-semibold">Watching now</h2>
                    <ul className="mt-3 space-y-2">
                        {watching.slice(0, 10).map(txid => (
                            <li key={txid} className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-warning" />
                                <a href={explorer(txid)} target="_blank" rel="noreferrer" className="font-mono text-ink-body hover:text-ink">{short(txid)}</a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Recent transactions */}
            <section className="rounded-2xl border border-line bg-surface">
                <h2 className="border-b border-line p-5 font-semibold">Recent transactions</h2>
                {activities.length === 0 && <p className="p-5 text-sm text-ink-muted">Nothing recorded yet.</p>}
                <ul className="divide-y divide-line">
                    {activities.slice(0, 25).map(({ a, outcome, why }) => {
                        const { icon: Icon, tone } = LOOK[outcome];
                        return (
                            <li key={a.id} className="flex items-start gap-3 p-4 sm:px-5">
                                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm">
                                        <span className="font-medium">{amount(a.fromToken)} → {received(a, outcome)}</span>
                                        <span className="ml-2 text-xs text-ink-muted">{KIND[a.type]} · {short(a.owner)}</span>
                                    </p>
                                    <p className={`mt-0.5 text-xs ${outcome === 'Confirmed' ? 'text-ink-muted' : tone}`}>{outcome}{why ? `: ${why}` : ''}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                                    <span>{ago(a.timestamp)}</span>
                                    {a.txid && <a href={explorer(a.txid)} target="_blank" rel="noreferrer" aria-label="View on the explorer" className="hover:text-ink"><ExternalLink className="h-3.5 w-3.5" /></a>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </section>

            {/* One transaction */}
            <section>
                <h2 className="mb-3 font-semibold">Look up a transaction</h2>
                <TransactionLookup />
            </section>
        </div>
    );
}
