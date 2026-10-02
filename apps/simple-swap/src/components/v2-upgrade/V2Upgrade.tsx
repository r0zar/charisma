'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useWallet } from '@/contexts/wallet-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { SUBNET_PAIRS, type SubnetPair } from '@/lib/subnet-pairs';
import { upgradableBalances, upgradeToV2 } from '@/lib/subnet-upgrade';

const show = (raw: bigint, decimals: number) =>
    (Number(raw) / 10 ** decimals).toLocaleString('en-US', { maximumFractionDigits: decimals > 6 ? decimals : 2 });

/**
 * Upgrade to Blaze v2, for anyone holding CHA, WELSH or sBTC on Blaze v1: one signature per token moves it all (less
 * what open orders still spend) into v2, so each sits in one place. Shows nothing otherwise.
 */
export default function V2Upgrade({ className = '' }: { className?: string }) {
    const { address } = useWallet();
    const { getSubnetBalanceExact, refreshBalances } = useBalances(address ? [address] : []);
    const exact = (subnet: string) => (address ? getSubnetBalanceExact(address, subnet) : 0);
    const held = (subnet: string) => BigInt(Math.floor(exact(subnet)));
    const v1Key = SUBNET_PAIRS.map(p => exact(p.v1)).join('|');

    const [free, setFree] = useState<Record<string, bigint>>({});
    const [phase, setPhase] = useState<Record<string, 'signing' | 'sent'>>({});
    const [error, setError] = useState<string | null>(null);

    // Open orders on v1 keep their balance there; read them whenever a v1 balance changes (a sent upgrade has landed then)
    useEffect(() => {
        setFree({});
        setError(null);
        setPhase(p => Object.fromEntries(Object.entries(p).filter(([, s]) => s === 'signing')));
        if (!address || !SUBNET_PAIRS.some(p => held(p.v1) >= p.minUpgrade)) return;
        let live = true;
        upgradableBalances(address, exact)
            .then(f => live && setFree(f))
            .catch(err => live && setError((err as Error).message));
        return () => { live = false; };
    }, [address, v1Key]);

    const rows = SUBNET_PAIRS.filter(p => phase[p.v1] === 'sent' || (free[p.v1] ?? 0n) >= p.minUpgrade);
    if (rows.length === 0 && !error) return null;

    const upgrade = async (pair: SubnetPair) => {
        if (!address) return;
        setError(null);
        setPhase(p => ({ ...p, [pair.v1]: 'signing' }));
        try {
            // Settled again at signing, so an order placed since can't be left short
            const now = await upgradableBalances(address, exact);
            await upgradeToV2(address, pair, now[pair.v1]);
            setPhase(p => ({ ...p, [pair.v1]: 'sent' }));
            setTimeout(() => refreshBalances([address]), 90_000);
        } catch (err) {
            setError((err as Error).message);
            setPhase(({ [pair.v1]: _, ...rest }) => rest);
        }
    };

    return (
        <div className={`rounded-xl border border-accent-line bg-accent-soft p-4 space-y-3 ${className}`}>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4 shrink-0 text-accent-text" /> Upgrade to Blaze v2 — free, one signature per token
            </p>
            {rows.map(pair => {
                const v1 = held(pair.v1), v2 = held(pair.v2), moving = free[pair.v1] ?? 0n;
                const amount = (raw: bigint) => <span className="font-mono">{show(raw, pair.decimals)}</span>;
                return (
                    <div key={pair.v1} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {phase[pair.v1] === 'sent' ? (
                            <p className="text-sm text-ink-body">Your {pair.symbol} is on its way to Blaze v2. It lands in about a minute.</p>
                        ) : (
                            <p className="min-w-0 text-sm text-ink-body">
                                {amount(v1)} {pair.symbol} is on Blaze v1{v2 > 0n && <> and {amount(v2)} on v2</>}. Move it to v2 so it&apos;s all in one place.
                                {v1 > moving && moving > 0n && <> {amount(v1 - moving)} stays on v1 for your open orders.</>}
                            </p>
                        )}
                        {phase[pair.v1] !== 'sent' && (
                            <button
                                type="button"
                                onClick={() => upgrade(pair)}
                                disabled={phase[pair.v1] === 'signing'}
                                className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {phase[pair.v1] === 'signing' ? 'Waiting for your signature…' : `Upgrade ${show(moving, pair.decimals)} ${pair.symbol}`}
                            </button>
                        )}
                    </div>
                );
            })}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
    );
}
