import { kv } from "@vercel/kv";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"; // Keep Card imports for layout
import { PendingMessagesTable } from "@/components/dashboard/PendingMessagesTable";
import { Toaster } from "@/components/ui/sonner";
import type { QueuedTxIntent } from "@/lib/types";
import { calculatePendingBalanceDiff } from "@/lib/balance-diff"; // Keep if calling directly
import { validateStacksAddress } from "@stacks/transactions/dist/esm/utils";
import { cn } from "@/lib/utils"; // For potential styling
import { Badge } from "@/components/ui/badge"; // For displaying balance
import { Suspense } from "react"; // For loading states
import { Skeleton } from "@/components/ui/skeleton"; // For loading states
import { getTokenMetadataCached, type TokenCacheData } from "@repo/tokens";

// Force dynamic rendering to bypass data cache and always fetch latest queue
export const dynamic = 'force-dynamic';

// Define the *default* token contract ID (less critical now)
const DEFAULT_TOKEN_CONTRACT_ID = process.env.TOKEN_CONTRACT_ID || "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6";

// Key for the tracked principals set
const TRACKED_PRINCIPALS_KEY = "tracked-principals";
// Key for the tracked token contract IDs set
const TRACKED_TOKENS_KEY = "tracked-tokens";

// Queue key
const TX_QUEUE_KEY = "stacks-tx-queue";

async function getPendingMessages(): Promise<QueuedTxIntent[]> {
    console.log("Dashboard: Attempting to fetch messages from KV key:", TX_QUEUE_KEY);
    try {
        // kv.lrange returns already parsed objects if stored as JSON
        const messagesData = await kv.lrange<QueuedTxIntent>(TX_QUEUE_KEY, 0, -1);
        console.log("Dashboard: Raw data fetched from KV (count: " + messagesData.length + "):", messagesData);

        if (!Array.isArray(messagesData)) {
            console.error("Dashboard: KV data is not an array!", messagesData);
            return [];
        }

        // Filter out any potentially invalid or non-conforming items
        const validMessages = messagesData.filter(msg => {
            // Basic type validation (can be improved with a validation library like Zod)
            const isValid = msg && typeof msg === 'object' &&
                typeof msg.signature === 'string' &&
                typeof msg.contractId === 'string' &&
                typeof msg.intent === 'string' &&
                typeof msg.uuid === 'string';
            if (!isValid) {
                console.warn("Dashboard: Filtering out item with unexpected structure:", msg);
            }
            return isValid;
        });

        console.log("Dashboard: Processed valid messages count:", validMessages.length);
        return validMessages;

    } catch (error) {
        console.error("Dashboard: Failed to fetch/process messages from KV:", error);
        return []; // Return empty array on error
    }
}

async function getTrackedPrincipals(): Promise<string[]> {
    try {
        const principals = await kv.smembers(TRACKED_PRINCIPALS_KEY);
        console.log("Dashboard: Fetched tracked principals:", principals);
        // Filter for valid Stacks addresses just in case
        return principals.filter(p => typeof p === 'string' && validateStacksAddress(p));
    } catch (error) {
        console.error("Dashboard: Failed to fetch tracked principals:", error);
        return [];
    }
}

// NEW: Fetches the set of tracked token contract IDs
async function getTrackedTokenIds(): Promise<string[]> {
    try {
        const tokenIds = await kv.smembers(TRACKED_TOKENS_KEY);
        console.log("Dashboard: Fetched tracked token IDs:", tokenIds);
        // No validation needed here, these are identifiers not addresses
        return tokenIds.filter(id => typeof id === 'string');
    } catch (error) {
        console.error("Dashboard: Failed to fetch tracked token IDs:", error);
        return [];
    }
}

// Interface for balance data (Add tokenId)
interface BalanceInfo {
    principal: string;
    tokenId: string; // Added
    preconfirmationBalance: string | null;
    onChainBalance: string | null;
    pendingDiff: string | null;
    error?: string;
}

