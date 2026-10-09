'use client';

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Flame, List, Loader, Repeat, XCircle, type LucideIcon } from 'lucide-react';
import TokenLogo from '@/components/TokenLogo';
import type { useTokenMetadata } from '@/contexts/token-metadata-context';
import type { ChainActivity } from '@/lib/activity/chain-types';

type Tokens = ReturnType<typeof useTokenMetadata>['tokens'];

/** What the Activity page shows: everything, the order manager, what's settling, one kind of transaction, or one token */
export type ActivityView = 'all' | 'orders' | 'settling' | 'swaps' | 'moves' | 'sends' | 'receives' | 'failed' | `token:${string}`;

const STAGES: { view: ActivityView; label: string; icon: LucideIcon }[] = [
    { view: 'all', label: 'All activity', icon: List },
    { view: 'orders', label: 'Orders', icon: Repeat },
    { view: 'settling', label: 'Settling', icon: Loader },
];

const TYPES: { view: ActivityView; label: string; icon: LucideIcon; matches: (item: ChainActivity) => boolean }[] = [
    { view: 'swaps', label: 'Swaps', icon: ArrowLeftRight, matches: i => i.kind === 'swap' },
    { view: 'moves', label: 'Moves', icon: Flame, matches: i => i.kind === 'to-blaze' || i.kind === 'to-standard' },
    { view: 'sends', label: 'Sends', icon: ArrowUpRight, matches: i => i.kind === 'send' },
    { view: 'receives', label: 'Receives', icon: ArrowDownLeft, matches: i => i.kind === 'receive' },
    { view: 'failed', label: "Didn't go through", icon: XCircle, matches: i => i.status === 'failed' },
];

/** A contract's token as people know it: a Blaze subnet is its base token */
export const baseOf = (tokens: Tokens, id: string) => {
    const base = tokens[id]?.base;
    return base ? (base === 'stx' ? '.stx' : base) : id;
};

/** Whether a mined transaction belongs in a view (the orders and settling views hold no mined transactions) */
export function inView(view: ActivityView, item: ChainActivity, tokens: Tokens): boolean {
    if (view === 'all') return true;
    if (view.startsWith('token:')) return item.flows.some(f => baseOf(tokens, f.token) === view.slice('token:'.length));
    return TYPES.find(t => t.view === view)?.matches(item) ?? false;
}

/** The tokens in what's loaded, most active first */
export function tokensIn(items: ChainActivity[], tokens: Tokens, max = 8): string[] {
    const counts = new Map<string, number>();
    for (const item of items) {
        for (const id of new Set(item.flows.map(f => baseOf(tokens, f.token)))) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts].filter(([id]) => tokens[id]).sort((a, b) => b[1] - a[1]).slice(0, max).map(([id]) => id);
}

function Item({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors md:w-full ${
                active ? 'bg-surface-hover font-medium text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
            }`}
        >
            {children}
            {count ? <span className="ml-auto pl-2 font-mono text-[11px] text-ink-faint">{count}</span> : null}
        </button>
    );
}

const Heading = ({ children }: { children: React.ReactNode }) => (
    <div className="hidden px-3 pb-1 pt-4 font-mono text-[11px] uppercase tracking-wide text-ink-faint first:pt-0 md:block">{children}</div>
);

/**
 * The Activity page's menu: a column on the left on wide screens, one row of buttons to swipe across on phones.
 * Stages first (counts are live), then kinds of transaction, then the tokens that appear in what's loaded.
 */
export function ActivityMenu({ view, onView, counts, tokenIds, tokens }: {
    view: ActivityView;
    onView: (view: ActivityView) => void;
    counts: { open: number; settling: number };
    tokenIds: string[];
    tokens: Tokens;
}) {
    return (
        <nav aria-label="Filter activity" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:sticky md:top-24 md:mx-0 md:flex-col md:self-start md:overflow-visible md:px-0 md:pb-0">
            <Heading>Activity</Heading>
            {STAGES.map(({ view: v, label, icon: Icon }) => (
                <Item key={v} active={view === v} onClick={() => onView(v)} count={v === 'orders' ? counts.open : v === 'settling' ? counts.settling : undefined}>
                    <Icon className="h-4 w-4" /> {label}
                </Item>
            ))}
            <Heading>Type</Heading>
            {TYPES.map(({ view: v, label, icon: Icon }) => (
                <Item key={v} active={view === v} onClick={() => onView(v)}>
                    <Icon className="h-4 w-4" /> {label}
                </Item>
            ))}
            {tokenIds.length > 0 && <Heading>Token</Heading>}
            {tokenIds.map(id => (
                <Item key={id} active={view === `token:${id}`} onClick={() => onView(`token:${id}`)}>
                    <TokenLogo token={tokens[id] as never} size="sm" suppressFlame /> {tokens[id].symbol}
                </Item>
            ))}
        </nav>
    );
}
