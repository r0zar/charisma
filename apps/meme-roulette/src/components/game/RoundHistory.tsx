'use client';

import { useEffect, useState } from 'react';
import { History, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTokens } from '@/contexts/tokens-context';
import { formatUnits } from '@/lib/format';
import { TokenLogo } from './TokenLogo';
import { RoundReplay } from './RoundReplay';
import { potOf } from './screen';
import type { PublicRound } from '@/lib/roulette/types';

/** Finished rounds, newest first: who won, the pot, and a button to rewatch the spin. */
export function RoundHistory() {
    const { byId } = useTokens();
    const [rounds, setRounds] = useState<PublicRound[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [watching, setWatching] = useState<PublicRound | null>(null);

    const load = () => {
        setError(null);
        setRounds(null);
        fetch('/api/rounds?limit=30')
            .then(async res => {
                if (!res.ok) throw new Error(`Couldn't load past rounds (${res.status})`);
                setRounds((await res.json()).rounds);
            })
            .catch(err => setError(err.message));
    };

    useEffect(load, []);

    return (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold"><History className="h-5 w-5 text-accent-text" /> Past rounds</h2>
                    <p className="text-sm text-ink-muted">Pick a round to rewatch its spin.</p>
                </div>
                <Button variant="outline" size="sm" onClick={load} disabled={!rounds && !error}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            </div>

            {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p>}
            {!rounds && !error && [0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            {rounds?.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No finished rounds yet.</p>}

            <ul className="divide-y divide-line">
                {rounds?.map(round => {
                    const draw = round.draw!;
                    const winner = draw.winner;
                    return (
                        <li key={round.id} className="flex items-center gap-3 py-3">
                            {winner ? <TokenLogo token={byId[winner]} size={36} /> : <span className="h-9 w-9 shrink-0 rounded-full bg-surface-hover" />}
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {round.id.replace('round_', 'Round ')} · {winner ? `${byId[winner]?.symbol ?? winner.split('.')[1]} won` : 'Nobody played'}
                                </p>
                                <p className="text-sm text-ink-muted">
                                    {new Date(draw.drawnAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    {winner && ` · ${formatUnits(potOf(round), 6, true)} CHA · ${round.players} ${round.players === 1 ? 'player' : 'players'}`}
                                </p>
                            </div>
                            <Button size="sm" variant={winner ? 'default' : 'outline'} disabled={!winner} onClick={() => setWatching(round)}>
                                <Play className="h-3.5 w-3.5" /> Watch
                            </Button>
                        </li>
                    );
                })}
            </ul>

            <RoundReplay round={watching} onClose={() => setWatching(null)} />
        </section>
    );
}
