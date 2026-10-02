'use client';

import { Suspense, useState } from 'react';
import Confetti from 'react-confetti';
import { Crown, Lock, Loader2, Rocket, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wheel } from '@/components/wheel/Wheel';
import { useRealmColors } from '@/components/wheel/colors';
import { OddsList } from '@/components/game/OddsList';
import { RecentBets } from '@/components/game/RecentBets';
import { ResultCard } from '@/components/game/ResultCard';
import { BackMemeSheet } from '@/components/game/BackMemeSheet';
import { TokenLogo } from '@/components/game/TokenLogo';
import { betsIn, potOf, screenAt, slicesOf, type Screen } from '@/components/game/screen';
import ReferralRedemptionClient from '@/components/ReferralRedemptionClient';
import useWindowSize from '@/hooks/useWindowSize';
import { useRound } from '@/hooks/useRound';
import { useServerTime } from '@/hooks/useServerTime';
import { useTokens } from '@/contexts/tokens-context';
import { formatCountdown, formatUnits } from '@/lib/format';
import { landsAt } from '@/components/wheel/types';
import type { PublicRound } from '@/lib/roulette/types';

const roundLabel = (r: PublicRound) => r.id.replace('round_', 'Round ');

function Headline({ screen, now, landed }: { screen: Screen; now: number; landed: boolean }) {
    const { byId } = useTokens();
    switch (screen.kind) {
        case 'loading':
            return <Title eyebrow="Meme Roulette" title="Loading the round…" />;
        case 'starting':
            return <Title eyebrow="Meme Roulette" title="The first round is being set up" sub="It opens in a moment. This page updates by itself." />;
        case 'open':
            return <Title eyebrow={`${roundLabel(screen.round)} · betting open`} title={<>Betting closes in <Clock ms={screen.round.locksAt - now} /></>}
                sub={`The wheel spins at ${new Date(screen.round.endsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`} />;
        case 'locked':
            return <Title eyebrow={<><Lock className="mr-1 inline h-3 w-3" />{roundLabel(screen.round)} · betting closed</>} title={<>The wheel spins in <Clock ms={screen.round.endsAt - now} /></>} sub="The pot is locked in." />;
        case 'drawing':
            return <Title eyebrow={roundLabel(screen.round)} title={<><Loader2 className="mr-2 inline h-7 w-7 animate-spin align-[-4px]" />Drawing…</>} sub="Waiting for the next Stacks block to seal the result." />;
        case 'reveal': {
            const w = screen.round.draw!.winner!;
            return landed
                ? <Title eyebrow={roundLabel(screen.round)} title={<><TokenLogo token={byId[w]} size={36} /> {byId[w]?.symbol ?? w.split('.')[1]} wins!</>} sub="The whole pot buys it." />
                : <Title eyebrow={roundLabel(screen.round)} title="Spinning…" sub="Everyone is watching the same spin." />;
        }
        case 'result':
            return <Title eyebrow={roundLabel(screen.round)} title="Round over" />;
    }
}

function Title({ eyebrow, title, sub }: { eyebrow: React.ReactNode; title: React.ReactNode; sub?: string }) {
    return (
        <div className="text-center">
            <p className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">{eyebrow}</p>
            <h1 className="flex items-center justify-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            {sub && <p className="mt-1 text-sm text-ink-muted">{sub}</p>}
        </div>
    );
}

const Clock = ({ ms }: { ms: number }) => <span className="font-mono tabular-nums text-accent-text">{formatCountdown(ms)}</span>;

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted">{icon}{title}</h2>
            {children}
        </section>
    );
}

