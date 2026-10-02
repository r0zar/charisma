'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useWallet } from '@/contexts/wallet-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { CHA_SUBNET_V1, CHA_SUBNET_V2 } from '@/lib/cha-subnets';
import { upgradableCha, upgradeChaToV2 } from '@/lib/cha-upgrade';

/** Below this much v1 CHA the upgrade isn't offered: 1 CHA */
const MIN_UPGRADE = 1_000_000n;

const cha = (raw: bigint) => (Number(raw) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 });

/**
 * Upgrade to Blaze v2, for anyone holding Blaze v1 CHA: one signature moves it all (less what open orders still spend)
 * into v2, so their subnet CHA sits in one place. Shows nothing otherwise.
 */
export default function ChaUpgrade({ className = '' }: { className?: string }) {
    const { address } = useWallet();
    const { getSubnetBalanceExact, refreshBalances } = useBalances(address ? [address] : []);
    const v1Balance = address ? getSubnetBalanceExact(address, CHA_SUBNET_V1) : 0;
    const v1 = BigInt(Math.floor(v1Balance));
    const v2 = address ? BigInt(Math.floor(getSubnetBalanceExact(address, CHA_SUBNET_V2))) : 0n;

    const [upgradable, setUpgradable] = useState<bigint | null>(null);
    const [phase, setPhase] = useState<'ready' | 'signing' | 'sent'>('ready');
    const [error, setError] = useState<string | null>(null);

    // Open orders on v1 keep their CHA there; read them whenever the v1 balance changes (a sent upgrade has landed then)
    useEffect(() => {
        setUpgradable(null);
        setError(null);
        setPhase(p => (p === 'sent' ? 'ready' : p));
        if (!address || v1 < MIN_UPGRADE) return;
        let live = true;
        upgradableCha(address, v1Balance)
            .then(free => live && setUpgradable(free))
            .catch(err => live && setError((err as Error).message));
        return () => { live = false; };
    }, [address, v1Balance]);

    if (phase !== 'sent' && (upgradable === null || upgradable < MIN_UPGRADE) && !error) return null;

    const upgrade = async () => {
        if (!address) return;
        setError(null);
        setPhase('signing');
        try {
            // Settled again at signing, so an order placed since can't be left short
            await upgradeChaToV2(address, await upgradableCha(address, getSubnetBalanceExact(address, CHA_SUBNET_V1)));
            setPhase('sent');
            setTimeout(() => refreshBalances([address]), 90_000);
        } catch (err) {
            setError((err as Error).message);
            setPhase('ready');
        }
    };

    const held = upgradable ?? 0n;
    return (
        <div className={`rounded-xl border border-accent-line bg-accent-soft p-4 ${className}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Sparkles className="h-4 w-4 shrink-0 text-accent-text" /> Upgrade to Blaze v2 — free, one signature
                    </p>
                    {phase === 'sent' ? (
                        <p className="text-sm text-ink-body">Your CHA is on its way to Blaze v2. It lands in about a minute.</p>
                    ) : (
                        <p className="text-sm text-ink-body">
                            <span className="font-mono">{cha(v1)}</span> CHA is on Blaze v1{v2 > 0n && <> and <span className="font-mono">{cha(v2)}</span> on v2</>}.
                            {' '}Move it to v2 so it&apos;s all in one place.
                            {v1 > held && held > 0n && <> <span className="font-mono">{cha(v1 - held)}</span> stays on v1 for your open orders.</>}
                        </p>
                    )}
                    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                </div>
                {phase !== 'sent' && held >= MIN_UPGRADE && (
                    <button
                        type="button"
                        onClick={upgrade}
                        disabled={phase === 'signing'}
                        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {phase === 'signing' ? 'Waiting for your signature…' : `Upgrade ${cha(held)} CHA`}
                    </button>
                )}
            </div>
        </div>
    );
}
