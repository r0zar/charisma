"use client";

import type { ChangeEvent } from 'react';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import SubnetPairSelector from './SubnetPairSelector';

export interface RangeForm {
    sellPct: number;
    buyPct: number;
    perSwapUsd: number;
    intervalHours: number;
    runDays: number;
    tilt: number;
}

interface Props {
    tokenA: TokenCacheData | null;
    tokenB: TokenCacheData | null;
    onTokenA: (t: TokenCacheData) => void;
    onTokenB: (t: TokenCacheData) => void;
    form: RangeForm;
    onChange: (patch: Partial<RangeForm>) => void;
    sellPrice: number;
    buyPrice: number;
    amountA: string;
    amountB: string;
}

const INTERVALS = [{ h: 1, label: 'Hour' }, { h: 24, label: 'Day' }, { h: 168, label: 'Week' }];
const RUNS = [{ d: 7, label: '1 week' }, { d: 30, label: '1 month' }, { d: 90, label: '3 months' }];

function Seg<T extends number>({ options, value, onPick }: { options: { v: T; label: string }[]; value: T; onPick: (v: T) => void }) {
    return (
        <div className="grid grid-flow-col gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
            {options.map((o) => (
                <button
                    key={o.v}
                    type="button"
                    onClick={() => onPick(o.v)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${value === o.v ? 'bg-white/[0.1] text-white/95' : 'text-white/60 hover:text-white/80'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function RangeControls({ tokenA, tokenB, onTokenA, onTokenB, form, onChange, sellPrice, buyPrice, amountA, amountB }: Props) {
    const num = (e: ChangeEvent<HTMLInputElement>) => Number(e.target.value);
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs text-white/60">Pair</label>
                <div className="flex items-center gap-2">
                    <SubnetPairSelector label="Sell" selected={tokenA} onSelect={onTokenA} exclude={tokenB?.contractId} />
                    <span className="text-white/40">⇄</span>
                    <SubnetPairSelector label="For" selected={tokenB} onSelect={onTokenB} exclude={tokenA?.contractId} />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <span>Band around current price</span>
                    <span className="font-mono">{sellPrice.toPrecision(4)} / {buyPrice.toPrecision(4)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-orange-500/50 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="text-orange-400">Sell above</span><span className="text-white/50">+</span>
                    <input id="range-sell-pct" type="number" min={0.5} max={200} step={0.5} value={form.sellPct} onChange={(e) => onChange({ sellPct: num(e) })} className="w-full bg-transparent text-right outline-none" />
                    <span className="text-white/50">%</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="text-green-400">Buy below</span><span className="text-white/50">−</span>
                    <input id="range-buy-pct" type="number" min={0.5} max={99} step={0.5} value={form.buyPct} onChange={(e) => onChange({ buyPct: num(e) })} className="w-full bg-transparent text-right outline-none" />
                    <span className="text-white/50">%</span>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <label htmlFor="range-usd">Per swap</label>
                    <span className="font-mono">≈ {amountA} {tokenA?.symbol ?? ''} · {amountB} {tokenB?.symbol ?? ''}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                    <span className="text-white/50">$</span>
                    <input id="range-usd" type="number" min={1} step={5} value={form.perSwapUsd} onChange={(e) => onChange({ perSwapUsd: num(e) })} className="w-full bg-transparent text-lg outline-none" />
                    <span className="text-xs text-white/50">USD</span>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs text-white/60">Trigger every</label>
                <Seg options={INTERVALS.map((i) => ({ v: i.h, label: i.label }))} value={form.intervalHours} onPick={(h) => onChange({ intervalHours: h })} />
            </div>

            <div className="space-y-2">
                <label className="text-xs text-white/60">Run for</label>
                <Seg options={RUNS.map((r) => ({ v: r.d, label: r.label }))} value={form.runDays} onPick={(d) => onChange({ runDays: d })} />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <label htmlFor="range-tilt">Tilt</label>
                    <span className="font-mono">{form.tilt >= 0 ? '+' : '−'}{Math.abs(Math.round(form.tilt * 100))}% by the end</span>
                </div>
                <input id="range-tilt" type="range" min={-40} max={40} step={1} value={Math.round(form.tilt * 100)} onChange={(e) => onChange({ tilt: num(e) / 100 })} className="w-full accent-purple-400" />
            </div>
        </div>
    );
}
