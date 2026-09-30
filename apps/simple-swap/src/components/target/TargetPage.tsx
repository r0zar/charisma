"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import TokenDropdown from '@/components/TokenDropdown';
import SubnetPairSelector from '@/components/range/SubnetPairSelector';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { usePrices } from '@/contexts/token-price-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { createExitOrder } from '@/lib/target/create-exit-order';
import { listTokens } from '@/app/actions';

const ConditionTokenChart = dynamic(() => import('@/components/condition-token-chart'), { ssr: false });

const TARGETS = [0.1, 0.15, 0.25];
const SAFETY = 0.1;
const SHARES = [0.25, 0.5, 1];

/** Up to 6 significant digits, no exponent */
const fmt = (n: number) => n.toLocaleString('en-US', { maximumSignificantDigits: 6 });

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${active ? 'border-white/40 bg-white/[0.08] text-white' : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white/90'}`}
        >
            {children}
        </button>
    );
}

/**
 * Target & Safety Net: hold any subnet token, and swap it into any token when it rises X% against it
 * (target) or falls Y% (safety net). Zesty's trade, for every pair. Two signed orders; when one runs,
 * the executor cancels the other.
 */
export default function TargetPage() {
    const { address } = useWallet();
    const { getPrice } = usePrices();
    const { getSubnetContractId } = useSubnetTokens();
    const { getSubnetBalance } = useBalances(address ? [address] : []);
    // Only tokens the router can trade, the same list the swap page offers
    const [swappable, setSwappable] = useState<TokenCacheData[] | null>(null);
    const [listError, setListError] = useState<string | null>(null);
    useEffect(() => {
        listTokens()
            .then(result => {
                if (!result.success || !result.tokens) throw new Error(result.error ?? 'Swappable tokens unavailable');
                // Same shape the swap page feeds its token pickers (dexterity-sdk's token list)
                setSwappable(result.tokens as unknown as TokenCacheData[]);
            })
            .catch(err => setListError((err as Error).message));
    }, []);

    const [from, setFrom] = useState<TokenCacheData | null>(null);
    const [to, setTo] = useState<TokenCacheData | null>(null);
    const [share, setShare] = useState(0.5);
    const [targetPct, setTargetPct] = useState(0.15);
    const [safetyOn, setSafetyOn] = useState(true);
    const [phase, setPhase] = useState<'setup' | 'signing' | 'done'>('setup');
    const [error, setError] = useState<string | null>(null);

    const fromSubnet = from ? getSubnetContractId(from.contractId) : null;
    const balanceRaw = address && fromSubnet ? getSubnetBalance(address, fromSubnet) : 0;
    const amountRaw = BigInt(Math.floor(balanceRaw * share));
    // Never guess decimals: a token without them in the token list can't be traded here
    const decimals = from?.decimals;
    const amountDisplay = decimals !== undefined ? Number(amountRaw) / 10 ** decimals : 0;

    const priceFrom = from ? getPrice(from.contractId) : null;
    const priceTo = to ? getPrice(to.contractId) : null;
    const ratio = priceFrom && priceTo ? priceFrom / priceTo : null;
    const targetRatio = ratio ? ratio * (1 + targetPct) : null;
    const safetyRatio = ratio && safetyOn ? ratio * (1 - SAFETY) : null;

    const toTokens = (swappable ?? []).filter(t => t.type !== 'SUBNET' && t.contractId !== from?.contractId);
    const missingPrice = from && decimals === undefined
        ? `${from.symbol} has no decimals in the token list, so amounts can't be read safely`
        : from && to && !ratio
            ? `No price for ${!priceFrom ? from.symbol : to!.symbol} right now, so a trigger can't be set`
            : null;
    const ready = !!(address && from && to && fromSubnet && ratio && decimals !== undefined && amountRaw > 0n);

    const start = async () => {
        if (!ready || !from || !to || !fromSubnet || !ratio || !targetRatio) return;
        setError(null);
        setPhase('signing');
        const strategyId = crypto.randomUUID();
        const common = { wallet: address!, strategyId, fromSubnet, fromToken: from.contractId, toToken: to.contractId, amount: amountRaw, entryRatio: ratio };
        try {
            await createExitOrder({ ...common, role: 'target', ratio: targetRatio, direction: 'gt', movePct: targetPct });
            if (safetyRatio) await createExitOrder({ ...common, role: 'safety', ratio: safetyRatio, direction: 'lt', movePct: -SAFETY });
            setPhase('done');
        } catch (err) {
            setError((err as Error).message);
            setPhase('setup');
        }
    };

    return (
        <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-white/95">Target &amp; Safety Net</h1>
                <p className="text-sm text-white/60">
                    Hold any subnet token. Swap it into another token when it rises to your target, or when it falls to your safety net. Whichever happens first runs, and the other is cancelled.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col">
                    {from && to && ratio ? (
                        <ConditionTokenChart
                            token={from}
                            baseToken={to}
                            targetPrice={targetRatio ? targetRatio.toString() : ''}
                            direction="gt"
                            onTargetPriceChange={price => {
                                // Dragging the line sets the target; it must stay above today's price
                                const next = Number(price) / ratio - 1;
                                if (Number.isFinite(next) && next > 0) setTargetPct(Math.round(next * 1000) / 1000);
                            }}
                            className="flex-1 min-h-[480px]"
                        />
                    ) : (
                        <div className="h-full min-h-[480px] flex items-center justify-center text-sm text-white/50">
                            {missingPrice ?? 'Pick what you hold and what to swap into to see the chart.'}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-5">
                    {phase === 'done' ? (
                        <div className="space-y-4">
                            <div className="text-lg font-medium text-white/95">Trade set ✓</div>
                            <p className="text-sm text-white/60">
                                When {from?.symbol} reaches {targetRatio && fmt(targetRatio)} {to?.symbol}
                                {safetyRatio ? ` or drops to ${fmt(safetyRatio)} ${to?.symbol}` : ''}, it swaps into {to?.symbol}. You can close this page.
                            </p>
                            <div className="flex gap-2">
                                <Link href="/orders" className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-center text-sm text-white hover:bg-white/[0.06]">View in Orders</Link>
                                <button type="button" onClick={() => setPhase('setup')} className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-white/70 hover:text-white">Set another</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <div className="text-xs text-white/60">You hold (on the subnet)</div>
                                <SubnetPairSelector label="Pick a token" selected={from} onSelect={t => { setFrom(t); if (to?.contractId === t.contractId) setTo(null); }} />
                                {from && decimals !== undefined && (
                                    <div className="flex justify-between text-xs text-white/60">
                                        <span>Available</span>
                                        <span className="font-mono">{fmt(balanceRaw / 10 ** decimals)} {from.symbol}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="text-xs text-white/60">Swap into</div>
                                {listError
                                    ? <p role="alert" className="text-sm text-red-400">Couldn&apos;t load swappable tokens: {listError}</p>
                                    : swappable
                                        ? <TokenDropdown tokens={toTokens} selected={to} onSelect={setTo} label="Pick a token" />
                                        : <div className="text-sm text-white/50">Loading swappable tokens…</div>}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-white/60">
                                    <span>Amount</span>
                                    {from && <span className="font-mono">{fmt(amountDisplay)} {from.symbol}</span>}
                                </div>
                                <div className="flex gap-2">
                                    {SHARES.map(s => <Chip key={s} active={share === s} onClick={() => setShare(s)}>{s === 1 ? 'All' : `${s * 100}%`}</Chip>)}
                                </div>
                            </div>

                            {ratio && from && to && (
                                <div className="flex justify-between text-xs text-white/60">
                                    <span>Now</span>
                                    <span className="font-mono">1 {from.symbol} = {fmt(ratio)} {to.symbol}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-white/60">
                                    <span>🎯 Target: swap when it rises {!TARGETS.includes(targetPct) && `(+${(targetPct * 100).toFixed(1)}%)`}</span>
                                    {targetRatio && to && <span className="font-mono">{fmt(targetRatio)} {to.symbol}</span>}
                                </div>
                                <div className="flex gap-2">
                                    {TARGETS.map(t => <Chip key={t} active={targetPct === t} onClick={() => setTargetPct(t)}>+{t * 100}%</Chip>)}
                                </div>
                            </div>

                            <label className="flex items-center justify-between gap-3 text-sm text-white/80 cursor-pointer">
                                <span>🛡️ Safety net: swap if it falls {SAFETY * 100}%{safetyRatio && to ? ` (${fmt(safetyRatio)} ${to.symbol})` : ''}</span>
                                <input type="checkbox" checked={safetyOn} onChange={e => setSafetyOn(e.target.checked)} className="h-4 w-4 cursor-pointer accent-white" />
                            </label>

                            {(error || missingPrice) && <p role="alert" className="text-sm text-red-400">{error ?? missingPrice}</p>}

                            <button
                                type="button"
                                onClick={start}
                                disabled={!ready || phase === 'signing'}
                                className="w-full rounded-lg bg-white/90 px-4 py-3 text-sm font-medium text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {phase === 'signing' ? 'Signing in your wallet…' : `Sign ${safetyOn ? '2 orders' : '1 order'}`}
                            </button>
                            <p className="text-xs text-white/50">
                                Drag the target line on the chart to fine-tune it. Spends tokens already on the subnet. The swap pays out to your wallet. Prices come from Charisma&apos;s price feed.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
