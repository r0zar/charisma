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
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h4 className="text-sm font-medium text-white/90 mb-3">Orders ({legs.length})</h4>
            <div className="max-h-80 overflow-y-auto space-y-1 text-xs">
                {legs.map((leg, i) => (
                    <div key={`${leg.window}-${leg.leg}`} className="grid grid-cols-[48px_1fr_auto_20px] items-center gap-3 py-1.5 border-b border-dashed border-white/[0.06]">
                        <span className="font-mono text-white/50">#{leg.window}</span>
                        <span className={leg.leg === 'sell' ? 'text-orange-400' : 'text-green-400'}>
                            {leg.leg === 'sell' ? `sell ≥ ${Number(leg.targetPrice).toPrecision(4)}` : `buy ≤ ${Number(leg.targetPrice).toPrecision(4)}`}
                            <span className="text-white/50"> · {leg.amountDisplay} {leg.leg === 'sell' ? symbols.a : symbols.b}</span>
                        </span>
                        <span className="font-mono text-white/40">{new Date(leg.validFrom).toLocaleDateString()}</span>
                        <span>
                            {statuses[i] === 'pending' && <span className="block h-3 w-3 rounded-full border border-white/20" />}
                            {statuses[i] === 'signing' && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
                            {statuses[i] === 'done' && <Check className="h-3 w-3 text-green-400" />}
                            {statuses[i] === 'error' && <X className="h-3 w-3 text-red-400" />}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
