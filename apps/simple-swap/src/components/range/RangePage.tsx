"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { usePrices } from '@/contexts/token-price-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { getQuote } from '@/app/actions';
import { convertToMicroUnits } from '@/lib/swap-utils';
import { createRangeLeg } from '@/lib/range/create-leg';
import { generateRangeLegs } from '@/lib/range/generate-legs';
import { rangeProfitPreview, runwayFor, windowsFor } from '@/lib/range/profit-preview';
import { routeCostPerCycle } from '@/lib/range/route-cost';
import { loadRangeSettings, saveRangeSettings } from '@/lib/range/settings-storage';
import type { RangeLegSpec, RangeSettings } from '@/lib/range/types';
import RangeControls, { type RangeForm } from './RangeControls';
import RangePreview from './RangePreview';
import RangeSchedule, { type LegStatus } from './RangeSchedule';
import { useSubnetFundedTokens } from './SubnetPairSelector';

const ConditionTokenChart = dynamic(() => import('@/components/condition-token-chart'), { ssr: false });

const DEFAULT_FORM: RangeForm = { sellPct: 20, buyPct: 20, perSwapUsd: 5, intervalHours: 24, runDays: 30, tilt: 0 };

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
    /** One quoted cycle in display units: what each leg sent and what the router quoted back (sell: A→B, buy: B→A). */
    const [quotes, setQuotes] = useState<{ sellIn: number; sellOut: number; buyIn: number; buyOut: number } | null>(null);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    /** Stored token ids still waiting for metadata and balances; null once resolved (or nothing was stored). */
    const [pendingIds, setPendingIds] = useState<{ a: string | null; b: string | null } | null>(null);
    const [storageLoaded, setStorageLoaded] = useState(false);
    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    const { address } = useWallet();
    const { getPrice } = usePrices();
    const { getSubnetContractId } = useSubnetTokens();
    const { getSubnetBalance, getBalance } = useBalances(address ? [address] : []);
    const { tokens, isLoading: metadataLoading } = useTokenMetadata();
    const funded = useSubnetFundedTokens();

    // Restore settings once on mount. The form applies immediately; tokens wait for metadata and balances below.
    useEffect(() => {
        const stored = loadRangeSettings();
        if (stored) {
            setForm(stored.form);
            if (stored.tokenA || stored.tokenB) setPendingIds({ a: stored.tokenA, b: stored.tokenB });
        }
        setStorageLoaded(true);
    }, []);

    // Resolve stored token ids once metadata and this wallet's balances exist, then stop.
    // A token the wallet no longer holds on the subnet is dropped rather than restored.
    const balancesLoaded = !!address && getBalance(address) !== null;
    useEffect(() => {
        if (!pendingIds || metadataLoading || !balancesLoaded) return;
        const pick = (id: string | null) => (id && tokens[id] ? funded.find((t) => t.contractId === id) ?? null : null);
        const a = pick(pendingIds.a);
        const b = pick(pendingIds.b);
        if (a) setTokenA(a);
        if (b) setTokenB(b);
        setPendingIds(null);
    }, [pendingIds, metadataLoading, balancesLoaded, tokens, funded]);

    // Persist whenever the form or pair changes; unresolved stored ids are carried until they resolve or drop.
    useEffect(() => {
        if (!storageLoaded) return;
        saveRangeSettings({
            form,
            tokenA: tokenA?.contractId ?? pendingIds?.a ?? null,
            tokenB: tokenB?.contractId ?? pendingIds?.b ?? null,
        });
    }, [storageLoaded, form, tokenA, tokenB, pendingIds]);

    const priceA = tokenA ? getPrice(tokenA.contractId) : null;
    const priceB = tokenB ? getPrice(tokenB.contractId) : null;
    // One nullable object so TypeScript narrows both prices together.
    const prices = priceA !== null && priceB !== null && priceA > 0 && priceB > 0 ? { a: priceA, b: priceB } : null;
    // Latest prices for the debounced quote, so a price tick neither re-quotes nor drops the quote we have.
    const pricesRef = useRef(prices);
    pricesRef.current = prices;
    const hasPrices = prices !== null;
    const bothPicked = !!tokenA && !!tokenB;
    const ready = bothPicked && prices !== null;
    const ratio = prices ? prices.a / prices.b : 0;
    const sell = ratio * (1 + form.sellPct / 100);
    const buy = ratio * (1 - form.buyPct / 100);
    const windows = windowsFor(form.runDays * 24, form.intervalHours);

    // Display-only formatting before a token is picked; `create` and quoting require real decimals.
    const decA = tokenA?.decimals ?? 6, decB = tokenB?.decimals ?? 6;
    // Rounded to the token's decimals so display, runway and the quote request all describe the same amount.
    const amountA = prices ? Number((form.perSwapUsd / prices.a).toFixed(decA)) : 0;
    const amountB = prices ? Number((form.perSwapUsd / prices.b).toFixed(decB)) : 0;
    const subnetA = tokenA ? getSubnetContractId(tokenA.contractId) : null;
    const subnetB = tokenB ? getSubnetContractId(tokenB.contractId) : null;
    const perSwapUsd = form.perSwapUsd;
    const realDecA = tokenA?.decimals, realDecB = tokenB?.decimals;

    // Quote both legs through the router (same one the swap page uses), debounced, dropping stale responses.
    // Keyed on the inputs that change the request; prices are read through the ref when the timer fires.
    useEffect(() => {
        setQuotes(null);
        setQuoteError(null);
        if (!subnetA || !subnetB || !hasPrices || !(perSwapUsd > 0) || realDecA === undefined || realDecB === undefined) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            const p = pricesRef.current;
            if (!p) return;
            try {
                const sellIn = Number((perSwapUsd / p.a).toFixed(realDecA));
                const buyIn = Number((perSwapUsd / p.b).toFixed(realDecB));
                const microA = convertToMicroUnits(sellIn.toFixed(realDecA), realDecA);
                const microB = convertToMicroUnits(buyIn.toFixed(realDecB), realDecB);
                if (microA === '0' || microB === '0') throw new Error('Per-swap amount rounds to zero for one token');
                const [sellQ, buyQ] = await Promise.all([getQuote(subnetA, subnetB, microA), getQuote(subnetB, subnetA, microB)]);
                if (cancelled) return;
                if (!sellQ.data) throw new Error(`Sell leg: ${sellQ.error ?? 'no route'}`);
                if (!buyQ.data) throw new Error(`Buy leg: ${buyQ.error ?? 'no route'}`);
                setQuotes({ sellIn, sellOut: sellQ.data.amountOut / 10 ** realDecB, buyIn, buyOut: buyQ.data.amountOut / 10 ** realDecA });
            } catch (err) {
                if (!cancelled) setQuoteError(err instanceof Error ? err.message : String(err));
            }
        }, 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [subnetA, subnetB, perSwapUsd, hasPrices, realDecA, realDecB]);

    const routeCostUsd = prices && quotes ? routeCostPerCycle({ ...quotes, priceA: prices.a, priceB: prices.b }).totalUsd : null;
    const preview = rangeProfitPreview({ price: ratio, sell, buy, perSwapUsd, windows, routeCostUsd });
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
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col">
                    <div className="flex-1 min-h-[560px]">
                        {ready && tokenA && tokenB ? (
                            <ConditionTokenChart
                                token={tokenA}
                                baseToken={tokenB}
                                targetPrice=""
                                onTargetPriceChange={() => {}}
                                band={{ sell, buy, tilt: form.tilt, windows, intervalHours: form.intervalHours, onDrag }}
                                className="flex-1 min-h-[560px]"
                            />
                        ) : (
                            <div className="h-full min-h-[560px] flex items-center justify-center text-sm text-white/50">
                                {bothPicked ? 'Waiting for prices' : 'Pick two tokens to see the chart.'}
                            </div>
                        )}
                    </div>
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
                        quoteError={quoteError}
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
