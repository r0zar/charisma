"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { usePrices } from '@/contexts/token-price-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { createRangeLeg } from '@/lib/range/create-leg';
import { generateRangeLegs } from '@/lib/range/generate-legs';
import { rangeProfitPreview, runwayFor, windowsFor } from '@/lib/range/profit-preview';
import type { RangeLegSpec, RangeSettings } from '@/lib/range/types';
import RangeControls, { type RangeForm } from './RangeControls';
import RangePreview from './RangePreview';
import RangeSchedule, { type LegStatus } from './RangeSchedule';

const ConditionTokenChart = dynamic(() => import('@/components/condition-token-chart'), { ssr: false });

const DEFAULT_FORM: RangeForm = { sellPct: 8, buyPct: 8, perSwapUsd: 50, intervalHours: 24, runDays: 30, tilt: 0 };

/** Dragged line → tenths of a percent, clamped to the matching input's min/max so the field never shows an out-of-range value. */
const dragPct = (x: number, max: number) => Math.min(max, Math.max(0.5, Math.round(x * 10) / 10));

export default function RangePage() {
    const [tokenA, setTokenA] = useState<TokenCacheData | null>(null);
    const [tokenB, setTokenB] = useState<TokenCacheData | null>(null);
    const [form, setForm] = useState<RangeForm>(DEFAULT_FORM);
    const [phase, setPhase] = useState<'setup' | 'signing' | 'done'>('setup');
    const [legs, setLegs] = useState<RangeLegSpec[]>([]);
    const [statuses, setStatuses] = useState<LegStatus[]>([]);
    const [symbols, setSymbols] = useState<{ a: string; b: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    const { address } = useWallet();
    const { getPrice } = usePrices();
    const { getSubnetContractId } = useSubnetTokens();
    const { getSubnetBalance } = useBalances(address ? [address] : []);

    const priceA = tokenA ? getPrice(tokenA.contractId) : null;
    const priceB = tokenB ? getPrice(tokenB.contractId) : null;
    // One nullable object so TypeScript narrows both prices together.
    const prices = priceA !== null && priceB !== null && priceA > 0 && priceB > 0 ? { a: priceA, b: priceB } : null;
    const bothPicked = !!tokenA && !!tokenB;
    const ready = bothPicked && prices !== null;
    const ratio = prices ? prices.a / prices.b : 0;
    const sell = ratio * (1 + form.sellPct / 100);
    const buy = ratio * (1 - form.buyPct / 100);
    const windows = windowsFor(form.runDays * 24, form.intervalHours);
    const preview = rangeProfitPreview({ price: ratio, sell, buy, perSwapUsd: form.perSwapUsd, windows });

    // Display-only formatting before a token is picked; `create` requires real decimals.
    const decA = tokenA?.decimals ?? 6, decB = tokenB?.decimals ?? 6;
    const amountA = prices ? form.perSwapUsd / prices.a : 0;
    const amountB = prices ? form.perSwapUsd / prices.b : 0;
    const subnetA = tokenA ? getSubnetContractId(tokenA.contractId) : null;
    const subnetB = tokenB ? getSubnetContractId(tokenB.contractId) : null;
    const runway = {
        sells: address && subnetA ? runwayFor(getSubnetBalance(address, subnetA) / 10 ** decA, amountA) : 0,
        buys: address && subnetB ? runwayFor(getSubnetBalance(address, subnetB) / 10 ** decB, amountB) : 0,
    };

    const patch = (p: Partial<RangeForm>) => setForm((f) => ({ ...f, ...p }));
    const onDrag = (line: 'sell' | 'buy', price: number) => {
        if (!ratio) return;
        if (line === 'sell') patch({ sellPct: dragPct((price / ratio - 1) * 100, 200) });
        else patch({ buyPct: dragPct((1 - price / ratio) * 100, 99) });
    };

    const create = async () => {
        if (phase === 'signing') return;
        if (!prices || !tokenA || !tokenB || !subnetA || !subnetB || !address || preview.reasons.length) return;
        setError(null);

        let specs: RangeLegSpec[];
        let settings: RangeSettings;
        try {
            if (tokenA.decimals === undefined || tokenB.decimals === undefined) {
                throw new Error(`Missing decimals for ${tokenA.symbol} or ${tokenB.symbol}`);
            }
            const now = Date.now();
            settings = {
                pair: { a: tokenA.contractId, b: tokenB.contractId },
                subnet: { a: subnetA, b: subnetB },
                sellStart: sell, buyStart: buy, tilt: form.tilt,
                intervalHours: form.intervalHours, windows, perSwapUsd: form.perSwapUsd,
                createdAt: new Date(now).toISOString(),
            };
            specs = generateRangeLegs(settings, prices, { a: tokenA.decimals, b: tokenB.decimals }, now);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return;
        }

        setLegs(specs);
        setStatuses(specs.map(() => 'pending'));
        setSymbols({ a: tokenA.symbol, b: tokenB.symbol });
        setPhase('signing');
        const strategyId = crypto.randomUUID();

        for (let i = 0; i < specs.length; i++) {
            if (!aliveRef.current) return;
            setStatuses((s) => s.map((v, k) => (k === i ? 'signing' : v)));
            try {
                await createRangeLeg(address, specs[i], { strategyId, strategySize: specs.length, range: settings });
                setStatuses((s) => s.map((v, k) => (k === i ? 'done' : v)));
            } catch (err) {
                setStatuses((s) => s.map((v, k) => (k === i ? 'error' : v)));
                setError(`Stopped at order ${i + 1} of ${specs.length}: ${err instanceof Error ? err.message : String(err)}. Orders already signed are live.`);
                break;
            }
        }
        if (aliveRef.current) setPhase('done');
    };

    return (
        <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-white/95">Range Swaps</h1>
                <p className="text-sm text-white/60">Sell at the top line, buy back at the bottom line, every window, for as long as you choose.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    {ready && tokenA && tokenB ? (
                        <ConditionTokenChart
                            token={tokenA}
                            baseToken={tokenB}
                            targetPrice=""
                            onTargetPriceChange={() => {}}
                            band={{ sell, buy, tilt: form.tilt, windows, intervalHours: form.intervalHours, onDrag }}
                        />
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-sm text-white/50">
                            {bothPicked ? 'Waiting for prices' : 'Pick two tokens to see the chart.'}
                        </div>
                    )}
                </div>
                <div className="space-y-4">
                    <RangeControls
                        tokenA={tokenA} tokenB={tokenB} onTokenA={setTokenA} onTokenB={setTokenB}
                        form={form} onChange={patch}
                        sellPrice={sell} buyPrice={buy}
                        amountA={amountA.toFixed(Math.min(decA, 4))} amountB={amountB.toFixed(Math.min(decB, 4))}
                    />
                    <RangePreview
                        preview={ready ? preview : { ...preview, reasons: [bothPicked ? 'Waiting for prices' : 'Pick two tokens'] }}
                        runway={runway}
                        busy={phase === 'signing'}
                        onCreate={create}
                    />
                    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
                </div>
            </div>
            {legs.length > 0 && symbols && (
                <RangeSchedule legs={legs} statuses={statuses} symbols={symbols} />
            )}
        </div>
    );
}
