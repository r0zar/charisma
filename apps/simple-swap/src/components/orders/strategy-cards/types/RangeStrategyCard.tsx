"use client";

import React, { useEffect, useState } from 'react';
import type { LineData } from 'lightweight-charts';
import { RangeStrategyCardProps } from '../base/shared-types';
import { BaseStrategyCard } from '../base/BaseStrategyCard';
import { PremiumStatusBadge } from '../../orders-panel';
import { matchRangeLegs, LegOutcome } from '@/lib/range/match-legs';
import { runwayFor } from '@/lib/range/profit-preview';
import type { RangeSettings } from '@/lib/range/types';
import { usePriceSeriesService } from '@/lib/charts/price-series-service';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const usd = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;

/** Nearest series point at or before the timestamp. Null when the series has nothing that early. */
function priceAtFrom(series: LineData[]): (isoTime: string) => number | null {
    return (isoTime) => {
        const t = Date.parse(isoTime) / 1000;
        let best: LineData | null = null;
        for (const p of series) { if (Number(p.time) <= t) best = p; else break; }
        return best ? best.value : null;
    };
}

const OUTCOME_LABEL: Record<LegOutcome, string> = { hit: 'filled', expired: 'expired', cancelled: 'cancelled', open: 'open', future: 'upcoming' };

const plural = (n: number, word: string) => `${n} unpriced ${word}${n === 1 ? '' : 's'}`;

function unpricedLabel(legs: number, pairs: number): string {
    const parts = [legs ? plural(legs, 'leg') : '', pairs ? plural(pairs, 'pair') : ''].filter(Boolean);
    return parts.length ? `(${parts.join(', ')})` : 'at quote';
}

function windowOf(o: { uuid: string; strategyPosition?: number }): number {
    if (o.strategyPosition === undefined) throw new Error(`Range order ${o.uuid} has no strategyPosition`);
    return Math.ceil(o.strategyPosition / 2);
}

