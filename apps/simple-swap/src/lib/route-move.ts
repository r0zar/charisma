import { OPCODES, type Hop } from 'dexterity-sdk';

/**
 * Whether a route only moves one token between Standard and Blaze (every hop a sublink), and which way. A route that
 * changes the token is a swap, even when it starts or ends on Blaze, so it gets null.
 */
export function moveOf(hops: Hop[] | undefined): 'to-subnet' | 'from-subnet' | null {
    if (!hops?.length || !hops.every(hop => hop.vault.type === 'SUBLINK')) return null;
    return hops[hops.length - 1].opcode === OPCODES.OP_DEPOSIT ? 'to-subnet' : 'from-subnet';
}
