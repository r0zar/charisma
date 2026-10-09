'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, FileCode2, Flame, Repeat, Wallet, type LucideIcon } from 'lucide-react';
import type { BalanceEntry } from 'blaze-sdk';
import { useBalances, useWalletBalances } from '@/contexts/wallet-balance-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { useWallet } from '@/contexts/wallet-context';
import OrdersPanel from '@/components/orders/orders-panel';
import { ActivityMenu, inView, tokensIn, type ActivityView } from './ActivityMenu';
import { formatTokenAmount } from '@/lib/swap-utils';
import type { ChainActivity, ChainActivityKind, ChainActivityPage } from '@/lib/activity/chain-types';

type Tokens = ReturnType<typeof useTokenMetadata>['tokens'];
type Flow = ChainActivity['flows'][number];

const explorer = (txid: string) => `https://explorer.hiro.so/txid/${txid}?chain=mainnet`;
const short = (address?: string) => (address ? `${address.slice(0, 5)}…${address.slice(-4)}` : '');
const time = (at: number) => new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function dayOf(at: number): string {
    const day = new Date(at).toDateString();
    const today = new Date();
    if (day === today.toDateString()) return 'Today';
    if (day === new Date(today.getTime() - 86_400_000).toDateString()) return 'Yesterday';
    const sameYear = new Date(at).getFullYear() === today.getFullYear();
    return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) });
}

/** "1.5 STX": a token without known decimals shows in its smallest units rather than a guess */
function amountOf(tokens: Tokens, { token, amount }: Flow): string {
    const meta = tokens[token];
    const raw = Math.abs(Number(amount));
    return meta?.decimals !== undefined
        ? `${formatTokenAmount(raw, meta.decimals)} ${meta.symbol}`
        : `${raw.toLocaleString('en-US')} ${meta?.symbol ?? token.split('.')[1] ?? token}`;
}

/** One line of activity in plain words; settling lines say what's happening, mined lines what happened */
function describe(kind: ChainActivityKind, flows: Flow[], tokens: Tokens, settling: boolean, extra: { order?: string; counterparty?: string; call?: string }) {
    const out = flows.filter(f => f.amount.startsWith('-')).map(f => amountOf(tokens, f)).join(' + ');
    const into = flows.filter(f => !f.amount.startsWith('-')).map(f => amountOf(tokens, f)).join(' + ');
    const trade = out && into ? `${out} → ${into}` : out || into;
    const verb = (done: string, going: string) => (settling ? going : done);
    const lines: Record<ChainActivityKind, { icon: LucideIcon; title: string; detail?: string }> = {
        order: { icon: Repeat, title: extra.order ?? 'Order', detail: trade },
        // The Blaze side of a move is the amount that landed
        'to-blaze': { icon: Flame, title: into ? `${verb('Moved', 'Moving')} ${into} to Blaze` : 'Move to Blaze' },
        'to-standard': { icon: Wallet, title: into ? `${verb('Moved', 'Moving')} ${into} to Standard` : 'Move to Standard' },
        swap: { icon: ArrowLeftRight, title: trade ? `${verb('Swapped', 'Swapping')} ${trade}` : 'Swap' },
        send: { icon: ArrowUpRight, title: `${verb('Sent', 'Sending')} ${out}`, detail: extra.counterparty && `To ${short(extra.counterparty)}` },
        receive: { icon: ArrowDownLeft, title: `${verb('Received', 'Receiving')} ${into}`, detail: extra.counterparty && `From ${short(extra.counterparty)}` },
        other: {
            icon: FileCode2,
            title: extra.call ? `${extra.call.split(' ')[0].split('.')[1]} · ${extra.call.split(' ')[1]}` : 'Transaction',
            detail: trade || undefined,
        },
    };
    return lines[kind];
}

