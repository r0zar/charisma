'use client';

import { useState, useMemo, startTransition, useRef, useEffect } from 'react';
import { TokenMetadata } from "@repo/cryptonomicon";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { removeTokenFromList, refreshTokenData } from '@/app/actions';

// Helper to check if a string looks like a Stacks contract ID (basic check)
const looksLikeContractId = (id: string): boolean => {
    return id.includes('.') && id.length > 2; // Simple check
};

/**
 * Truncates a contract address for display, keeping the beginning, the end, and the contract name
 * Example: "SP2Z1W1R6FPGG8V18K7E0H353X1W64G1N3K3NX6AQ.token-name" becomes "SP2Z1...NX6AQ.token-name"
 */
const truncateContractId = (contractId: string, prefixLength = 4, suffixLength = 4): string => {
    if (!contractId || !looksLikeContractId(contractId)) {
        return contractId || '';
    }

    const parts = contractId.split('.');
    if (parts.length !== 2) return contractId;

    const [address, contractName] = parts;

    // If the address part is short enough, don't truncate
    if (address.length <= prefixLength + suffixLength + 3) {
        return contractId;
    }

    const prefix = address.substring(0, prefixLength);
    const suffix = address.substring(address.length - suffixLength);

    return `${prefix}...${suffix}.${contractName}`;
};

interface TokenListProps {
    initialTokens: TokenMetadata[];
    isDevelopment: boolean;
    initialSearchTerm?: string;
}

// Unified status message type
type StatusMessage = {
    id: string;
    type: 'success' | 'error' | 'info' | 'loading';
    message: string;
    timestamp: number;
};

/**
 * Formats the raw total supply using the token's decimals.
 * Handles large numbers using BigInt.
 * @param supply Raw total supply (string or number).
 * @param decimals Number of decimals.
 * @returns Formatted string representation or 'N/A'.
 */
const formatSupplyWithDecimals = (
    supply: string | number | undefined | null,
    decimals: number | undefined | null
): string => {
    if (supply === undefined || supply === null || decimals === undefined || decimals === null) {
        return 'N/A';
    }

    try {
        const rawSupplyBigInt = BigInt(String(supply));
        // Create divisor without using ** operator on BigInt
        let divisor = BigInt(1);
        for (let i = 0; i < decimals; i++) {
            divisor = divisor * BigInt(10);
        }
        const formattedSupply = rawSupplyBigInt / divisor;
        return formattedSupply.toLocaleString();
    } catch (error) {
        console.error("Error formatting supply:", error, { supply, decimals });
        return 'Invalid Data';
    }
};

