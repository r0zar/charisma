"use client";

import { Check, Loader2, X } from 'lucide-react';
import type { RangeLegSpec } from '@/lib/range/types';

export type LegStatus = 'pending' | 'signing' | 'done' | 'error';

interface Props {
    legs: RangeLegSpec[];
    statuses: LegStatus[];
    symbols: { a: string; b: string };
}

export default function RangeSchedule({ legs, statuses, symbols }: Props) {
    return (
        <div className="rounded-xl border border-line bg-surface-sunken p-4">
            <h4 className="text-sm font-medium text-ink mb-3">Orders ({legs.length})</h4>
            <div className="max-h-80 overflow-y-auto space-y-1 text-xs">
                {legs.map((leg, i) => (
                    <div key={`${leg.window}-${leg.leg}`} className="grid grid-cols-[48px_1fr_auto_20px] items-center gap-3 py-1.5 border-b border-dashed border-line-soft">
                        <span className="font-mono text-ink-muted">#{leg.window}</span>
                        <span className={leg.leg === 'sell' ? 'text-accent-text' : 'text-success'}>
                            {leg.leg === 'sell' ? `sell ≥ ${Number(leg.targetPrice).toPrecision(4)}` : `buy ≤ ${Number(leg.targetPrice).toPrecision(4)}`}
                            <span className="text-ink-muted"> · {leg.amountDisplay} {leg.leg === 'sell' ? symbols.a : symbols.b}</span>
                        </span>
                        <span className="font-mono text-ink-muted">{new Date(leg.validFrom).toLocaleDateString()}</span>
                        <span>
                            {statuses[i] === 'pending' && <span className="block h-3 w-3 rounded-full border border-line-strong" />}
                            {statuses[i] === 'signing' && <Loader2 className="h-3 w-3 animate-spin text-accent-text" />}
                            {statuses[i] === 'done' && <Check className="h-3 w-3 text-success" />}
                            {statuses[i] === 'error' && <X className="h-3 w-3 text-danger" />}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
