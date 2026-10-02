'use client';

import { ExternalLink, ShieldCheck } from 'lucide-react';
import { explorerTx, formatCountdown, formatUnits } from '@/lib/format';
import { useTokens } from '@/contexts/tokens-context';
import { TokenLogo } from './TokenLogo';
import { betsIn, potOf } from './screen';
import type { BetStatus, PublicBet, PublicRound } from '@/lib/roulette/types';

const STATUS: Record<BetStatus, string> = {
    placed: 'Waiting to buy',
    sending: 'Buying…',
    sent: 'Buying… (confirming on-chain)',
    confirmed: 'Bought',
    failed: 'Failed',
    excluded: 'Not counted: your subnet CHA was short at the draw',
};

/** After the draw: who won, what the pot bought, and what you got. */
export function ResultCard({ round, next, myBets, now }: { round: PublicRound; next: PublicRound | null; myBets?: PublicBet[]; now: number }) {
    const { byId } = useTokens();
    const draw = round.draw;
    const winner = draw?.winner ? byId[draw.winner] : undefined;
    const winnerSymbol = winner?.symbol ?? draw?.winner?.split('.')[1] ?? '';
    const mine = betsIn(round, myBets);
    const backedWinner = mine.some(b => b.tokenId === draw?.winner);

    return (
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            {draw?.winner ? (
                <div className="flex items-center gap-4">
                    <TokenLogo token={winner} size={56} />
                    <div>
                        <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-muted">{round.id.replace('_', ' ')} · the wheel picked</p>
                        <h2 className="text-3xl font-bold tracking-tight">{winnerSymbol}</h2>
                        <p className="text-sm text-ink-muted">The pot of {formatUnits(potOf(round), 6, true)} CHA from {round.players} {round.players === 1 ? 'player' : 'players'} buys {winnerSymbol}.</p>
                    </div>
                </div>
            ) : (
                <div>
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-muted">{round.id.replace('_', ' ')}</p>
                    <h2 className="text-2xl font-bold tracking-tight">Nobody backed a meme this round</h2>
                    <p className="text-sm text-ink-muted">No pot, no spin. The next round is on its way.</p>
                </div>
            )}

            {mine.length > 0 && (
                <div className="mt-5 rounded-lg bg-surface-sunken p-4">
                    <p className="mb-3 font-semibold">
                        {backedWinner ? `Your meme won! Your CHA bought ${winnerSymbol}.` : `Your CHA bought ${winnerSymbol}: everyone gets the winner.`}
                    </p>
                    <ul className="space-y-2 text-sm">
                        {mine.map(b => (
                            <li key={b.uuid} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span>You backed <strong>{byId[b.tokenId]?.symbol ?? b.tokenId.split('.')[1]}</strong> with {formatUnits(b.amount)} CHA</span>
                                {b.status === 'confirmed' && b.amountOut && (
                                    <span className="font-semibold text-success">→ {formatUnits(b.amountOut, winner?.decimals ?? 6)} {winnerSymbol}</span>
                                )}
                                <span className={b.status === 'failed' || b.status === 'excluded' ? 'text-danger' : 'text-ink-muted'}>
                                    · {STATUS[b.status]}{b.status === 'failed' && b.error ? `: ${b.error}` : ''}
                                </span>
                                {b.txid && (
                                    <a href={explorerTx(b.txid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">
                                        transaction <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                {next && now < next.opensAt
                    ? <span className="font-semibold">Next round opens in <span className="font-mono">{formatCountdown(next.opensAt - now)}</span></span>
                    : <span className="text-ink-muted">The next round is open.</span>}
                {draw && (
                    <a href={`/api/rounds/${round.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
                        title={`Ticket ${draw.ticket} of ${draw.total}, Stacks block ${draw.block.height}`}>
                        <ShieldCheck className="h-4 w-4" /> Verify this draw
                    </a>
                )}
            </div>
        </section>
    );
}
