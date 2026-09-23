"use client";

import { InfoTooltip } from '@/components/ui/tooltip';
import { EXECUTOR_DEFAULT_SLIPPAGE, WAITING_FOR_QUOTES, type RangePreview as Preview } from '@/lib/range/profit-preview';

interface Props {
    preview: Preview;
    /** Router failure text; shown in place of the generic waiting text. */
    quoteError: string | null;
    runway: { sells: number; buys: number };
    busy: boolean;
    onCreate: () => void;
}

const usd = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;

export default function RangePreview({ preview, quoteError, runway, busy, onCreate }: Props) {
    const reasons = preview.reasons.map((r) => (r === WAITING_FOR_QUOTES && quoteError ? quoteError : r));
    const blocked = reasons.length > 0;
    const costText = preview.routeCostUsd !== null ? usd(preview.routeCostUsd) : (quoteError ?? WAITING_FOR_QUOTES);
    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/60">Spread</span><span className="font-mono">{(preview.spread * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-white/60">Per completed cycle</span><span className={`font-mono ${preview.netPerCycle > 0 ? 'text-green-400' : 'text-orange-400'}`}>{usd(preview.netPerCycle)}</span></div>
                <div className="flex justify-between gap-3">
                    <span className="text-white/60 flex items-center gap-1">
                        Route cost per cycle
                        <InfoTooltip content="Difference between each leg's quoted output and the mid price, from the same router the swap page uses. Recomputed as you change the amount." />
                    </span>
                    <span className={`font-mono text-right ${preview.routeCostUsd === null ? (quoteError ? 'text-red-300' : 'text-white/50') : ''}`}>{costText}</span>
                </div>
                <div className="text-xs text-white/50">Guaranteed minimum: {(1 - EXECUTOR_DEFAULT_SLIPPAGE) * 100}% of the quote at execution ({EXECUTOR_DEFAULT_SLIPPAGE * 100}% slippage post-condition)</div>
                <div className="pt-1">
                    <span className="text-2xl font-semibold">{usd(preview.ifAll)}</span>
                    <span className="ml-2 text-xs text-white/50">if every window completes a cycle</span>
                    <InfoTooltip content="A cycle only completes when price crosses both lines inside one window. If price trends one way, only one leg fires. This number is not a forecast." />
                </div>
                {blocked && (
                    <ul className="text-xs text-orange-400 list-disc pl-4 space-y-1">
                        {reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                )}
            </div>
            <button
                type="button"
                disabled={blocked || busy}
                onClick={onCreate}
                className="w-full rounded-xl bg-purple-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
                {blocked ? 'Fix the items above' : `Create ${preview.orderCount} orders`}
                <span className="block text-xs font-normal opacity-80">
                    {preview.orderCount} signatures, one after another · sells cover {runway.sells} windows, buys cover {runway.buys}
                </span>
            </button>
        </div>
    );
}