function Row({ icon: Icon, title, detail, txid, right, chip }: {
    icon: LucideIcon; title: string; detail?: string; txid?: string; right: string; chip?: { text: string; tone: string };
}) {
    const body = (
        <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted"><Icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    <span className="min-w-0 break-words">{title}</span>
                    {chip && <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${chip.tone}`}>{chip.text}</span>}
                </div>
                {detail && <div className="truncate text-xs text-ink-muted">{detail}</div>}
            </div>
            <div className="shrink-0 text-right text-xs text-ink-faint">{right}</div>
        </>
    );
    const className = 'flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0';
    return (
        <li>
            {txid
                ? <a href={explorer(txid)} target="_blank" rel="noopener noreferrer" className={`${className} cursor-pointer hover:bg-surface-hover`}>{body}</a>
                : <div className={className}>{body}</div>}
        </li>
    );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs uppercase tracking-wide text-ink-muted">{title}</h2>
                {action}
            </div>
            <ul className="overflow-hidden rounded-xl border border-line bg-surface">{children}</ul>
        </section>
    );
}

/** What a sent transaction is doing, from its settling entries: the same words as once it's mined */
function settlingKind(entries: BalanceEntry[]): ChainActivityKind {
    const kinds = entries.map(e => e.kind);
    if (kinds.includes('deposit')) return 'to-blaze';
    if (kinds.includes('withdraw')) return 'to-standard';
    if (kinds.includes('swap')) return 'swap';
    return entries.some(e => e.amount.startsWith('-')) ? 'send' : 'receive';
}

const OPEN_SHOWN = 3;
/** A filter keeps reading older pages until it shows this many lines… */
const FILTER_FILL = 10;
/** …or has looked this far back */
const FILTER_DEPTH = 100;

/**
 * Activity: one place for everything a wallet does, with a menu to narrow it. All activity shows open orders
 * (signed, off-chain) on top, then what's settling (live, from the balance service), then every mined transaction
 * from any app, newest first, read from the chain. Orders opens the order manager. The view lives in the URL (?view=).
 */
export function WalletActivity({ address }: { address: string }) {
    useBalances([address]);
    const { sheets } = useWalletBalances();
    const { tokens } = useTokenMetadata();
    const { address: connected } = useWallet();
    const sheet = sheets[address];

    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const view = (params.get('view') ?? 'all') as ActivityView;
    // A new view starts clean: the order manager's page, filter and search don't carry over
    const showView = (next: ActivityView) => {
        const kept = new URLSearchParams(params.get('address') ? { address: params.get('address')! } : {});
        if (next !== 'all') kept.set('view', next);
        router.replace(kept.size ? `${pathname}?${kept}` : pathname, { scroll: false });
    };

    const [items, setItems] = useState<ChainActivity[] | null>(null);
    const [next, setNext] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async (offset: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/activity/${address}?offset=${offset}`);
            const body = await res.json();
            if (!res.ok) throw new Error(body.message ?? `The activity service answered ${res.status}`);
            const page = body as ChainActivityPage;
            setItems(prev => (offset === 0 ? page.items : [...(prev ?? []), ...page.items]));
            setNext(page.next);
            setError(null);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // The first page, and again each time one of this wallet's transactions confirms, so it moves into the list
    const confirmed = sheet?.confirmed.map(c => c.txid).join(',') ?? '';
    useEffect(() => { void load(0); }, [address, confirmed]);

    const entries = Object.values(sheet?.tokens ?? {}).flatMap(t => t.entries);
    // A plan's orders are signed together, so they read in their own order: "DCA buy 2 of 24", then 3…
    const open = entries.filter(e => e.stage === 'hold').sort((a, b) => (a.note ?? '').localeCompare(b.note ?? '', 'en', { numeric: true }));
    const mined = new Set((items ?? []).map(i => i.txid.replace(/^0x/, '')));
    const settling = Object.values(
        entries
            .filter(e => e.stage === 'pending' && e.txid && e.kind !== 'fee' && !mined.has(e.txid.replace(/^0x/, '')))
            .reduce<Record<string, BalanceEntry[]>>((byTx, e) => ({ ...byTx, [e.txid!]: [...(byTx[e.txid!] ?? []), e] }), {}),
    );
    const shown = (items ?? []).filter(item => inView(view, item, tokens));
    const days = shown.reduce<[string, ChainActivity[]][]>((groups, item) => {
        const day = dayOf(item.at);
        const last = groups[groups.length - 1];
        if (last?.[0] === day) last[1].push(item);
        else groups.push([day, [item]]);
        return groups;
    }, []);
    const history = view !== 'orders' && view !== 'settling';

    // A filter can match little of a page: read further back on its own, up to FILTER_DEPTH transactions
    const thin = history && view !== 'all' && shown.length < FILTER_FILL && next !== null && (items?.length ?? 0) < FILTER_DEPTH;
    useEffect(() => { if (thin && !loading && !error) void load(next!); }, [thin, loading, error, next]);

    const settlingSection = settling.length > 0 && (
        <Section title={`Settling · ${settling.length}`}>
            {settling.map(group => {
                const flows = group.map(e => ({ token: e.token, amount: e.amount }));
                const line = describe(settlingKind(group), flows, tokens, true, { counterparty: group[0].counterparty });
                return <Row key={group[0].txid} {...line} txid={group[0].txid} right={time(group[0].at)} chip={{ text: 'Settling', tone: 'bg-blaze-soft text-blaze' }} />;
            })}
        </Section>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-ink">Activity</h1>
                <p className="text-sm text-ink-muted">Everything {short(address)} does, from any app. Tap a line to see it on the explorer.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
                <ActivityMenu view={view} onView={showView} counts={{ open: open.length, settling: settling.length }} tokenIds={tokensIn(items ?? [], tokens)} tokens={tokens} />

                <div className="min-w-0 space-y-8">
                    {view === 'orders' && (address === connected
                        ? <OrdersPanel embedded />
                        : <p className="py-12 text-center text-sm text-ink-muted">Orders can only be managed for the connected wallet.</p>)}

                    {view === 'all' && open.length > 0 && (
                        <Section
                            title={`Open orders · ${open.length}`}
                            action={<button type="button" onClick={() => showView('orders')} className="cursor-pointer text-xs font-medium text-accent-text hover:underline">Manage →</button>}
                        >
                            {open.slice(0, OPEN_SHOWN).map(e => (
                                <Row
                                    key={e.id}
                                    icon={Repeat}
                                    title={e.note ?? (e.kind === 'bet' ? 'Meme Roulette bet' : 'Order')}
                                    detail={amountOf(tokens, { token: e.token, amount: e.amount })}
                                    right="Off-chain"
                                />
                            ))}
                            {open.length > OPEN_SHOWN && (
                                <li className="px-4 py-2.5 text-xs text-ink-muted">
                                    and {open.length - OPEN_SHOWN} more · <button type="button" onClick={() => showView('orders')} className="cursor-pointer text-accent-text hover:underline">see all</button>
                                </li>
                            )}
                        </Section>
                    )}

                    {(view === 'all' || view === 'settling') && settlingSection}
                    {view === 'settling' && settling.length === 0 && <p className="py-12 text-center text-sm text-ink-muted">Nothing settling right now.</p>}

                    {history && (
                        <>
                            {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Couldn&apos;t read your activity: {error}</p>}
                            {!items && !error && <p className="py-12 text-center text-sm text-ink-muted">Reading your activity from the chain…</p>}
                            {items?.length === 0 && <p className="py-12 text-center text-sm text-ink-muted">Nothing yet. Your swaps, moves and orders will show up here.</p>}
                            {!!items?.length && shown.length === 0 && (
                                <p className="py-12 text-center text-sm text-ink-muted">None of these in what&apos;s loaded{next !== null ? '. Older activity may have some.' : '.'}</p>
                            )}

                            {days.map(([day, list]) => (
                                <Section key={day} title={day}>
                                    {list.map(item => {
                                        const line = describe(item.kind, item.flows, tokens, false, item);
                                        const fee = item.fee ? `fee ${formatTokenAmount(Number(item.fee), 6)} STX` : null;
                                        return (
                                            <Row
                                                key={item.txid}
                                                {...line}
                                                detail={[line.detail, fee].filter(Boolean).join(' · ') || undefined}
                                                txid={item.txid}
                                                right={time(item.at)}
                                                chip={item.status === 'failed' ? { text: "Didn't go through", tone: 'bg-danger-soft text-danger' } : undefined}
                                            />
                                        );
                                    })}
                                </Section>
                            ))}

                            {next !== null && (
                                <button
                                    type="button"
                                    onClick={() => load(next)}
                                    disabled={loading}
                                    className="w-full cursor-pointer rounded-xl border border-line px-4 py-3 text-sm text-ink-body hover:border-line-strong hover:text-ink disabled:cursor-wait disabled:opacity-60"
                                >
                                    {loading ? 'Loading…' : 'Show older'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
