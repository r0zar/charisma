'use client';

import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/components/ui/sonner';
import { useWallet } from '@/contexts/wallet-context';
import { useTokens } from '@/contexts/tokens-context';
import { REVEAL_MS } from '@/lib/roulette/wheel';
import { formatUnits, shortAddress } from '@/lib/format';
import type { RoundPayload } from '@/lib/roulette/types';

interface RoundState {
    payload: RoundPayload | null;
    /** the last poll's error; the payload is then the last one that arrived */
    error: string | null;
    /** milliseconds on the server's clock */
    now: () => number;
    refresh: () => void;
}

const RoundContext = createContext<RoundState | null>(null);

const SLOW_MS = 2000;
const FAST_MS = 500;
/** poll fast this close to a deadline */
const NEAR_MS = 15_000;
/** clock-offset samples kept (about a minute at the slow rate) */
const SAMPLES = 30;

function pollDelay(p: RoundPayload | null, now: number): number {
    if (!p) return SLOW_MS;
    const r = p.round;
    const near = r ? [r.opensAt, r.locksAt, r.endsAt].some(t => Math.abs(t - now) < NEAR_MS) : false;
    const awaitingDraw = r?.status === 'live' && now >= r.endsAt;
    const revealing = !!p.last?.draw && now < p.last.draw.drawnAt + REVEAL_MS;
    return near || awaitingDraw || revealing ? FAST_MS : SLOW_MS;
}

/**
 * Polls GET /api/round and keeps the server clock. Every sample `serverNow - receivedAt` is a lower bound on the
 * offset (the answer was made before it arrived, and a cached answer even earlier), so the offset is the largest
 * recent sample: within one network hop of the truth, whatever the device clock says.
 */
export function RoundProvider({ children }: { children: ReactNode }) {
    const { address } = useWallet();
    const { byId } = useTokens();
    const [payload, setPayload] = useState<RoundPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const offset = useRef(0);
    const samples = useRef<number[]>([]);
    const seenBets = useRef<Set<string> | null>(null);
    const tokensRef = useRef(byId);
    const addressRef = useRef(address);
    const pollRef = useRef<() => void>(() => {});
    tokensRef.current = byId;
    addressRef.current = address;

    const now = () => Date.now() + offset.current;

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let stopped = false;
        let latest: RoundPayload | null = null;

        const schedule = () => {
            clearTimeout(timer);
            if (!stopped && !document.hidden) timer = setTimeout(poll, pollDelay(latest, now()));
        };

        async function poll() {
            const user = addressRef.current;
            try {
                const res = await fetch(`/api/round${user ? `?user=${encodeURIComponent(user)}` : ''}`, { cache: 'no-store' });
                const receivedAt = Date.now();
                if (!res.ok) throw new Error(`the game server answered ${res.status}`);
                const next = (await res.json()) as RoundPayload;
                if (stopped) return;

                const sample = next.serverNow - receivedAt;
                // a device clock that jumped invalidates the old samples
                if (samples.current.length && Math.abs(sample - offset.current) > 5000) samples.current = [];
                samples.current = [...samples.current.slice(-(SAMPLES - 1)), sample];
                offset.current = Math.max(...samples.current);

                announceNewBets(next, user);
                latest = next;
                setPayload(next);
                setError(null);
            } catch (e) {
                if (!stopped) setError(`Can't reach the game right now (${e instanceof Error ? e.message : String(e)})`);
            }
            schedule();
        }

        function announceNewBets(next: RoundPayload, user: string) {
            const seen = seenBets.current;
            if (!seen) {
                seenBets.current = new Set(next.recentBets.map(b => b.uuid));
                return;
            }
            for (const b of [...next.recentBets].reverse()) {
                if (seen.has(b.uuid)) continue;
                seen.add(b.uuid);
                if (b.user === user) continue;
                const symbol = tokensRef.current[b.tokenId]?.symbol ?? 'a meme';
                toast(`${shortAddress(b.user)} backed ${symbol}`, { description: `${formatUnits(b.amount)} CHA into the pot` });
            }
        }

        const onVisibility = () => { if (!document.hidden) poll(); else clearTimeout(timer); };
        pollRef.current = () => { clearTimeout(timer); poll(); };
        document.addEventListener('visibilitychange', onVisibility);
        poll();
        return () => {
            stopped = true;
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    // a new wallet means a new ?user= answer
    useEffect(() => { pollRef.current(); }, [address]);

    return createElement(RoundContext.Provider, { value: { payload, error, now, refresh: () => pollRef.current() } }, children);
}

export function useRound(): RoundState {
    const ctx = useContext(RoundContext);
    if (!ctx) throw new Error('useRound must be used inside <RoundProvider>');
    return ctx;
}
