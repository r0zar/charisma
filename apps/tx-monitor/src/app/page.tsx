import Link from 'next/link';
import { Activity, ArrowRight, BookOpen, CheckCircle, Clock, Radio, Send, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLastCronRun, getQueueStats } from '@/lib/transaction-monitor';
import { getActivityStats } from '@/lib/activity-storage';

export const revalidate = 30;

// A transaction's trip, drawn as one track with a dot that travels it
const TRIP_CSS = `
.tm-dot { animation: tm-travel 4.5s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
@keyframes tm-travel {
  0% { left: 0%; opacity: 0; } 8% { opacity: 1; }
  45% { left: 50%; } 55% { left: 50%; }
  92% { opacity: 1; } 100% { left: 100%; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .tm-dot { animation: none; left: 50%; } }
`;

const ago = (ms: number) => {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};

const STEPS = [
    { icon: Send, title: 'An app hands it off', body: 'Swap, Zesty and the other Charisma apps send each transaction’s id here the moment they broadcast it.' },
    { icon: Radio, title: 'The monitor keeps watch', body: 'It checks Stacks every minute, and right away when an app asks, until the transaction settles.' },
    { icon: CheckCircle, title: 'The app hears back', body: 'Orders confirm, activity updates and balances refresh, matching what really happened on-chain.' },
];

const OUTCOMES = [
    { icon: CheckCircle, tone: 'text-success', name: 'Confirmed', body: 'It ran, and it’s on the chain.' },
    { icon: XCircle, tone: 'text-danger', name: 'Failed', body: 'It reached the chain, but the contract said no, or a safety check stopped it. The network fee was still paid.' },
    { icon: Trash2, tone: 'text-danger', name: 'Dropped', body: 'The network threw it out before it ran: replaced, expired or too cheap. Nothing moved, no fee.' },
    { icon: Clock, tone: 'text-warning', name: 'Waiting', body: 'It’s in line to be included in a block.' },
];

export default async function HomePage() {
    const [queue, lastRun, activity] = await Promise.all([getQueueStats(), getLastCronRun(), getActivityStats()]);
    const tracked = Object.values(activity.byStatus).reduce((sum, n) => sum + n, 0);

    return (
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <style>{TRIP_CSS}</style>

            {/* Hero */}
            <section className="py-16 text-center md:py-24">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-muted">
                    <Activity className="h-3.5 w-3.5 text-accent-text" /> Transaction monitor
                </div>
                <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">Every transaction, watched until it lands</h1>
                <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
                    When a Charisma app sends a transaction, the monitor follows it on Stacks and tells the app the moment it confirms, fails
                    or gets dropped. Your orders and activity stay true to the chain.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                    <Button size="lg" asChild><Link href="/dashboard">Open the dashboard <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                    <Button size="lg" variant="outline" asChild><Link href="/docs"><BookOpen className="mr-1 h-4 w-4" /> Read the docs</Link></Button>
                </div>

                {/* The trip */}
                <div className="mx-auto mt-14 max-w-xl" aria-hidden>
                    <div className="relative h-px bg-line">
                        <span className="tm-dot absolute -top-1.5 h-3 w-3 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
                    </div>
                    <div className="mt-4 flex justify-between text-xs text-ink-muted">
                        <span>Sent</span><span>Waiting in line</span><span className="text-success">On the chain</span>
                    </div>
                </div>
            </section>

            {/* Live */}
            <section className="grid gap-3 sm:grid-cols-3">
                {[
                    { label: 'Watching now', value: queue.queueSize.toLocaleString() },
                    { label: 'Last check', value: lastRun ? ago(lastRun) : 'not yet' },
                    { label: 'Tracked so far', value: tracked.toLocaleString() },
                ].map(stat => (
                    <div key={stat.label} className="rounded-2xl border border-line bg-surface p-5">
                        <p className="text-xs uppercase tracking-[0.1em] text-ink-muted">{stat.label}</p>
                        <p className="mt-1 font-mono text-2xl font-semibold">{stat.value}</p>
                    </div>
                ))}
            </section>

            {/* How it works */}
            <section className="py-20">
                <h2 className="text-center text-2xl font-bold md:text-3xl">How it works</h2>
                <div className="mt-10 grid gap-6 md:grid-cols-3">
                    {STEPS.map((step, i) => (
                        <div key={step.title} className="rounded-2xl border border-line bg-surface p-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><step.icon className="h-4 w-4" /></span>
                                <span className="font-mono text-xs text-ink-muted">0{i + 1}</span>
                            </div>
                            <h3 className="mt-4 font-semibold">{step.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Outcomes */}
            <section className="pb-20">
                <h2 className="text-center text-2xl font-bold md:text-3xl">Where a transaction can end up</h2>
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                    {OUTCOMES.map(outcome => (
                        <div key={outcome.name} className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
                            <outcome.icon className={`mt-0.5 h-5 w-5 shrink-0 ${outcome.tone}`} />
                            <div>
                                <p className="font-semibold">{outcome.name}</p>
                                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{outcome.body}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="mb-20 rounded-3xl border border-line bg-surface p-10 text-center">
                <h2 className="text-2xl font-bold">See it working</h2>
                <p className="mx-auto mt-3 max-w-xl text-ink-muted">The dashboard shows what’s being watched right now, and how recent transactions turned out.</p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <Button size="lg" asChild><Link href="/dashboard">Open the dashboard <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                    <Button size="lg" variant="outline" asChild><Link href="/docs">Build with the API</Link></Button>
                </div>
            </section>
        </div>
    );
}
