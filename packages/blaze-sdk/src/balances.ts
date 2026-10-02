import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV } from '@stacks/transactions';

/** A user's balance of one token, as read from the chain */
export interface BalanceData {
    /** SIP-10 or subnet token contract identifier `{principal}.{contractName}` */
    contractId: string;
    /** Stacks user address the balance belongs to */
    address: string;
    /** Confirmed balance (atomic units) as a decimal-encoded string */
    onChainBalance: string;
    /** Mempool delta. Not tracked: always "0" */
    pendingDiff: string;
    /** onChainBalance + pendingDiff; equals onChainBalance */
    preconfirmationBalance: string;
    error?: string | null;
}

/**
 * A user's balance of a SIP-10 or Blaze subnet token, read on-chain with the token's own `get-balance`.
 * Throws a descriptive error when the chain can't be read, so callers never mistake an outage for a zero balance.
 */
export async function getUserTokenBalance(contractId: string, address: string): Promise<BalanceData> {
    const [contractAddress, contractName] = contractId.split('.');
    if (!contractAddress || !contractName) {
        throw new Error(`getUserTokenBalance: "${contractId}" is not a contract id ({principal}.{name})`);
    }

    const result = await callReadOnlyFunction(contractAddress, contractName, 'get-balance', [principalCV(address)]);
    const value = result?.value;
    if (value === undefined || value === null) {
        throw new Error(`getUserTokenBalance: ${contractId}.get-balance returned no value for ${address}`);
    }

    const balance = BigInt(value).toString();
    return { contractId, address, onChainBalance: balance, pendingDiff: '0', preconfirmationBalance: balance, error: null };
}