export const RangeStrategyCard: React.FC<RangeStrategyCardProps> = (props) => {
    const { strategyData, expandedStrategies, onToggleExpansion, onCancelOrder, onCancelOrders, formatTokenAmount } = props;
    const { id, orders } = strategyData;
    const first = orders[0];
    const range = first.metadata?.range as RangeSettings | undefined;
    const pairB = range?.pair.b;
    const isExpanded = expandedStrategies.has(id);

    const { address } = useWallet();
    const { getSubnetBalance, balances } = useBalances(address ? [address] : []);
    // Gate on whether this wallet's balances have arrived, not on the refresh flag:
    // the provider flips isLoading every 60s, which would unmount the runway meter on each tick.
    const hasBalances = Boolean(address && balances[address]);
    const priceSeries = usePriceSeriesService();
    const [seriesB, setSeriesB] = useState<LineData[] | null>(null);
    const [seriesError, setSeriesError] = useState<string | null>(null);

    useEffect(() => {
        if (!pairB) return;
        let cancelled = false;
        priceSeries.fetchBulkPriceSeries([pairB], '30d')
            .then((bulk) => {
                if (cancelled) return;
                if (bulk[pairB].length === 0) { setSeriesError(`No price history for ${pairB}`); return; }
                setSeriesB(bulk[pairB]);
            })
            .catch((err) => { if (!cancelled) setSeriesError(err instanceof Error ? err.message : 'Failed to load prices'); });
        return () => { cancelled = true; };
    }, [pairB, priceSeries]);

    if (!range) {
        return (
            <BaseStrategyCard {...props} onClick={() => onToggleExpansion(id)}>
                <div className="text-sm text-ink-body">Range swap · {orders.length} orders</div>
                <div className="text-xs text-accent-text">This run has no band settings saved, so the chart and profit can&apos;t be shown.</div>
            </BaseStrategyCard>
        );
    }

    const [metaA, metaB] = first.leg === 'sell' ? [first.inputTokenMeta, first.outputTokenMeta] : [first.outputTokenMeta, first.inputTokenMeta];
    const symA = metaA.symbol;
    const symB = metaB.symbol;
    const decA = metaA.decimals;
    const decB = metaB.decimals;
    if (decA === undefined || decB === undefined) {
        return (
            <BaseStrategyCard {...props} onClick={() => onToggleExpansion(id)}>
                <div className="text-sm text-ink-body">Range swap · {symA} ⇄ {symB} · {orders.length} orders</div>
                <div className="text-xs text-accent-text">Token decimals are missing for {decA === undefined ? symA : symB}, so amounts and profit can&apos;t be shown.</div>
            </BaseStrategyCard>
        );
    }

    const priceAt = seriesB ? priceAtFrom(seriesB) : () => null;
    const m = matchRangeLegs(orders, { b: range.pair.b, decimalsB: decB, decimalsA: decA }, (_id, ts) => priceAt(ts));

    const sellLeg = orders.find((o) => o.leg === 'sell');
    const buyLeg = orders.find((o) => o.leg === 'buy');
    const sellAmt = sellLeg ? Number(sellLeg.amountIn) / 10 ** decA : 0;
    const buyAmt = buyLeg ? Number(buyLeg.amountIn) / 10 ** decB : 0;
    const runway = m.status === 'live' && address && hasBalances ? {
        sells: runwayFor(getSubnetBalance(address, range.subnet.a) / 10 ** decA, sellAmt),
        buys: runwayFor(getSubnetBalance(address, range.subnet.b) / 10 ** decB, buyAmt),
    } : null;
    const low = runway !== null && (runway.sells < 3 || runway.buys < 3);
    // Broadcasted legs are excluded: their transaction is already in flight.
    const openUuids = orders
        .filter((o) => (m.outcomes[o.uuid] === 'open' && o.status === 'open') || m.outcomes[o.uuid] === 'future')
        .map((o) => o.uuid);
    const realized = seriesError || !seriesB || (m.cyclesDone === 0 && m.unpricedPairs > 0) ? '—' : usd(m.realizedUsd);
    const currentWindow = Math.min(range.windows, m.windowsElapsed + 1);
    const cadence = range.intervalHours === 1 ? 'hourly' : range.intervalHours === 24 ? 'daily' : range.intervalHours === 168 ? 'weekly' : `every ${range.intervalHours}h`;

    const windowsList = Array.from({ length: range.windows }, (_, i) => i + 1).map((w) => ({
        w,
        sell: orders.find((o) => o.leg === 'sell' && windowOf(o) === w),
        buy: orders.find((o) => o.leg === 'buy' && windowOf(o) === w),
    }));

    return (
        <BaseStrategyCard {...props} onClick={() => onToggleExpansion(id)}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <div className="text-sm font-medium text-ink">↕ {symA} ⇄ {symB}</div>
                    <div className="text-xs text-ink-muted">Range swap · {cadence} · window {currentWindow} of {range.windows} · started {new Date(range.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2">
                    {runway && low && <span className="text-xs px-2 py-1 rounded-lg bg-warning/15 text-warning">{runway.sells < 3 ? `${symA} low · ${runway.sells} sells left` : `${symB} low · ${runway.buys} buys left`}</span>}
                    <PremiumStatusBadge status={m.status === 'live' ? 'open' : m.status === 'completed' ? 'confirmed' : 'cancelled'} conditionIcon={null} />
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div><div className="text-ink-muted uppercase tracking-wider">Realized {seriesError ? '(prices unavailable)' : unpricedLabel(m.unpricedLegs, m.unpricedPairs)}</div><div className={`font-mono text-base ${m.realizedUsd >= 0 ? 'text-success' : 'text-accent-text'}`}>{realized}</div></div>
                <div><div className="text-ink-muted uppercase tracking-wider">Cycles done</div><div className="font-mono text-base">{m.cyclesDone} of {m.windowsElapsed} so far</div></div>
                <div><div className="text-ink-muted uppercase tracking-wider">Hit rate</div><div className="font-mono text-base">{m.legsHit} of {m.legsEnded} legs</div></div>
                <div><div className="text-ink-muted uppercase tracking-wider">Sells hit</div><div className="font-mono text-base">{m.sellsHit}{m.unmatchedSells ? ` · ${m.unmatchedSells} unmatched` : ''}</div></div>
                <div><div className="text-ink-muted uppercase tracking-wider">Buys hit</div><div className="font-mono text-base">{m.buysHit}{m.unmatchedBuys ? ` · ${m.unmatchedBuys} unmatched` : ''}</div></div>
                <div><div className="text-ink-muted uppercase tracking-wider">Open position</div><div className="font-mono text-base">{m.openPositionB > 0 ? `+${m.openPositionB.toFixed(2)} ${symB}` : m.openPositionA > 0 ? `+${m.openPositionA.toFixed(2)} ${symA}` : 'flat'}</div></div>
            </div>

            {runway && (
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-ink-muted"><span>Runway</span><span>refills as the other side fills</span></div>
                    <div className="flex justify-between"><span className="text-accent-text">{symA} covers {runway.sells} more sells</span>{runway.sells < 3 && <span className="text-warning">low</span>}</div>
                    <div className="h-1.5 rounded bg-surface-hover" aria-hidden="true"><div className="h-full rounded bg-accent" style={{ width: `${Math.min(100, runway.sells * 10)}%` }} /></div>
                    <div className="flex justify-between"><span className="text-success">{symB} covers {runway.buys} more buys</span>{runway.buys < 3 && <span className="text-warning">low</span>}</div>
                    <div className="h-1.5 rounded bg-surface-hover" aria-hidden="true"><div className="h-full rounded bg-success" style={{ width: `${Math.min(100, runway.buys * 10)}%` }} /></div>
                </div>
            )}

            <div className="flex items-center justify-center pt-2">
                <button type="button" aria-expanded={isExpanded} onClick={(e) => { e.stopPropagation(); onToggleExpansion(id); }} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface hover:bg-surface-hover text-ink-muted text-xs">
                    <span>{isExpanded ? 'Hide windows' : `Show ${range.windows} windows`}</span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                </button>
            </div>

            {isExpanded && (
                <div className="border-t border-line pt-3 space-y-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    {windowsList.map(({ w, sell, buy }) => (
                        <div key={w} className="grid grid-cols-[44px_1fr_1fr] gap-2 py-1.5 border-b border-dashed border-line-soft">
                            <span className="font-mono text-ink-muted">#{w}</span>
                            {[sell, buy].map((o, k) => o ? (
                                <span key={o.uuid} className={cn(m.outcomes[o.uuid] === 'hit' ? (k === 0 ? 'text-accent-text' : 'text-success') : 'text-ink-muted')}>
                                    {k === 0 ? 'sell ≥' : 'buy ≤'} {Number(o.targetPrice).toLocaleString(undefined, { maximumSignificantDigits: 6 })} · {OUTCOME_LABEL[m.outcomes[o.uuid]]}
                                    {m.outcomes[o.uuid] === 'hit' && o.metadata?.quote?.amountOut !== undefined && o.outputTokenMeta.decimals !== undefined && ` · ${formatTokenAmount(o.metadata.quote.amountOut, o.outputTokenMeta.decimals)} ${o.outputTokenMeta.symbol}`}
                                    {openUuids.includes(o.uuid) && (
                                        <button type="button" aria-label={`Cancel ${k === 0 ? 'sell' : 'buy'} for window ${w}`} onClick={() => onCancelOrder(o.uuid)} className="ml-2 text-danger/80 hover:text-danger">cancel</button>
                                    )}
                                </span>
                            ) : <span key={k} className="text-ink-faint">—</span>)}
                        </div>
                    ))}
                    {openUuids.length > 0 && onCancelOrders && (
                        <button
                            type="button"
                            onClick={() => onCancelOrders(openUuids)}
                            className="mt-2 px-3 py-1.5 rounded-lg border border-danger/40 text-danger hover:bg-danger/10"
                        >
                            Cancel remaining · {openUuids.length} open
                        </button>
                    )}
                </div>
            )}
        </BaseStrategyCard>
    );
};
