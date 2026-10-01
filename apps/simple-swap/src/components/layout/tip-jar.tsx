'use client';

import React, { useEffect, useState } from 'react';
import { request } from '@stacks/connect';

const TIPS = [1, 5, 10];

/** The tip jar that keeps the solver paying network fees for orders that run while traders are away. */
export function TipJar() {
    const [solver, setSolver] = useState<{ address: string; stx: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [thanks, setThanks] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/v1/solver')
            .then(async res => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.error ?? `Solver balance unavailable (${res.status})`);
                setSolver(body);
            })
            .catch(err => setError((err as Error).message));
    }, [thanks]);

    const tip = async (stx: number) => {
        if (!solver) return;
        setError(null);
        try {
            const result = await request('stx_transferStx', { recipient: solver.address, amount: String(stx * 1_000_000), memo: 'Charisma tip', network: 'mainnet' });
            if (!result?.txid) throw new Error('The tip was not sent');
            setThanks(`Thank you! ${stx} STX is on its way.`);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-sm text-white/60">
            <div className="flex items-baseline justify-between gap-4">
                <span className="font-semibold text-white/90">Tip jar</span>
                <span>Solver balance <strong className="ml-1 font-medium text-white/90">{solver ? `${solver.stx.toFixed(2)} STX` : '…'}</strong></span>
            </div>
            <p className="m-0 leading-relaxed">
                The solver pays the network fee for every order that runs while you&apos;re away: DCA, limit and In &amp; Out. It&apos;s tiny, but if it runs dry, orders stop triggering. Tips keep it running.
            </p>
            <div className="flex gap-2">
                {TIPS.map(stx => (
                    <button
                        key={stx}
                        type="button"
                        onClick={() => tip(stx)}
                        disabled={!solver}
                        className="min-h-[44px] flex-1 cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/80 transition-colors hover:enabled:border-white/[0.2] hover:enabled:bg-white/[0.08] hover:enabled:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Tip {stx} STX
                    </button>
                ))}
            </div>
            {thanks && <p className="m-0 text-white/90">{thanks}</p>}
            {error && <p role="alert" className="m-0 text-red-300">{error}</p>}
        </div>
    );
}
