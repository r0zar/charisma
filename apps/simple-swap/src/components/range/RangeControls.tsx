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

function Seg<T extends number>({ options, value, onPick, labelId }: { options: { v: T; label: string }[]; value: T; onPick: (v: T) => void; labelId: string }) {
    return (
        <div role="group" aria-labelledby={labelId} className="grid grid-flow-col gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
            {options.map((o) => (
                <button
                    key={o.v}
                    type="button"
                    aria-pressed={value === o.v}
                    onClick={() => onPick(o.v)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${value === o.v ? 'bg-white/[0.1] text-white/95' : 'text-white/60 hover:text-white/80'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

const NO_SPINNER = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
const STEP_BTN = 'w-6 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center text-xs font-medium';

interface BandInputProps {
    id: string;
    label: string;
    name: string;
    sign: string;
    className: string;
    value: number;
    min: number;
    max: number;
    onValue: (v: number) => void;
}

/** One band line: label, signed % input with the native spinner hidden, and themed −/+ buttons stepping by 0.5. */
function BandInput({ id, label, name, sign, className, value, min, max, onValue }: BandInputProps) {
    const clamp = (v: number) => Math.min(max, Math.max(min, v));
    const bump = (d: number) => onValue(clamp(Math.round((value + d) * 10) / 10));
    return (
        <div className={`flex items-center gap-2 rounded-lg border bg-white/[0.03] px-3 py-2 text-sm ${className}`}>
            <label htmlFor={id}>{label}</label><span className="text-white/50">{sign}</span>
            <input
                id={id}
                type="number"
                min={min}
                max={max}
                step={0.1}
                value={value}
                onChange={(e) => { const v = e.target.valueAsNumber; if (!Number.isNaN(v)) onValue(v); }}
                className={`w-full bg-transparent text-right outline-none ${NO_SPINNER}`}
            />
            <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" aria-label={`Decrease ${name} percent`} onClick={() => bump(-0.5)} className={STEP_BTN}>−</button>
                <button type="button" aria-label={`Increase ${name} percent`} onClick={() => bump(0.5)} className={STEP_BTN}>+</button>
            </div>
            <span className="text-white/50">%</span>
        </div>
    );
}

export default function RangeControls({ tokenA, tokenB, onTokenA, onTokenB, form, onChange, sellPrice, buyPrice, amountA, amountB }: Props) {
    /** Number input handler; a cleared field (NaN) is ignored so the value does not snap to 0 mid-edit. */
    const set = (key: keyof RangeForm, scale = 1) => (e: ChangeEvent<HTMLInputElement>) => {
        const v = e.target.valueAsNumber;
        if (!Number.isNaN(v)) onChange({ [key]: v / scale });
    };
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div id="range-pair-label" className="text-xs text-white/60">Pair</div>
                <div role="group" aria-labelledby="range-pair-label" className="flex items-center gap-2">
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
                <BandInput id="range-sell-pct" label="Sell above" name="sell" sign="+" className="border-orange-500/50 [&>label]:text-orange-400" value={form.sellPct} min={0.5} max={200} onValue={(v) => onChange({ sellPct: v })} />
                <BandInput id="range-buy-pct" label="Buy below" name="buy" sign="−" className="border-green-500/50 [&>label]:text-green-400" value={form.buyPct} min={0.5} max={99} onValue={(v) => onChange({ buyPct: v })} />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <label htmlFor="range-usd">Per swap</label>
                    <span className="font-mono">≈ {amountA} {tokenA?.symbol ?? ''} · {amountB} {tokenB?.symbol ?? ''}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                    <span className="text-white/50">$</span>
                    <input id="range-usd" type="number" min={1} step={5} value={form.perSwapUsd} onChange={set('perSwapUsd')} className={`w-full bg-transparent text-lg outline-none ${NO_SPINNER}`} />
                    <span className="text-xs text-white/50">USD</span>
                </div>
            </div>

            <div className="space-y-2">
                <div id="range-interval-label" className="text-xs text-white/60">Trigger every</div>
                <Seg labelId="range-interval-label" options={INTERVALS.map((i) => ({ v: i.h, label: i.label }))} value={form.intervalHours} onPick={(h) => onChange({ intervalHours: h })} />
            </div>

            <div className="space-y-2">
                <div id="range-run-label" className="text-xs text-white/60">Run for</div>
                <Seg labelId="range-run-label" options={RUNS.map((r) => ({ v: r.d, label: r.label }))} value={form.runDays} onPick={(d) => onChange({ runDays: d })} />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <label htmlFor="range-tilt">Tilt</label>
                    <span className="font-mono">{form.tilt >= 0 ? '+' : '−'}{Math.abs(Math.round(form.tilt * 100))}% by the end</span>
                </div>
                <input id="range-tilt" type="range" min={-40} max={40} step={1} value={Math.round(form.tilt * 100)} onChange={set('tilt', 100)} className="w-full accent-purple-400" />
            </div>
        </div>
    );
}
