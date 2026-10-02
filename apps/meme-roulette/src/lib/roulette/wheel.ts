/**
 * The wheel's motion as a pure function of server time, shared by the 3D and 2D wheels.
 * Every device computes the same angle at the same moment, so everyone watches the same spin.
 */
import type { Slice } from './types';

export const SPIN_MS = 9000;
/** how long the reveal stays on the landed wheel before the result card */
export const REVEAL_MS = 12000;

const TAU = Math.PI * 2;

export interface WheelSlice {
    tokenId: string;
    stake: number;
    /** start and end angle, radians, clockwise from the pointer */
    from: number;
    to: number;
    share: number;
}

/** Slices laid out clockwise in tokenId order, each sized by its stake. */
export function layoutSlices(slices: Slice[]): WheelSlice[] {
    const sorted = [...slices].filter(s => BigInt(s.stake) > 0n).sort((a, b) => (a.tokenId < b.tokenId ? -1 : 1));
    const total = sorted.reduce((sum, s) => sum + Number(s.stake), 0);
    let at = 0;
    return sorted.map(s => {
        const share = total ? Number(s.stake) / total : 0;
        const slice = { tokenId: s.tokenId, stake: Number(s.stake), from: at * TAU, to: (at + share) * TAU, share };
        at += share;
        return slice;
    });
}

/** Where the ticket sits on the wheel, radians clockwise from the slices' start. */
export function ticketAngle(ticket: string, total: string): number {
    const t = BigInt(ticket), n = BigInt(total);
    if (n === 0n) return 0;
    // 1e9 steps of precision is far finer than a pixel
    return Number((t * 1_000_000_000n) / n) / 1_000_000_000 * TAU;
}

const easeOutQuint = (x: number) => 1 - Math.pow(1 - x, 5);

/**
 * The wheel's rotation (radians, clockwise) at server time `now`: 0 before the draw, then a 9 s ease-out that ends
 * with the ticket exactly under the pointer after `turns` whole turns.
 */
export function wheelRotation(now: number, drawnAt: number, ticket: string, total: string, turns: number): number {
    const end = turns * TAU + (TAU - ticketAngle(ticket, total));
    const progress = Math.min(1, Math.max(0, (now - drawnAt) / SPIN_MS));
    return end * easeOutQuint(progress);
}

/** The slice under the pointer for a given rotation. */
export function sliceAtPointer(slices: WheelSlice[], rotation: number): WheelSlice | undefined {
    const at = ((TAU - (rotation % TAU)) % TAU + TAU) % TAU;
    return slices.find(s => at >= s.from && at < s.to) ?? slices[slices.length - 1];
}
