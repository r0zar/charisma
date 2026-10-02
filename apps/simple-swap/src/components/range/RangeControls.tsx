"use client";

import type { ChangeEvent } from 'react';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { MAX_ORDERS, windowsFor } from '@/lib/range/profit-preview';
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
    onSwap: () => void;
    form: RangeForm;
    onChange: (patch: Partial<RangeForm>) => void;
    sellPrice: number;
    buyPrice: number;
    amountA: string;
    amountB: string;
}

const INTERVALS = [{ h: 6, label: '6 hours' }, { h: 24, label: 'Day' }, { h: 168, label: 'Week' }];
const RUNS = [{ d: 7, label: '1 week' }, { d: 30, label: '1 month' }, { d: 90, label: '3 months' }];

interface SegOption<T> { v: T; label: string; disabled?: boolean; title?: string }

function Seg<T extends number>({ options, value, onPick, labelId }: { options: SegOption<T>[]; value: T; onPick: (v: T) => void; labelId: string }) {
    return (
        <div role="group" aria-labelledby={labelId} className="grid grid-flow-col gap-1 bg-surface border border-line rounded-lg p-0.5">
            {options.map((o) => (
                <button
                    key={o.v}
                    type="button"
                    aria-pressed={value === o.v}
                    disabled={o.disabled}
                    title={o.disabled ? o.title : undefined}
                    onClick={() => onPick(o.v)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${value === o.v ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:text-ink-body'} ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

const NO_SPINNER = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
const STEP_BTN = 'w-6 h-6 rounded-md bg-surface hover:bg-surface-selected text-ink-muted hover:text-ink transition-all duration-200 flex items-center justify-center text-xs font-medium';

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
        <div className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-sm ${className}`}>
            <label htmlFor={id}>{label}</label><span className="text-ink-muted">{sign}</span>
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
            <span className="text-ink-muted">%</span>
        </div>
    );
}

/** Orders a run would create: two per window. Mirrors the preview's cap check so presets that cannot work are greyed out. */
const orderCountFor = (intervalHours: number, runDays: number) => windowsFor(runDays * 24, intervalHours) * 2;

export default function RangeControls({ tokenA, tokenB, onTokenA, onTokenB, onSwap, form, onChange, sellPrice, buyPrice, amountA, amountB }: Props) {
    const intervalOptions = INTERVALS.map((i) => ({
        v: i.h, label: i.label,
        disabled: orderCountFor(i.h, form.runDays) > MAX_ORDERS,
        title: `Over the ${MAX_ORDERS}-order cap with the current run length`,
    }));
    const runOptions = RUNS.map((r) => ({
        v: r.d, label: r.label,
        disabled: orderCountFor(form.intervalHours, r.d) > MAX_ORDERS,
        title: `Over the ${MAX_ORDERS}-order cap with the current interval`,
    }));
    /** Number input handler; a cleared field (NaN) is ignored so the value does not snap to 0 mid-edit. */
    const set = (key: keyof RangeForm, scale = 1) => (e: ChangeEvent<HTMLInputElement>) => {
        const v = e.target.valueAsNumber;
        if (!Number.isNaN(v)) onChange({ [key]: v / scale });
    };
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div id="range-pair-label" className="text-xs text-ink-muted">Pair</div>
                <div role="group" aria-labelledby="range-pair-label" className="flex items-center gap-2">
                    <SubnetPairSelector label="Sell" selected={tokenA} onSelect={onTokenA} exclude={tokenB?.contractId} />
                    <button
                        type="button"
                        aria-label="Swap sell and buy tokens"
                        onClick={onSwap}
                        disabled={!tokenA || !tokenB}
                        className="rounded-md px-1.5 py-1 text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-muted"
                    >
                        ⇄
                    </button>
                    <SubnetPairSelector label="For" selected={tokenB} onSelect={onTokenB} exclude={tokenA?.contractId} />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-ink-muted">
                    <span>Band around current price</span>
                    <span className="font-mono">{sellPrice.toPrecision(4)} / {buyPrice.toPrecision(4)}</span>
                </div>
                <BandInput id="range-sell-pct" label="Sell above" name="sell" sign="+" className="border-accent/50 [&>label]:text-accent-text" value={form.sellPct} min={0.5} max={200} onValue={(v) => onChange({ sellPct: v })} />
                <BandInput id="range-buy-pct" label="Buy below" name="buy" sign="−" className="border-success/50 [&>label]:text-success" value={form.buyPct} min={0.5} max={99} onValue={(v) => onChange({ buyPct: v })} />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-ink-muted">
                    <label htmlFor="range-usd">Per swap</label>
                    <span className="font-mono">≈ {amountA} {tokenA?.symbol ?? ''} · {amountB} {tokenB?.symbol ?? ''}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                    <span className="text-ink-muted">$</span>
                    <input id="range-usd" type="number" min={1} step={5} value={form.perSwapUsd} onChange={set('perSwapUsd')} className={`w-full bg-transparent text-lg outline-none ${NO_SPINNER}`} />
                    <span className="text-xs text-ink-muted">USD</span>
                </div>
            </div>

            <div className="space-y-2">
                <div id="range-interval-label" className="text-xs text-ink-muted">Trigger every</div>
                <Seg labelId="range-interval-label" options={intervalOptions} value={form.intervalHours} onPick={(h) => onChange({ intervalHours: h })} />
            </div>

            <div className="space-y-2">
                <div id="range-run-label" className="text-xs text-ink-muted">Run for</div>
                <Seg labelId="range-run-label" options={runOptions} value={form.runDays} onPick={(d) => onChange({ runDays: d })} />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-ink-muted">
                    <label htmlFor="range-tilt">Tilt</label>
                    <span className="font-mono">{form.tilt >= 0 ? '+' : '−'}{Math.abs(Math.round(form.tilt * 100))}% by the end</span>
                </div>
                <input id="range-tilt" type="range" min={-40} max={40} step={1} value={Math.round(form.tilt * 100)} onChange={set('tilt', 100)} className="w-full accent-purple-400" />
            </div>
        </div>
    );
}
