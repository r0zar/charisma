"use client";

import { InfoTooltip } from '@/components/ui/tooltip';
import type { RangePreview as Preview } from '@/lib/range/profit-preview';

interface Props {
    preview: Preview;
    runway: { sells: number; buys: number };
    busy: boolean;
    onCreate: () => void;
}

const usd = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;

export default function RangePreview({ preview, runway, busy, onCreate }: Props) {
    const blocked = preview.reasons.length > 0;
    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/60">Spread</span><span className="font-mono">{(preview.spread * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-white/60">Per completed cycle</span><span className={`font-mono ${preview.netPerCycle > 0 ? 'text-green-400' : 'text-orange-400'}`}>{usd(preview.netPerCycle)}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Costs per cycle</span><span className="font-mono">${preview.slippageCost.toFixed(2)} slippage, 1% per leg</span></div>
                <div className="pt-1">
                    <span className="text-2xl font-semibold">{usd(preview.ifAll)}</span>
                    <span className="ml-2 text-xs text-white/50">if every window completes a cycle</span>
                    <InfoTooltip content="A cycle only completes when price crosses both lines inside one window. If price trends one way, only one leg fires. This number is not a forecast." />
                </div>
                {blocked && (
                    <ul className="text-xs text-orange-400 list-disc pl-4 space-y-1">
                        {preview.reasons.map((r) => <li key={r}>{r}</li>)}
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
