/** Which listed tokens can be backed: memes, not subnet balances, STX or CHA itself. Shared by the client and the server. */
export const isPlayableToken = (t: { contractId: string; type?: string }) =>
    t.type !== 'SUBNET' && t.contractId !== '.stx' && !t.contractId.endsWith('.charisma-token');
