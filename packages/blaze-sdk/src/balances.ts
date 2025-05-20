/**
 * Shape of the balance data returned by the balances endpoint.
 * Mirrors the API response closely so downstream consumers can rely on strong typing.
 */
export interface BalanceData {
    /** SIP-10 (or other) token contract identifier `{principal}.{contractName}` */
    contractId: string;
    /** Stacks user address the balance belongs to */
    address: string;
    /** On-chain confirmed balance as a decimal‐encoded string */
    onChainBalance: string;
    /** Net diff of all pending transactions ("mempool delta") as a decimal-encoded string */
    pendingDiff: string;
    /** onChainBalance + pendingDiff as a decimal-encoded string */
    preconfirmationBalance: string;
    /**
     * Optional error information – present when the request succeeded technically
     * but the endpoint signalled an application-level error.
     */
    error?: string | null;
}

interface BalanceEndpointSuccess {
    contractId: string;
    address: string;
    onChainBalance: string;
    pendingDiff: string;
    preconfirmationBalance: string;
}

interface BalanceEndpointError {
    error: string;
}

/**
 * Internal: create a fully-populated BalanceData object containing safe defaults
 * so downstream UI components can rely on all properties being present.
 */
function createDefaultBalanceData(contractId: string, address: string): BalanceData {
    return {
        contractId,
        address,
        onChainBalance: '0',
        pendingDiff: '0',
        preconfirmationBalance: '0',
        error: 'Balance data unavailable',
    };
}

/**
 * Fetch a user's balance (confirmed, pending delta & pre-confirmation) via the
 * shared balances service. Falls back to a zero-filled structure when the
 * request fails or the service responds with an error.
 */
export async function getUserTokenBalance(
    contractId: string,
    address: string,
): Promise<BalanceData> {
    const encodedContractId = encodeURIComponent(contractId);
    const encodedAddress = encodeURIComponent(address);
    const url = `https://blaze.charisma.rocks/api/balances/${encodedContractId}/${encodedAddress}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(
                `Balances API error for ${contractId} @ ${address}: ${response.status} ${response.statusText}`,
            );
            return createDefaultBalanceData(contractId, address);
        }

        // The endpoint returns either BalanceEndpointSuccess or BalanceEndpointError
        const json = (await response.json()) as BalanceEndpointSuccess | BalanceEndpointError;

        if ('error' in json) {
            return {
                ...createDefaultBalanceData(contractId, address),
                error: json.error || 'Unknown endpoint error',
            };
        }

        // Map endpoint response to BalanceData while ensuring all required props exist
        return {
            contractId: json.contractId,
            address: json.address,
            onChainBalance: json.onChainBalance ?? '0',
            pendingDiff: json.pendingDiff ?? '0',
            preconfirmationBalance: json.preconfirmationBalance ?? '0',
            error: null,
        };
    } catch (err) {
        console.error(`Failed to fetch balance for ${contractId} @ ${address}:`, err);
        return createDefaultBalanceData(contractId, address);
    }
}