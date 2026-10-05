'use client';

import { useEffect, useRef, useState } from 'react';

const ROLL_MS = 700;

/**
 * A number that rolls to its new value when it changes, tinted while it moves, so a balance changing is easy to see.
 * It holds still for people who ask their system for less motion. Give it a `key` per token, so switching tokens
 * shows the new number at once instead of rolling between two different tokens.
 */
export function AnimatedAmount({ value, format, className = '' }: { value: number; format: (n: number) => string; className?: string }) {
    const [shown, setShown] = useState(value);
    const [moving, setMoving] = useState(false);
    const current = useRef(value);

    useEffect(() => {
        const from = current.current;
        if (from === value) return setMoving(false);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            current.current = value;
            setShown(value);
            return;
        }
        setMoving(true);
        const began = performance.now();
        let frame = requestAnimationFrame(function roll(now) {
            const progress = Math.min(1, (now - began) / ROLL_MS);
            current.current = from + (value - from) * (1 - Math.pow(1 - progress, 3));
            setShown(current.current);
            if (progress < 1) frame = requestAnimationFrame(roll);
            else setMoving(false);
        });
        return () => cancelAnimationFrame(frame);
    }, [value]);

    // The tint is inline so it wins over whatever colour the caller gives the number
    return (
        <span className={`tabular-nums transition-colors duration-500 ${className}`} style={moving ? { color: 'var(--accent-text)' } : undefined}>
            {format(shown)}
        </span>
    );
}
