'use client';

import { useState } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wheel } from '@/components/wheel/Wheel';
import { useTokens } from '@/contexts/tokens-context';
import { formatUnits } from '@/lib/format';
import { TokenLogo } from './TokenLogo';
import { potOf } from './screen';
import type { PublicRound } from '@/lib/roulette/types';

/** A still moment before the wheel moves, so the replay starts from the round's frozen slices */
const LEAD_MS = 700;

/**
 * Rewatch a finished round's spin. The wheel is a pure function of time, so this is the same wheel on a clock that
 * starts at the round's draw: exactly the spin everyone saw.
 */
export function RoundReplay({ round, onClose }: { round: PublicRound | null; onClose: () => void }) {
    return (
        <Dialog open={!!round} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg">{round?.draw?.winner && <Replay round={round} />}</DialogContent>
        </Dialog>
    );
}

function Replay({ round }: { round: PublicRound }) {
    const { byId } = useTokens();
    const [startedAt, setStartedAt] = useState(() => performance.now());
    const [landed, setLanded] = useState(false);
    const draw = round.draw!;
    const winner = draw.winner!;
    const symbol = byId[winner]?.symbol ?? winner.split('.')[1];
    const spin = { drawnAt: draw.drawnAt, ticket: draw.ticket, total: draw.total, turns: draw.turns };
    const now = () => draw.drawnAt + (performance.now() - startedAt - LEAD_MS);
    const again = () => { setLanded(false); setStartedAt(performance.now()); };

    return (
        <>
            <DialogHeader>
                <DialogTitle>{round.id.replace('round_', 'Round ')}</DialogTitle>
                <DialogDescription>
                    Spun {new Date(draw.drawnAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </DialogDescription>
            </DialogHeader>
            <div className="mx-auto w-full max-w-[420px]">
                <Wheel key={startedAt} slices={draw.slices} spin={spin} now={now} tokens={byId} winner={landed ? winner : undefined} onLanded={() => setLanded(true)} />
            </div>
            <div className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-center">
                {landed ? (
                    <>
                        <p className="flex items-center gap-2 text-xl font-bold"><TokenLogo token={byId[winner]} size={28} /> {symbol} won</p>
                        <p className="text-sm text-ink-muted">
                            {formatUnits(potOf(round), 6, true)} CHA pot · {round.players} {round.players === 1 ? 'player' : 'players'}
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-ink-muted">Spinning…</p>
                )}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={again} disabled={!landed}><RotateCcw className="h-4 w-4" /> Watch again</Button>
                <Button variant="ghost" asChild>
                    <a href={`/api/rounds/${round.id}`} target="_blank" rel="noopener noreferrer"><ShieldCheck className="h-4 w-4" /> Check the draw</a>
                </Button>
            </div>
        </>
    );
}
