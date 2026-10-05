'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Search, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { SwapStxToChaButton } from '@/components/SwapStxToChaButton';
import { useWallet } from '@/contexts/wallet-context';
import { useTokens } from '@/contexts/tokens-context';
import { useRound } from '@/hooks/useRound';
import { explorerTx, formatCountdown, formatUnits, toMicro } from '@/lib/format';
import { TokenLogo } from './TokenLogo';
import { betsIn, potOf } from './screen';
import type { PublicRound } from '@/lib/roulette/types';
import { SharePickButton } from './SharePickButton';
import { CHA_SUBNET_V1, CHA_SUBNET_V2 } from '@/lib/roulette/subnets';
import { AnimatedAmount } from '@repo/brand/react';

const PRESETS = [10, 25, 50, 100];
const ONE_CHA = 1_000_000n;

/** Connect, top up if needed, pick a meme and an amount, sign. One sheet, no wizard. */
export function BackMemeSheet({ open, onOpenChange, round, now, initialToken }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    round: PublicRound | null;
    now: number;
    initialToken?: string;
}) {
    const { connected, address, connectWallet, isConnecting, subnetBalance, subnetBalances, subnetBalanceLoading, placeBet } = useWallet();
    const { tokens, byId, loading: tokensLoading, error: tokensError } = useTokens();
    const { payload, refresh } = useRound();
    const [query, setQuery] = useState('');
    const [tokenId, setTokenId] = useState<string | undefined>(initialToken);
    const [amountText, setAmountText] = useState('25');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [topUpTx, setTopUpTx] = useState<string | null>(null);
    const [backed, setBacked] = useState<{ symbol: string; amount: bigint } | null>(null);

    useEffect(() => { if (open) { setError(null); setBacked(null); if (initialToken) setTokenId(initialToken); } }, [open, initialToken]);

    const isOpen = !!round && round.status === 'live' && now >= round.opensAt && now < round.locksAt;
    // two CHA subnets, one balance: each bet spends one of them, old (v1) first
    const mine = round ? betsIn(round, payload?.myBets).filter(b => b.status !== 'excluded') : [];
    // Balances are instant: this round's bets (and any open orders) are already set aside, so what's there is free
    const freeIn = (ready: string) => (BigInt(ready || '0') > 0n ? BigInt(ready) : 0n);
    const freeV1 = freeIn(subnetBalances.v1), freeV2 = freeIn(subnetBalances.v2);
    const free = freeV1 + freeV2;
    const committed = mine.reduce((s, b) => s + BigInt(b.amount), 0n);
    const amount = toMicro(amountText);
    const selected = tokenId ? byId[tokenId] : undefined;
    const tally = round?.tally ?? {};
    const pot = round ? potOf(round) : 0n;

    const q = query.trim().toLowerCase();
    const choices = tokens
        .filter(t => t.playable && (!q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.contractId.toLowerCase().includes(q)))
        .sort((a, b) => Number(BigInt(tally[b.contractId] ?? '0') - BigInt(tally[a.contractId] ?? '0')) || a.symbol.localeCompare(b.symbol));

    const problem =
        !isOpen ? 'Betting is closed right now.'
            : !selected ? 'Pick a meme to back.'
                : amount === null ? 'Enter an amount of CHA.'
                    : amount < ONE_CHA ? 'The smallest bet is 1 CHA.'
                        : amount > free ? `You have ${formatUnits(free)} CHA free to bet.`
                            : amount > freeV1 && amount > freeV2 ? `One bet spends one balance: upgrade your Blaze v1 CHA in the wallet panel to bet ${formatUnits(amount)} CHA at once.`
                            : null;

    async function submit() {
        if (problem || !selected || amount === null) return;
        setSubmitting(true);
        setError(null);
        try {
            await placeBet(amount, selected.contractId, amount <= freeV1 ? CHA_SUBNET_V1 : CHA_SUBNET_V2);
            refresh();
            setBacked({ symbol: selected.symbol, amount });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto border-line bg-surface-raised p-0 sm:max-w-[560px]">
                <DialogHeader className="border-b border-line p-5 pb-4">
                    <DialogTitle className="text-xl">Back a meme</DialogTitle>
                    <DialogDescription>
                        Your CHA joins the pot. When the timer ends the wheel picks one meme, and the whole pot buys it. You get the winner either way.
                    </DialogDescription>
                </DialogHeader>

                {backed ? (
                    <div className="space-y-5 p-5 text-center">
                        <div>
                            <p className="text-4xl">🎰</p>
                            <p className="mt-2 text-xl font-bold">You backed {backed.symbol} with {formatUnits(backed.amount)} CHA</p>
                            <p className="mt-1 text-sm text-ink-muted">Bring friends in: the bigger the pot, the bigger the pump.</p>
                        </div>
                        <SharePickButton symbol={backed.symbol} className="mx-auto" />
                        <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
                    </div>
                ) : (
                <div className="space-y-5 p-5">
                    {!isOpen && (
                        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
                            {round && now < round.opensAt ? `The next round opens in ${formatCountdown(round.opensAt - now)}.` : 'Betting is closed for this round. The draw is coming up.'}
                        </p>
                    )}

                    {!connected ? (
                        <Button onClick={connectWallet} disabled={isConnecting} className="w-full" size="lg">
                            <Wallet className="h-4 w-4" /> {isConnecting ? 'Connecting…' : 'Connect wallet to play'}
                        </Button>
                    ) : (
                        <div className="rounded-lg border border-line bg-surface p-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-ink-muted">Ready to play</span>
                                <span className="font-mono font-semibold">
                                    {subnetBalanceLoading ? "…" : <><AnimatedAmount value={Number(subnetBalance)} format={n => formatUnits(n)} /> CHA</>}
                                </span>
                            </div>
                            {committed > 0n && (
                                <div className="mt-1 flex items-center justify-between text-ink-muted">
                                    <span>Already in this round</span>
                                    <span className="font-mono">{formatUnits(committed)} CHA</span>
                                </div>
                            )}
                            {free < ONE_CHA && (
                                <div className="mt-3 space-y-2 border-t border-line pt-3">
                                    <p>You need subnet CHA to play. One swap turns STX into playable CHA.</p>
                                    <SwapStxToChaButton buttonLabel="Get CHA to play" size="sm" onSwapSuccess={txid => setTopUpTx(txid)} />
                                    {topUpTx && (
                                        <p className="text-ink-muted">
                                            Swap sent. Your CHA arrives once it confirms, usually within a minute.{' '}
                                            <a href={explorerTx(topUpTx)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">
                                                View <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="mb-2 block text-sm font-semibold">Pick a meme</label>
                        <div className="relative mb-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or symbol" className="pl-9" />
                        </div>
                        {tokensError && <p className="text-sm text-danger">{tokensError}</p>}
                        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-1">
                            {tokensLoading && <li className="p-3 text-sm text-ink-muted">Loading memes…</li>}
                            {!tokensLoading && !choices.length && <li className="p-3 text-sm text-ink-muted">No meme matches “{query}”.</li>}
                            {choices.map(t => {
                                const stake = BigInt(tally[t.contractId] ?? '0');
                                return (
                                    <li key={t.contractId}>
                                        <button type="button" onClick={() => setTokenId(t.contractId)}
                                            className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${tokenId === t.contractId ? 'bg-accent-soft ring-1 ring-accent-line' : 'hover:bg-surface-hover'}`}>
                                            <TokenLogo token={t} size={28} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold">{t.symbol}</span>
                                                <span className="block truncate text-xs text-ink-muted">{t.name}</span>
                                            </span>
                                            {stake > 0n && pot > 0n && (
                                                <span className="font-mono text-xs text-ink-muted">{Number((stake * 1000n) / pot) / 10}% of the pot</span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold">How much CHA</label>
                        <div className="mb-2 grid grid-cols-4 gap-2">
                            {PRESETS.map(p => (
                                <button key={p} type="button" onClick={() => setAmountText(String(p))}
                                    className={`rounded-lg border px-2 py-2 font-mono text-sm font-semibold transition-colors ${amountText === String(p) ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface hover:bg-surface-hover'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                        <Input inputMode="decimal" value={amountText} onChange={e => setAmountText(e.target.value)} placeholder="Amount in CHA" className="font-mono" />
                    </div>

                    {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}

                    <Button onClick={submit} disabled={!!problem || submitting || !connected} className="w-full" size="lg">
                        {submitting ? 'Waiting for your signature…'
                            : selected && amount ? `Back ${selected.symbol} with ${formatUnits(amount)} CHA` : 'Back a meme'}
                    </Button>
                    {connected && problem && isOpen && <p className="-mt-3 text-center text-xs text-ink-muted">{problem}</p>}
                    {connected && <p className="-mt-2 text-center text-xs text-ink-faint">Signing is free: no transaction until the draw. Signed by {address.slice(0, 6)}…</p>}
                </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
