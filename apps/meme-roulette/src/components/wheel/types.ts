import { SPIN_MS, wheelRotation } from '@/lib/roulette/wheel';
import type { Slice } from '@/lib/roulette/types';

/** A drawn round's landing, everything the motion needs */
export interface Spin {
    drawnAt: number;
    ticket: string;
    total: string;
    turns: number;
}

export interface WheelToken {
    symbol: string;
    image?: string;
}

export interface WheelProps {
    slices: Slice[];
    /** set once the round is drawn: the wheel spins from drawnAt and lands on the ticket */
    spin?: Spin;
    /** server clock */
    now: () => number;
    tokens: Record<string, WheelToken>;
    /** tokens the viewer backed: outlined */
    mine?: string[];
    winner?: string | null;
    /** betting closed: the wheel dims */
    dim?: boolean;
    /** fires once when a spin the viewer watched lands */
    onLanded?: () => void;
}

/** The wheel's rotation at server time t, radians clockwise: 0 until drawn, then the shared spin. */
export const rotationAt = (spin: Spin | undefined, t: number) =>
    spin ? wheelRotation(t, spin.drawnAt, spin.ticket, spin.total, spin.turns) : 0;

export const isSpinning = (spin: Spin | undefined, t: number) => !!spin && t < spin.drawnAt + SPIN_MS;

export const landsAt = (spin: Spin) => spin.drawnAt + SPIN_MS;