export default function TokenList({ initialTokens, isDevelopment, initialSearchTerm = '' }: TokenListProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [expandedTokens, setExpandedTokens] = useState<Record<string, boolean>>({});
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [removingTokenId, setRemovingTokenId] = useState<string | null>(null);
    const [refreshingTokenId, setRefreshingTokenId] = useState<string | null>(null);

    // Unified status messages queue with auto-removal
    const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const messageTimeoutRef = useRef<NodeJS.Timeout[]>([]);
    const searchPerformedRef = useRef(false);

    // Clear message timeouts on unmount
    useEffect(() => {
        return () => {
            messageTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
        };
    }, []);

    // Effect to handle initialSearchTerm (replaces the previous URL search parameter effect)
    useEffect(() => {
        if (initialSearchTerm && !searchPerformedRef.current) {
            setSearchTerm(initialSearchTerm);
            // Check if the search term is a contract ID and not found in initialTokens
            if (looksLikeContractId(initialSearchTerm) &&
                !initialTokens.some(token => token.contract_principal === initialSearchTerm)) {
                // Automatically trigger a lookup
                handleLookup(initialSearchTerm);
                searchPerformedRef.current = true;
            }
        }
    }, [initialSearchTerm, initialTokens]);

    // Add a status message with auto-removal after delay
    const addStatusMessage = (type: StatusMessage['type'], message: string, autoRemoveDelay = 5000) => {
        const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newMessage: StatusMessage = {
            id,
            type,
            message,
            timestamp: Date.now()
        };

        setStatusMessages(prev => [newMessage, ...prev].slice(0, 5)); // Keep last 5 messages

        // Set timeout to auto-remove the message
        if (autoRemoveDelay > 0 && type !== 'loading') {
            const timeout = setTimeout(() => {
                setStatusMessages(prev => prev.filter(msg => msg.id !== id));
            }, autoRemoveDelay);
            messageTimeoutRef.current.push(timeout);
        }

        return id; // Return ID for potential manual removal
    };

    // Remove a status message by ID
    const removeStatusMessage = (id: string) => {
        setStatusMessages(prev => prev.filter(msg => msg.id !== id));
    };

    const filteredTokens = useMemo(() => {
        if (!searchTerm) {
            return initialTokens;
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return initialTokens.filter(
            (token) =>
                token.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
                token.symbol?.toLowerCase().includes(lowerCaseSearchTerm) ||
                token.contract_principal?.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }, [initialTokens, searchTerm]);

    const toggleExpand = (contractId: string) => {
        setExpandedTokens(prev => ({
            ...prev,
            [contractId]: !prev[contractId]
        }));
    };

    const handleLookup = async (contractId: string) => {
        if (!looksLikeContractId(contractId)) return;

        setIsLookingUp(true);
        const loadingMsgId = addStatusMessage('loading', `Looking up ${truncateContractId(contractId)}...`, 0);

        try {
            const response = await fetch(`/api/v1/sip10/${encodeURIComponent(contractId)}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! Status: ${response.status}`);
            }

            removeStatusMessage(loadingMsgId);
            addStatusMessage('success', `Found ${result.name || truncateContractId(contractId)}. Clear search or refresh page to see it in the list.`);
        } catch (error: any) {
            console.error("Lookup failed:", error);
            removeStatusMessage(loadingMsgId);
            addStatusMessage('error', `Lookup failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleRemove = async (contractId: string) => {
        if (!contractId || !isDevelopment) return;

        setRemovingTokenId(contractId);
        const loadingMsgId = addStatusMessage('loading', `Removing ${truncateContractId(contractId)}...`, 0);

        startTransition(async () => {
            const result = await removeTokenFromList(contractId);

            removeStatusMessage(loadingMsgId);
            if (result.success) {
                addStatusMessage('success', `Removed ${truncateContractId(contractId)}. Refresh page to see updated list.`);
            } else {
                addStatusMessage('error', result.error || 'Failed to remove token.');
            }
            setRemovingTokenId(null);
        });
    };

    const handleRefresh = async (contractId: string) => {
        if (!contractId) return;

        setRefreshingTokenId(contractId);
        const loadingMsgId = addStatusMessage('loading', `Refreshing ${truncateContractId(contractId)}...`, 0);

        startTransition(async () => {
            const result = await refreshTokenData(contractId);

            removeStatusMessage(loadingMsgId);
            if (result.success) {
                addStatusMessage('success', result.message || `Refreshed ${truncateContractId(contractId)}.`);
                router.refresh();
            } else {
                addStatusMessage('error', result.error || 'Failed to refresh token.');
            }
            setRefreshingTokenId(null);
        });
    };

    // Focus search input on page load
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    return (
        <div className="w-full flex flex-col gap-4">
            {/* Search Input with Label */}
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z" />
                    </svg>
                    <span className="sr-only">Search tokens</span>
                </div>
                <input
                    ref={searchInputRef}
                    type="search"
                    placeholder="Search by name, symbol, or contract ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 px-4 py-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    aria-label="Search tokens"
                />
            </div>

            {/* Status Messages Area */}
            {statusMessages.length > 0 && (
                <div className="space-y-2 animate-fadeIn">
                    {statusMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`p-3 rounded-lg flex items-center justify-between ${msg.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                msg.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    msg.type === 'loading' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                        'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                {msg.type === 'loading' && (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
                                )}
                                {msg.type === 'success' && (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                    </svg>
                                )}
                                {msg.type === 'error' && (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                                    </svg>
                                )}
                                <span>{msg.message}</span>
                            </div>
                            <button
                                onClick={() => removeStatusMessage(msg.id)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none"
                                aria-label="Dismiss message"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Lookup Button for When Search Finds Nothing */}
            {filteredTokens.length === 0 && !isLookingUp && (
                <div className="text-center py-8 px-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-gray-500 dark:text-gray-400 mb-4">No tokens match your search.</div>
                    {searchTerm && looksLikeContractId(searchTerm) && (
                        <button
                            onClick={() => handleLookup(searchTerm)}
                            disabled={isLookingUp}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2 mx-auto"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            Lookup '{truncateContractId(searchTerm)}'
                        </button>
                    )}
                </div>
            )}

            {/* Token List */}
            {filteredTokens.length > 0 && (
                <ul className="space-y-4">
                    {filteredTokens.map((token) => {
                        const isExpanded = expandedTokens[token.contract_principal || ''] || false;
                        const isRemoving = removingTokenId === token.contract_principal;
                        const isRefreshing = refreshingTokenId === token.contract_principal;
                        const isLoading = isRemoving || isRefreshing;

                        return (
                            <li key={token.contract_principal} className={`border rounded-lg dark:border-gray-700 overflow-hidden transition-all duration-300 ${isLoading ? 'opacity-70' : ''} ${isExpanded ? 'shadow-md' : 'shadow-sm hover:shadow'} bg-white dark:bg-gray-800`}>
                                {/* Main Row */}
                                <div
                                    className="flex items-center p-4 gap-4"
                                    // Provide visual feedback when clicking row
                                    style={isLoading ? { cursor: 'wait' } : { cursor: 'pointer' }}
                                    onClick={() => toggleExpand(token.contract_principal || '')}
                                >
                                    {/* Image */}
                                    <div className="flex-shrink-0">
                                        {token.image ? (
                                            <Image
                                                src={token.image}
                                                alt={`${token.name} logo`}
                                                width={40}
                                                height={40}
                                                className="rounded-md object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Columns */}
                                    <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-1 text-sm min-w-0">
                                        <div
                                            className="truncate cursor-pointer"
                                            title={token.name}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span className="font-semibold text-base block">{token.name}</span>
                                                <span className="text-gray-500 dark:text-gray-400">({token.symbol})</span>
                                                <svg
                                                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                </svg>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 break-all" title={token.contract_principal}>{truncateContractId(token.contract_principal || '', 4, 4)}</p>
                                        </div>

                                        {/* Description with overflow handling */}
                                        <div className="md:col-span-2 overflow-hidden" title={token.description}>
                                            <p style={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                wordBreak: 'break-word'
                                            }}>
                                                {token.description || '-'}
                                            </p>
                                        </div>

                                        {/* Supply information */}
                                        <div className="text-left">
                                            <span className="block font-medium">Total Supply</span>
                                            <span className="block text-gray-600 dark:text-gray-400">
                                                {formatSupplyWithDecimals(token.total_supply, token.decimals)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex-shrink-0 ml-auto flex items-center gap-2">
                                        {/* Refresh Button */}
                                        <button
                                            onClick={() => handleRefresh(token.contract_principal || '')}
                                            disabled={isLoading}
                                            className={`p-1.5 rounded-full ${isRefreshing ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 animate-pulse' : 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'} disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer`}
                                            aria-label={`Refresh ${token.symbol}`}
                                            title="Refresh Token Data"
                                        >
                                            {isRefreshing ? (
                                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                                </svg>
                                            )}
                                        </button>

                                        {/* Remove Button (Development Mode Only) */}
                                        {isDevelopment && (
                                            <button
                                                onClick={() => handleRemove(token.contract_principal || '')}
                                                disabled={isLoading}
                                                className={`p-1.5 rounded-full ${isRemoving ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'} disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer`}
                                                aria-label={`Remove ${token.symbol}`}
                                                title="Remove (Dev Only)"
                                            >
                                                {isRemoving ? (
                                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                    </svg>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded JSON View */}
                                {isExpanded && (
                                    <div className="border-t dark:border-gray-600 bg-gray-50 dark:bg-gray-900 animate-fadeDown">
                                        <pre className="p-4 overflow-auto whitespace-pre-wrap break-words text-xs font-mono">
                                            {JSON.stringify(token, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Add global styles for animations */}
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
                .animate-fadeDown {
                    animation: fadeDown 0.3s ease-out;
                }
            `}</style>
        </div>
    );
} 