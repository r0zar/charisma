'use client';

import { useState, useRef, useEffect } from 'react';
import Image from "next/image";
import { searchContracts, deleteSearch, getSavedSearches, ContractData, SearchResult } from '@/app/actions';

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

interface ContractListProps {
    isDevelopment: boolean;
    initialSearches: SearchResult[];
}

// Unified status message type
type StatusMessage = {
    id: string;
    type: 'success' | 'error' | 'info' | 'loading';
    message: string;
    timestamp: number;
};

type SearchResponse = {
    success: boolean;
    result?: SearchResult;
    error?: string;
};

export default function ContractList({ isDevelopment, initialSearches }: ContractListProps) {
    const [jsonInput, setJsonInput] = useState('');
    const [queryName, setQueryName] = useState('');
    const [searches, setSearches] = useState<SearchResult[]>(initialSearches);
    const [isSearching, setIsSearching] = useState(false);
    const [expandedContracts, setExpandedContracts] = useState<Record<string, boolean>>({});
    const [expandedSearches, setExpandedSearches] = useState<Record<string, boolean>>({});
    const [indexingSearchId, setIndexingSearchId] = useState<string | null>(null);
    const [indexingProgress, setIndexingProgress] = useState<{ total: number; current: number; success: number; failed: number }>({ total: 0, current: 0, success: 0, failed: 0 });

    // Unified status messages queue with auto-removal
    const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
    const jsonInputRef = useRef<HTMLTextAreaElement>(null);
    const messageTimeoutRef = useRef<NodeJS.Timeout[]>([]);

    // Clear message timeouts on unmount
    useEffect(() => {
        return () => {
            messageTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
        };
    }, []);

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

    const toggleExpandContract = (contractId: string) => {
        setExpandedContracts(prev => ({
            ...prev,
            [contractId]: !prev[contractId]
        }));
    };

    const toggleExpandSearch = (searchId: string) => {
        setExpandedSearches(prev => ({
            ...prev,
            [searchId]: !prev[searchId]
        }));
    };

    const refreshSearches = async () => {
        const loadingMsgId = addStatusMessage('loading', 'Refreshing saved searches...', 0);
        try {
            const refreshedSearches = await getSavedSearches();
            setSearches(refreshedSearches);
            removeStatusMessage(loadingMsgId);
            addStatusMessage('success', 'Searches refreshed');
        } catch (error: any) {
            removeStatusMessage(loadingMsgId);
            addStatusMessage('error', `Failed to refresh searches: ${error.message || 'Unknown error'}`);
        }
    };

    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!jsonInput.trim()) {
            addStatusMessage('error', 'Please enter a valid JSON trait definition');
            return;
        }

        let traitObject;
        try {
            traitObject = JSON.parse(jsonInput);
        } catch (error) {
            addStatusMessage('error', 'Invalid JSON format. Please check your input.');
            return;
        }

        setIsSearching(true);
        const loadingMsgId = addStatusMessage('loading', 'Searching for contracts...', 0);

        try {
            const response = await searchContracts(jsonInput, queryName) as SearchResponse;
            removeStatusMessage(loadingMsgId);

            if (response.success && response.result) {
                // Deduplicate contracts, keeping only those with highest block height
                if (response.result.contracts && response.result.contracts.length > 0) {
                    const contractsMap = new Map<string, ContractData>();

                    // Process each contract
                    response.result.contracts.forEach(contract => {
                        const existingContract = contractsMap.get(contract.contract_id);

                        // If we don't have this contract yet, or if this one has a higher block height
                        if (!existingContract || contract.block_height > existingContract.block_height) {
                            contractsMap.set(contract.contract_id, contract);
                        }
                    });

                    // Replace the contracts array with the deduplicated one
                    const originalCount = response.result.contracts.length;
                    response.result.contracts = Array.from(contractsMap.values());
                    const newCount = response.result.contracts.length;

                    // Sort contracts by block height (oldest first)
                    response.result.contracts.sort((a, b) => a.block_height - b.block_height);

                    if (originalCount > newCount) {
                        addStatusMessage(
                            'info',
                            `Removed ${originalCount - newCount} duplicate contract${originalCount - newCount !== 1 ? 's' : ''}`
                        );
                    }
                }

                // Add the new search to our list and automatically expand it
                setSearches(prev => [response.result!, ...prev]);
                setExpandedSearches(prev => ({
                    ...prev,
                    [response.result!.id]: true
                }));

                const count = response.result.contracts.length;
                addStatusMessage(
                    'success',
                    `Found ${count} contract${count !== 1 ? 's' : ''}`
                );

                // Clear inputs
                setJsonInput('');
                setQueryName('');
            } else {
                addStatusMessage('error', response.error || 'Failed to search contracts');
            }
        } catch (error: any) {
            removeStatusMessage(loadingMsgId);
            addStatusMessage('error', `Search failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSearching(false);
        }
    };

    const handleDeleteSearch = async (searchId: string) => {
        const loadingMsgId = addStatusMessage('loading', 'Deleting search...', 0);
        try {
            const response = await deleteSearch(searchId);
            removeStatusMessage(loadingMsgId);

            if (response.success) {
                // Remove from local state
                setSearches(prev => prev.filter(search => search.id !== searchId));
                addStatusMessage('success', 'Search deleted');
            } else {
                addStatusMessage('error', response.error || 'Failed to delete search');
            }
        } catch (error: any) {
            removeStatusMessage(loadingMsgId);
            addStatusMessage('error', `Failed to delete: ${error.message || 'Unknown error'}`);
        }
    };

    // Only keep the Dexterity trait example
    const dexterityTrait = {
        maps: [],
        epoch: "Epoch30",
        functions: [
            {
                args: [
                    { name: "amount", type: "uint128" },
                    {
                        name: "opcode",
                        type: { optional: { buffer: { length: 16 } } }
                    }
                ],
                name: "execute",
                access: "public",
                outputs: {
                    type: {
                        response: {
                            ok: {
                                tuple: [
                                    { name: "dk", type: "uint128" },
                                    { name: "dx", type: "uint128" },
                                    { name: "dy", type: "uint128" }
                                ]
                            },
                            error: "uint128"
                        }
                    }
                }
            },
            {
                args: [
                    { name: "amount", type: "uint128" },
                    {
                        name: "opcode",
                        type: { optional: { buffer: { length: 16 } } }
                    }
                ],
                name: "quote",
                access: "read_only",
                outputs: {
                    type: {
                        response: {
                            ok: {
                                tuple: [
                                    { name: "dk", type: "uint128" },
                                    { name: "dx", type: "uint128" },
                                    { name: "dy", type: "uint128" }
                                ]
                            },
                            error: "uint128"
                        }
                    }
                }
            }
        ],
        variables: [],
        clarity_version: "Clarity3",
        fungible_tokens: [],
        non_fungible_tokens: []
    };

    const handleUseDexterityTemplate = () => {
        setJsonInput(JSON.stringify(dexterityTrait, null, 2));
        setQueryName('Dexterity Protocol Search');
    };

    // Format a timestamp as a human-readable date
    const formatDate = (timestamp: number): string => {
        return new Date(timestamp).toLocaleString();
    };

    // Get a display name for a search
    const getSearchDisplayName = (search: SearchResult): string => {
        if (search.queryName) return search.queryName;

        try {
            const parsedQuery = JSON.parse(search.query);
            if (parsedQuery.functions && parsedQuery.functions.length > 0) {
                return `Search for ${parsedQuery.functions.map((f: any) => f.name).join(', ')} function${parsedQuery.functions.length !== 1 ? 's' : ''}`;
            }
        } catch (e) { }

        return `Search from ${formatDate(search.timestamp)}`;
    };

    // Get the appropriate base URL for token-cache based on environment
    const getTokenCacheUrl = (contractId: string): string => {
        const baseUrl = isDevelopment
            ? 'http://localhost:3000'
            : 'https://charisma-token-cache.vercel.app';

        // Just use the search parameter since the token-cache handles it properly now
        return `${baseUrl}/?search=${encodeURIComponent(contractId)}`;
    };

    // Get the appropriate API URL for token-cache based on environment
    const getTokenCacheApiUrl = (contractId: string): string => {
        const baseUrl = isDevelopment
            ? 'http://localhost:3000'
            : 'https://charisma-token-cache.vercel.app';

        return `${baseUrl}/api/v1/sip10/${encodeURIComponent(contractId)}`;
    };

    // Function to batch index all contracts in a search
    const handleBatchIndex = async (searchId: string) => {
        const search = searches.find(s => s.id === searchId);
        if (!search) return;

        const contracts = search.contracts || [];
        if (contracts.length === 0) {
            addStatusMessage('info', 'No contracts to index in this search.');
            return;
        }

        setIndexingSearchId(searchId);
        setIndexingProgress({ total: contracts.length, current: 0, success: 0, failed: 0 });
        const loadingMsgId = addStatusMessage('loading', `Indexing ${contracts.length} contracts in token cache...`, 0);

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < contracts.length; i++) {
            const contract = contracts[i];
            setIndexingProgress(prev => ({ ...prev, current: i + 1 }));

            try {
                // Send a GET request to the token-cache API for each contract
                const response = await fetch(getTokenCacheApiUrl(contract.contract_id));

                if (response.ok) {
                    successCount++;
                    setIndexingProgress(prev => ({ ...prev, success: prev.success + 1 }));
                } else {
                    failedCount++;
                    setIndexingProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
                    console.error(`Failed to index ${contract.contract_id}: ${response.status}`);
                }
            } catch (error) {
                failedCount++;
                setIndexingProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
                console.error(`Error indexing ${contract.contract_id}:`, error);
            }

            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        removeStatusMessage(loadingMsgId);
        addStatusMessage(
            failedCount === 0 ? 'success' : (successCount > 0 ? 'info' : 'error'),
            `Indexing complete: ${successCount} succeeded, ${failedCount} failed${failedCount > 0 ? '. Check console for details.' : ''}`
        );
        setIndexingSearchId(null);
    };

    // Deduplicate contracts in an existing search result
    const deduplicateSearch = (searchId: string) => {
        const loadingMsgId = addStatusMessage('loading', 'Removing duplicates...', 0);

        try {
            setSearches(prevSearches => {
                return prevSearches.map(search => {
                    if (search.id !== searchId) return search;

                    // Find duplicates
                    const contractsMap = new Map<string, ContractData>();
                    let duplicatesFound = 0;

                    search.contracts.forEach(contract => {
                        const existingContract = contractsMap.get(contract.contract_id);

                        if (!existingContract || contract.block_height > existingContract.block_height) {
                            contractsMap.set(contract.contract_id, contract);
                        } else {
                            duplicatesFound++;
                        }
                    });

                    // Only update if we found duplicates
                    if (duplicatesFound > 0) {
                        const dedupedContracts = Array.from(contractsMap.values());
                        dedupedContracts.sort((a, b) => a.block_height - b.block_height);

                        removeStatusMessage(loadingMsgId);
                        addStatusMessage('success', `Removed ${duplicatesFound} duplicate contract${duplicatesFound !== 1 ? 's' : ''}`);

                        return {
                            ...search,
                            contracts: dedupedContracts
                        };
                    }

                    removeStatusMessage(loadingMsgId);
                    addStatusMessage('info', 'No duplicates found');
                    return search;
                });
            });
        } catch (error) {
            removeStatusMessage(loadingMsgId);
            addStatusMessage('error', 'Error removing duplicates');
            console.error('Error deduplicating search:', error);
        }
    };

    return (
        <div className="w-full flex flex-col gap-4">
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

            {/* Search Form */}
            <div className="mb-6 w-full bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-3">Search Contracts by Trait</h2>
                <form onSubmit={handleSearchSubmit} className="w-full">
                    <div className="mb-4">
                        <label
                            htmlFor="queryName"
                            className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Query Name (optional)
                        </label>
                        <input
                            id="queryName"
                            value={queryName}
                            onChange={(e) => setQueryName(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Give your search a name"
                        />
                    </div>

                    <div className="mb-4">
                        <label
                            htmlFor="jsonInput"
                            className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Enter JSON trait definition
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            <button
                                type="button"
                                onClick={handleUseDexterityTemplate}
                                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Use Dexterity Example
                            </button>
                        </div>
                        <textarea
                            ref={jsonInputRef}
                            id="jsonInput"
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            className="w-full h-64 p-4 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder='Enter JSON trait definition, e.g., {"functions": [{"name": "transfer", "access": "public", ...}]}'
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        {isSearching ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Searching...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                Search Contracts
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Saved Searches Section */}
            <div className="mt-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Saved Searches</h2>
                    <button
                        onClick={refreshSearches}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Refresh
                    </button>
                </div>

                {searches.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="text-gray-500 dark:text-gray-400 mb-4">No saved searches yet.</div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Use the search form above to find contracts that match a specific trait.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {searches.map((search) => {
                            const isExpanded = expandedSearches[search.id] || false;
                            const contractCount = search.contracts.length;
                            const isIndexing = indexingSearchId === search.id;
                            const indexingPercentage = isIndexing ? Math.round((indexingProgress.current / indexingProgress.total) * 100) : 0;

                            return (
                                <li key={search.id} className="border rounded-lg dark:border-gray-700 overflow-hidden transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm">
                                    {/* Search Header */}
                                    <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                                        <div
                                            className="flex items-center gap-2 cursor-pointer flex-grow"
                                            onClick={() => toggleExpandSearch(search.id)}
                                        >
                                            <svg
                                                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                            </svg>
                                            <div>
                                                <h3 className="font-medium">{getSearchDisplayName(search)}</h3>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatDate(search.timestamp)} • {contractCount} contract{contractCount !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Deduplicate Button */}
                                            {contractCount > 1 && (
                                                <button
                                                    onClick={() => deduplicateSearch(search.id)}
                                                    className="ml-2 py-1 px-2 text-xs rounded border bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600/70 border-gray-300 dark:border-gray-600 transition-colors flex items-center gap-1"
                                                    title="Remove duplicate contracts"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                    </svg>
                                                    <span>Deduplicate</span>
                                                </button>
                                            )}

                                            {/* Batch Index Button */}
                                            {contractCount > 0 && (
                                                <button
                                                    onClick={() => handleBatchIndex(search.id)}
                                                    disabled={isIndexing}
                                                    className={`ml-2 py-1 px-2 text-xs rounded border ${isIndexing
                                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                                                        : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-300 dark:border-blue-700'} 
                                                        transition-colors flex items-center gap-1`}
                                                    title="Index all contracts as tokens"
                                                >
                                                    {isIndexing ? (
                                                        <>
                                                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                            <span>{indexingProgress.current}/{indexingProgress.total}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                                                            </svg>
                                                            <span>Index All</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            {/* Delete Button */}
                                            {isDevelopment && <button
                                                onClick={() => handleDeleteSearch(search.id)}
                                                className="ml-2 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                                                title="Delete search"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                </svg>
                                            </button>}
                                        </div>
                                    </div>

                                    {/* Indexing Progress Bar */}
                                    {isIndexing && (
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1">
                                            <div
                                                className="bg-blue-500 h-1 transition-all duration-200 ease-in-out"
                                                style={{ width: `${indexingPercentage}%` }}
                                            ></div>
                                        </div>
                                    )}

                                    {/* Contracts List */}
                                    {isExpanded && (
                                        <div className="p-4 animate-fadeDown">
                                            {search.contracts.length === 0 ? (
                                                <div className="text-center p-4 text-gray-500 dark:text-gray-400">
                                                    No contracts found matching this trait.
                                                </div>
                                            ) : (
                                                <ul className="space-y-3">
                                                    {search.contracts.map((contract) => {
                                                        // Create a unique key by combining search ID and contract ID
                                                        const uniqueContractKey = `${search.id}-${contract.contract_id}`;
                                                        const isContractExpanded = expandedContracts[uniqueContractKey] || false;

                                                        return (
                                                            <li key={uniqueContractKey} className="border rounded dark:border-gray-700 overflow-hidden">
                                                                {/* Contract Row */}
                                                                <div
                                                                    className="flex items-center p-3 gap-3 bg-gray-50 dark:bg-gray-800/50"
                                                                    style={{ cursor: 'pointer' }}
                                                                    onClick={() => toggleExpandContract(uniqueContractKey)}
                                                                >
                                                                    {/* Contract Info */}
                                                                    <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-sm min-w-0">
                                                                        <div className="truncate" title={contract.contract_id}>
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="font-medium block">{contract.contract_id.split('.')[1] || 'Unknown'}</span>
                                                                                <svg
                                                                                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${isContractExpanded ? 'rotate-180' : ''}`}
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    viewBox="0 0 24 24"
                                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                                >
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                                                </svg>
                                                                            </div>
                                                                            <p className="text-xs text-gray-500 dark:text-gray-400 break-all" title={contract.contract_id}>{truncateContractId(contract.contract_id, 4, 4)}</p>
                                                                        </div>

                                                                        <div className="text-left">
                                                                            <span className="block text-xs font-medium">Transaction ID</span>
                                                                            <span className="block text-xs text-gray-600 dark:text-gray-400 truncate" title={contract.tx_id}>
                                                                                {contract.tx_id.substring(0, 10)}...
                                                                            </span>
                                                                        </div>

                                                                        <div className="text-left">
                                                                            <span className="block text-xs font-medium">Block Height</span>
                                                                            <span className="block text-xs text-gray-600 dark:text-gray-400">
                                                                                {contract.block_height.toLocaleString()}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Send to Token Cache Button */}
                                                                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                        <a
                                                                            href={getTokenCacheUrl(contract.contract_id)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="p-1.5 rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors inline-flex items-center"
                                                                            title="View as SIP-10 Token"
                                                                        >
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                                                            </svg>
                                                                        </a>
                                                                    </div>
                                                                </div>

                                                                {/* Expanded JSON View */}
                                                                {isContractExpanded && (
                                                                    <div className="border-t dark:border-gray-600 bg-gray-50 dark:bg-gray-900 animate-fadeDown">
                                                                        <pre className="p-4 overflow-auto whitespace-pre-wrap break-words text-xs font-mono">
                                                                            {JSON.stringify(contract, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}

                                            {/* Query Detail */}
                                            <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="text-sm font-medium">Query Used</h4>
                                                </div>
                                                <pre className="p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto whitespace-pre-wrap break-words font-mono">
                                                    {JSON.stringify(JSON.parse(search.query), null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

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