'use client';

import { useEffect, useState } from 'react';
import { useRound } from './useRound';

/** The server clock, re-rendering every `everyMs` (countdowns tick, screens change on time). */
export function useServerTime(everyMs = 1000): number {
    const { now } = useRound();
    const [t, setT] = useState(() => now());
    useEffect(() => {
        const id = setInterval(() => setT(now()), everyMs);
        return () => clearInterval(id);
    }, [everyMs]);
    return t;
}