export default function HomePage() {
    const { payload, error, now: serverNow } = useRound();
    const now = useServerTime(1000);
    const colors = useRealmColors();
    const { byId } = useTokens();
    const { width, height } = useWindowSize();
    const [sheetOpen, setSheetOpen] = useState(false);
    const [celebrating, setCelebrating] = useState(false);

    const screen = screenAt(payload, now);
    const shown = screen.kind === 'loading' || screen.kind === 'starting' ? null : screen.round;
    const draw = shown?.draw;
    const spin = draw?.winner ? { drawnAt: draw.drawnAt, ticket: draw.ticket, total: draw.total, turns: draw.turns } : undefined;
    const landed = !!spin && now >= landsAt(spin);
    const myBets = payload?.myBets ?? [];
    const myTokens = shown ? [...new Set(betsIn(shown, myBets).filter(b => b.status !== 'excluded').map(b => b.tokenId))] : [];
    const live = payload?.round?.status === 'live' ? payload.round : null;
    const betting = screen.kind === 'open';
    const next = screen.kind === 'result' || screen.kind === 'reveal' ? screen.next : null;
    // while the last round is on screen, its pot is the one that matters
    const potRound = screen.kind === 'result' || screen.kind === 'reveal' ? shown : live;

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
            <Suspense fallback={null}><ReferralRedemptionClient /></Suspense>
            {celebrating && colors && (
                <Confetti width={width} height={height} recycle={false} numberOfPieces={320} gravity={0.25} colors={colors.slices}
                    onConfettiComplete={() => setCelebrating(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none' }} />
            )}
            {error && <p className="mb-4 rounded-lg bg-danger-soft p-3 text-center text-sm text-danger">{error}</p>}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <section className="space-y-5">
                    <Headline screen={screen} now={now} landed={landed} />
                    <div className="mx-auto w-full max-w-[560px]">
                        <Wheel
                            key={shown?.id ?? 'none'}
                            slices={shown ? slicesOf(shown) : []}
                            spin={spin}
                            now={serverNow}
                            tokens={byId}
                            mine={myTokens}
                            winner={landed ? draw?.winner : undefined}
                            dim={screen.kind === 'locked' || screen.kind === 'drawing'}
                            onLanded={() => setCelebrating(true)}
                        />
                    </div>
                    {screen.kind === 'result' && <ResultCard round={screen.round} next={screen.next} myBets={myBets} now={now} />}
                    {screen.kind === 'reveal' && landed && <ResultCard round={screen.round} next={screen.next} myBets={myBets} now={now} />}
                    <div className="flex flex-col items-center gap-2">
                        <Button size="lg" className="h-12 w-full max-w-sm text-base" disabled={!betting} onClick={() => setSheetOpen(true)}>
                            <Rocket className="h-5 w-5" /> {betting ? 'Back a meme' : next && now < next.opensAt ? `Next round in ${formatCountdown(next.opensAt - now)}` : 'Betting is closed'}
                        </Button>
                        {betting && <p className="text-xs text-ink-muted">Bigger stake, bigger slice. Everyone gets the winner.</p>}
                    </div>
                </section>

                <aside className="space-y-4">
                    {potRound && (
                        <Card title={potRound === live ? 'The pot' : `${roundLabel(potRound)} pot`} icon={<Sparkles className="h-4 w-4" />}>
                            <p className="font-mono text-3xl font-bold">{formatUnits(potOf(potRound), 6, true)} <span className="text-base text-ink-muted">CHA</span></p>
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                                <Users className="h-4 w-4" /> {potRound.players} {potRound.players === 1 ? 'player' : 'players'} · {potRound.bets} {potRound.bets === 1 ? 'bet' : 'bets'}
                            </p>
                            {payload && BigInt(payload.stats.athTotal) > 0n && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                                    <Crown className="h-3.5 w-3.5 text-gold" /> Record pot {formatUnits(payload.stats.athTotal, 6, true)} CHA
                                </p>
                            )}
                        </Card>
                    )}
                    {shown && (
                        <Card title={shown.draw ? 'The final odds' : 'The odds'}>
                            <OddsList slices={slicesOf(shown)} mine={myTokens} winner={landed ? draw?.winner : undefined} />
                        </Card>
                    )}
                    {live && (betting || screen.kind === 'locked' || screen.kind === 'drawing' || (payload?.recentBets.length ?? 0) > 0) && (
                        <Card title={potRound === live ? 'Recent bets' : 'Next round so far'}>
                            <RecentBets bets={payload?.recentBets ?? []} now={now} />
                        </Card>
                    )}
                </aside>
            </div>

            <BackMemeSheet open={sheetOpen} onOpenChange={setSheetOpen} round={live} now={now} />
        </div>
    );
}