// Fetches balance for a single principal AND a specific token ID
async function fetchBalanceForPrincipalAndToken(
    principal: string,
    tokenId: string
): Promise<BalanceInfo> {
    // Construct the absolute URL for the API endpoint using tokenId
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';
    const apiUrl = `${baseUrl}/api/balances/${tokenId}/${principal}`;
    // console.log(`Dashboard: Fetching balance from URL: ${apiUrl}`); // Less verbose logging now

    try {
        const response = await fetch(apiUrl, { cache: 'no-store' }); // Ensure fresh data
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error (${response.status})`);
        }
        const data = await response.json();
        if (
            data.preconfirmationBalance === undefined ||
            data.onChainBalance === undefined ||
            data.pendingDiff === undefined
        ) {
            throw new Error('API response missing expected balance fields');
        }
        return {
            principal,
            tokenId, // Store tokenId
            preconfirmationBalance: data.preconfirmationBalance,
            onChainBalance: data.onChainBalance,
            pendingDiff: data.pendingDiff,
            error: undefined
        };
    } catch (error) {
        // Don't log every single failure here, might be noisy if principal doesn't own token
        // console.error(`Dashboard: Failed to fetch balance for ${principal} (${tokenId}):`, error);
        return {
            principal,
            tokenId, // Store tokenId
            preconfirmationBalance: null,
            onChainBalance: null,
            pendingDiff: null,
            // Return a specific error type or message?
            error: error instanceof Error ? error.message : "Fetch failed or no balance"
        };
    }
}

export default async function DashboardPage() {
    // Fetch initial sets of principals, tokens, and pending messages
    const [pendingMessages, trackedPrincipals, trackedTokenIds] = await Promise.all([
        getPendingMessages(),
        getTrackedPrincipals(),
        getTrackedTokenIds(),
    ]);

    // Fetch metadata for all tracked tokens concurrently
    const metadataPromises = trackedTokenIds.map(getTokenMetadataCached);
    const metadataResults = await Promise.all(metadataPromises);
    const tokenMetadataMap = new Map<string, TokenCacheData>();
    metadataResults.forEach(meta => {
        if (meta && meta.contractId) {
            tokenMetadataMap.set(meta.contractId, meta);
        }
    });
    console.log("Dashboard: Fetched metadata for tracked tokens:", tokenMetadataMap);

    // Fetch all balances for all principal/token combinations concurrently
    const balancePromises: Promise<BalanceInfo>[] = [];
    for (const principal of trackedPrincipals) {
        for (const tokenId of trackedTokenIds) {
            balancePromises.push(fetchBalanceForPrincipalAndToken(principal, tokenId));
        }
    }
    const allBalances = await Promise.all(balancePromises);
    console.log(`Dashboard: Fetched ${allBalances.length} balance results.`);

    // Group balances by principal
    const balancesByPrincipal = new Map<string, BalanceInfo[]>();
    allBalances.forEach((balanceInfo: BalanceInfo) => {
        // Only include balances where fetch didn't fail and returned a balance (even 0)
        if (balanceInfo.preconfirmationBalance !== null) {
            const existing = balancesByPrincipal.get(balanceInfo.principal) || [];
            existing.push(balanceInfo);
            balancesByPrincipal.set(balanceInfo.principal, existing);
        }
    });
    console.log("Dashboard: Grouped balances by principal:", balancesByPrincipal);

    // We still need a primary token symbol/name for the main card title
    const primaryTokenMeta = tokenMetadataMap.get(DEFAULT_TOKEN_CONTRACT_ID);
    const primaryDisplayName = primaryTokenMeta?.name || DEFAULT_TOKEN_CONTRACT_ID.split('.')[1] || 'Token';

    return (
        <div className="container mx-auto py-10 space-y-8">
            {/* Balances Section - Title uses primary token name */}
            <Card>
                <CardHeader>
                    <CardTitle>Wallet Balances</CardTitle>
                    <CardDescription>
                        Balances for tracked principals across all encountered tokens.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {trackedPrincipals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No principals tracked yet.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {/* Iterate through principals that have balances */}
                            {[...balancesByPrincipal.entries()].map(([principal, balances]) => (
                                <div key={principal} className="border rounded-md p-3 text-sm space-y-2 flex flex-col">
                                    {/* Principal Address */}
                                    <p className="font-mono text-xs truncate font-medium mb-1" title={principal}>
                                        {truncatePrincipal(principal)}
                                    </p>
                                    {/* List of Token Balances for this Principal */}
                                    <div className="space-y-1 pt-1 flex-grow">
                                        {balances.length > 0 ? (
                                            balances.map((balInfo) => {
                                                const meta = tokenMetadataMap.get(balInfo.tokenId);
                                                // Use optional chaining and nullish coalescing for safer defaults
                                                const symbol = meta?.symbol ?? balInfo.tokenId.split('.')[1]?.split('-')[0] ?? 'TKN';
                                                const name = meta?.name ?? balInfo.tokenId.split('.')[1] ?? 'Token';
                                                const image = meta?.image;
                                                const decimals = meta?.decimals;

                                                // Handle case where balance fetch failed
                                                if (balInfo.preconfirmationBalance === null) {
                                                    return (
                                                        <div key={`${balInfo.tokenId}-error`} className="flex items-center space-x-2 text-xs text-destructive opacity-75">
                                                            {image ? (
                                                                <img src={image} alt={`${name} logo`} className="h-4 w-4 rounded-full object-cover flex-shrink-0" />
                                                            ) : (
                                                                <div className="h-4 w-4 rounded-full bg-muted flex-shrink-0"></div>
                                                            )}
                                                            <span title={balInfo.tokenId}>Error loading {symbol}</span>
                                                        </div>
                                                    );
                                                }

                                                // Format balances using the helper
                                                const formattedPreconf = formatBalance(balInfo.preconfirmationBalance, decimals);
                                                const formattedConfirmed = formatBalance(balInfo.onChainBalance, decimals);
                                                const formattedPending = formatBalance(balInfo.pendingDiff, decimals);

                                                // Display successful balance fetch
                                                return (
                                                    <div key={balInfo.tokenId} className="flex items-center space-x-2 text-xs">
                                                        {image ? (
                                                            <img src={image} alt={`${name} logo`} className="h-4 w-4 rounded-full object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="h-4 w-4 rounded-full bg-muted flex-shrink-0"></div>
                                                        )}
                                                        <div className="flex flex-col items-start flex-grow">
                                                            <span className="font-medium" title={balInfo.tokenId}>
                                                                {formattedPreconf} {symbol}
                                                            </span>
                                                            <span className="text-muted-foreground text-[10px]">
                                                                (Conf: {formattedConfirmed}, Pend: {formattedPending})
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">No token balances found.</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pending Messages Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Pending Transactions</CardTitle>
                    <CardDescription>
                        Messages currently in the queue waiting for execution by the node.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                        <PendingMessagesTable pendingMessages={pendingMessages} />
                    </Suspense>
                </CardContent>
            </Card>
            <Toaster />
        </div>
    );
}

// Helper added here for simplicity, move to utils if needed
function truncatePrincipal(principal: string | null | undefined, startLength = 6, endLength = 4): string {
    if (!principal) return 'N/A';
    if (principal.length <= startLength + endLength + 3) return principal;
    return `${principal.substring(0, startLength)}...${principal.substring(principal.length - endLength)}`;
}

// NEW: Helper to format raw balance string with decimals
function formatBalance(balanceStr: string | null | undefined, decimals: number | undefined): string {
    if (balanceStr === null || balanceStr === undefined) return "N/A";
    // Default to 6 decimals if not provided or invalid
    const dec = (typeof decimals === 'number' && decimals >= 0) ? decimals : 6;

    // Handle zero decimals case
    if (dec === 0) return balanceStr;

    try {
        // Ensure it's a non-negative integer string
        if (!/^\d+$/.test(balanceStr)) return balanceStr; // Return as is if not a simple integer string

        const len = balanceStr.length;

        if (len <= dec) {
            // Pad with leading zeros if balance length is less than or equal to decimals
            return `0.${balanceStr.padStart(dec, '0')}`;
        } else {
            // Insert decimal point
            const integerPart = balanceStr.slice(0, len - dec);
            const fractionalPart = balanceStr.slice(len - dec);
            // Optional: Trim trailing zeros from fractional part if desired
            // const trimmedFractional = fractionalPart.replace(/0+$/, '');
            // return `${integerPart}${trimmedFractional ? '.' + trimmedFractional : ''}`;
            return `${integerPart}.${fractionalPart}`;
        }
    } catch (e) {
        console.error(`Error formatting balance ${balanceStr} with ${dec} decimals:`, e);
        return balanceStr; // Return original string on error
    }
}