'use client';

import { useState, startTransition, useRef, useEffect } from 'react';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { removeTokenFromList, refreshTokenData, blacklistToken } from '@/app/actions';
import { Input } from "@/components/ui/input"; // Use shadcn Input
import { Button } from "@/components/ui/button"; // Use shadcn Button
import { Card, CardContent } from "@/components/ui/card"; // Added Card import
import { toast } from "sonner";
import {
    Loader2,
    Search,
    RefreshCw,
    Trash2,
    ChevronDown,
    ExternalLink,
    Pencil, // Added ClipboardCopy
    Ban // Added Ban for blacklist
} from 'lucide-react'; // Added icons
import { TokenCacheData } from '@repo/tokens';
import dynamic from 'next/dynamic';
import Link from 'next/link'; // Added Link for navigation

// Dynamically import ReactJson with SSR disabled
const ReactJson = dynamic(() => import('react-json-view'), {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground p-4">Loading JSON viewer...</p>
});

// Helper to check if a string looks like a Stacks contract ID (basic check)
const looksLikeContractId = (id: string): boolean => {
    return id.includes('.') && id.length > 2; // Simple check
};

/**
 * Truncates a contract address for display, keeping the beginning, the end, and the contract name
 */
const truncateContractId = (contractId: string, prefixLength = 4, suffixLength = 4): string => {
    if (!contractId || !looksLikeContractId(contractId)) {
        return contractId || '';
    }
    const parts = contractId.split('.');
    if (parts.length !== 2) return contractId;
    const [address, contractName] = parts;
    if (address.length <= prefixLength + suffixLength + 3) {
        return contractId;
    }
    const prefix = address.substring(0, prefixLength);
    const suffix = address.substring(address.length - suffixLength);
    return `${prefix}...${suffix}.${contractName}`;
};

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    hasPrevious: boolean;
}

interface TokenListProps {
    initialTokens: TokenCacheData[];
    initialPagination?: PaginationInfo;
    initialSearch?: string;
    isDevelopment: boolean;
}

/**
 * Formats the raw total supply using the token's decimals.
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

// Utility to sanitize/normalize image URLs
function sanitizeImageUrl(url?: string): string {
    if (!url) return '/placeholder-icon.svg';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('data:')) return url; // Allow data URIs
    if (url.startsWith('ipfs://')) return 'https://ipfs.io/ipfs/' + url.replace('ipfs://', '');
    // Bare IPFS hash (with or without a slash)
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44,}/.test(url)) return 'https://ipfs.io/ipfs/' + url;
    if (url.startsWith('/')) return url;
    return '/placeholder-icon.svg';
}

export default function TokenList({ 
    initialTokens, 
    initialPagination,
    initialSearch = '',
    isDevelopment 
}: TokenListProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [isSearching, setIsSearching] = useState(false);
    const [expandedTokens, setExpandedTokens] = useState<Record<string, boolean>>({});
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [removingTokenId, setRemovingTokenId] = useState<string | null>(null);
    const [refreshingTokenId, setRefreshingTokenId] = useState<string | null>(null);
    const [blacklistingTokenId, setBlacklistingTokenId] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Use server-provided data directly (no client-side filtering since it's handled server-side)
    const [displayedTokens, setDisplayedTokens] = useState<TokenCacheData[]>(initialTokens);
    const [pagination, setPagination] = useState<PaginationInfo | undefined>(initialPagination);

    // Update displayed tokens when initialTokens change
    useEffect(() => {
        setDisplayedTokens(initialTokens);
        setPagination(initialPagination);
        setIsSearching(false); // Clear searching state when new data arrives
    }, [initialTokens, initialPagination]);

    const toggleExpand = (contractId: string) => {
        setExpandedTokens(prev => ({
            ...prev,
            [contractId]: !prev[contractId]
        }));
    };

    // Handle search with debouncing
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        
        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout for server-side search
        searchTimeoutRef.current = setTimeout(() => {
            setIsSearching(true);
            const params = new URLSearchParams();
            if (value.trim()) {
                params.set('search', value.trim());
            }
            // Reset to page 1 when searching
            params.set('page', '1');
            
            // Navigate to new URL which will trigger server-side re-render
            router.push(`/?${params.toString()}`);
        }, 500); // 500ms debounce
    };

    // Handle pagination navigation
    const handlePageChange = (newPage: number) => {
        if (!pagination || newPage < 1 || newPage > pagination.totalPages) return;
        
        const params = new URLSearchParams();
        params.set('page', newPage.toString());
        if (searchTerm.trim()) {
            params.set('search', searchTerm.trim());
        }
        
        router.push(`/?${params.toString()}`);
    };

    const handleLookup = async (contractId: string) => {
        if (!looksLikeContractId(contractId)) return;

        setIsLookingUp(true);
        const loadingToastId = toast.loading(`Looking up ${truncateContractId(contractId)}...`);

        try {
            const response = await fetch(`/api/v1/sip10/${encodeURIComponent(contractId)}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! Status: ${response.status}`);
            }
            toast.success(`Found ${result.name || truncateContractId(contractId)}. Refresh page to see it in the list.`, { id: loadingToastId });
        } catch (error: any) {
            console.error("Lookup failed:", error);
            toast.error(`Lookup failed: ${error.message || 'Unknown error'}`, { id: loadingToastId });
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleRemove = async (contractId: string) => {
        if (!contractId || !isDevelopment) return;

        setRemovingTokenId(contractId);
        const loadingToastId = toast.loading(`Removing ${truncateContractId(contractId)}...`);

        startTransition(async () => {
            try {
                const result = await removeTokenFromList(contractId);
                if (result.success) {
                    toast.success(`Removed ${truncateContractId(contractId)}. Refresh page to see updated list.`, { id: loadingToastId });
                    router.refresh(); // Re-fetch server data after successful removal
                    // optimistically remove the token from the list
                    setDisplayedTokens(displayedTokens.filter(token => token.contractId !== contractId));
                } else {
                    toast.error(result.error || 'Failed to remove token.', { id: loadingToastId });
                }
            } catch (error: any) {
                toast.error(`Removal failed: ${error.message || 'Unknown error'}`, { id: loadingToastId });
            }
            setRemovingTokenId(null);
        });
    };

    const handleRefresh = async (contractId: string) => {
        if (!contractId) return;

        setRefreshingTokenId(contractId);
        const loadingToastId = toast.loading(`Refreshing ${truncateContractId(contractId)}...`);

        startTransition(async () => {
            try {
                const result = await refreshTokenData(contractId);
                if (result.success) {
                    toast.success(result.message || `Refreshed ${truncateContractId(contractId)}.`, { id: loadingToastId });
                    router.refresh(); // Re-fetch server data after successful refresh
                } else {
                    toast.error(result.error || 'Failed to refresh token.', { id: loadingToastId });
                }
            } catch (error: any) {
                toast.error(`Refresh failed: ${error.message || 'Unknown error'}`, { id: loadingToastId });
            }
            setRefreshingTokenId(null);
        });
    };

    const handleBlacklist = async (contractId: string) => {
        if (!contractId) return;

        setBlacklistingTokenId(contractId);
        const loadingToastId = toast.loading(`Blacklisting ${truncateContractId(contractId)}...`);

        startTransition(async () => {
            try {
                const result = await blacklistToken(contractId);
                if (result.success) {
                    toast.success('message' in result ? result.message : `Blacklisted ${truncateContractId(contractId)}.`, { id: loadingToastId });
                    router.refresh(); // Re-fetch server data after successful blacklist
                    // optimistically remove the token from the list
                    setDisplayedTokens(displayedTokens.filter(token => token.contractId !== contractId));
                } else {
                    toast.error('error' in result ? result.error : 'Failed to blacklist token.', { id: loadingToastId });
                }
            } catch (error: any) {
                toast.error(`Blacklist failed: ${error.message || 'Unknown error'}`, { id: loadingToastId });
            }
            setBlacklistingTokenId(null);
        });
    };

    // Focus search input on page load
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="w-full flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={searchInputRef}
                    type="search"
                    placeholder="Search by name, symbol, or contract ID..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 w-full"
                    aria-label="Search tokens"
                />
            </div>

            {/* REMOVED: Status Messages Area (Using Toasts now) */}

            {/* Pagination Controls - Top */}
            {pagination && pagination.totalPages > 1 && !isSearching && (
                <div className="flex items-center justify-between py-4 border-b">
                    <div className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages} 
                        ({pagination.total} total tokens{searchTerm && ` matching "${searchTerm}"`})
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={!pagination.hasPrevious}
                        >
                            Previous
                        </Button>
                        <div className="flex items-center gap-1">
                            {/* Show page numbers around current page */}
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                let pageNum;
                                if (pagination.totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (pagination.page <= 3) {
                                    pageNum = i + 1;
                                } else if (pagination.page >= pagination.totalPages - 2) {
                                    pageNum = pagination.totalPages - 4 + i;
                                } else {
                                    pageNum = pagination.page - 2 + i;
                                }
                                
                                return (
                                    <Button
                                        key={pageNum}
                                        variant={pageNum === pagination.page ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handlePageChange(pageNum)}
                                        className="w-8 h-8 p-0"
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={!pagination.hasMore}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {/* Lookup Button for When Search Finds Nothing */}
            {displayedTokens.length === 0 && !isLookingUp && !isSearching && (
                <Card className="text-center py-8">
                    <CardContent>
                        <p className="text-muted-foreground mb-4">No tokens match your search.</p>
                        {searchTerm && looksLikeContractId(searchTerm) && (
                            <Button
                                onClick={() => handleLookup(searchTerm)}
                                disabled={isLookingUp}
                                variant="default"
                            >
                                <Search className="mr-2 h-4 w-4" />
                                Lookup '{truncateContractId(searchTerm)}'
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Loading state for search */}
            {isSearching && (
                <Card className="text-center py-8">
                    <CardContent>
                        <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-muted-foreground">Searching...</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Token List */}
            {displayedTokens.length > 0 && !isSearching && (
                <>
                    <ul className="space-y-3">
                        {displayedTokens.map((token) => {
                        const isExpanded = expandedTokens[token.contractId || ''] || false;
                        const isRemoving = removingTokenId === token.contractId;
                        const isRefreshing = refreshingTokenId === token.contractId;
                        const isBlacklisting = blacklistingTokenId === token.contractId;
                        const isLoading = isRemoving || isRefreshing || isBlacklisting;

                        return (
                            <li key={token.contractId} className={`border rounded-lg overflow-hidden transition-all duration-300 ${isLoading ? 'opacity-70' : ''} ${isExpanded ? 'shadow-md bg-muted/30 scale-[1.01]' : 'bg-card shadow-sm hover:shadow hover:scale-[1.005]'}`}>
                                {/* Main Row */}
                                <div
                                    className={`flex items-center p-4 gap-4 transition-all duration-200 ${isLoading ? 'cursor-wait' : 'cursor-pointer hover:bg-muted/20'} ${isExpanded ? 'bg-muted/10' : ''}`}
                                    onClick={() => !isLoading && toggleExpand(token.contractId || '')}
                                >
                                    {/* Image */}
                                    <div className="flex-shrink-0">
                                        {token.image ? (
                                            <Image
                                                src={sanitizeImageUrl(token.image)}
                                                alt={`${token.name} logo`}
                                                width={40}
                                                height={40}
                                                className={`rounded-md object-cover border bg-background transition-all duration-300 ${isExpanded ? 'ring-2 ring-primary/30 scale-110' : 'hover:scale-105'}`}
                                                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-icon.svg'; }} // Fallback placeholder
                                            />
                                        ) : (
                                            <div className={`w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground transition-all duration-300 ${isExpanded ? 'ring-2 ring-primary/30 scale-110' : 'hover:scale-105'}`}>
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Columns */}
                                    <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-1 text-sm min-w-0">
                                        <div className="truncate md:col-span-1" title={token.name}>
                                            <div className="flex items-center gap-1">
                                                <span className="font-semibold text-base block text-foreground">{token.name || '(No Name)'}</span>
                                                <span className="text-muted-foreground">({token.symbol || '?'})</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <p
                                                    className="text-sm text-muted-foreground break-all font-mono cursor-pointer hover:text-foreground transition-colors"
                                                    title={`Click to copy: ${token.contractId}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (token.contractId) {
                                                            navigator.clipboard.writeText(token.contractId)
                                                                .then(() => {
                                                                    toast.success("Copied to clipboard", { description: truncateContractId(token.contractId, 8, 8) });
                                                                })
                                                                .catch(err => {
                                                                    console.error('Failed to copy: ', err);
                                                                    toast.error("Failed to copy", { description: "Could not copy contract ID." });
                                                                });
                                                        }
                                                    }}
                                                >
                                                    {truncateContractId(token.contractId || '', 4, 4)}
                                                </p>
                                                {token.contractId && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.open(`https://explorer.hiro.so/txid/${token.contractId}?chain=mainnet`, '_blank');
                                                        }}
                                                        disabled={isLoading} // Keep disabled state if parent is loading
                                                        aria-label={`View ${token.symbol} on Explorer`}
                                                        title="View on Explorer"
                                                        className="h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-50" // Adjusted size and styling
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 overflow-hidden text-muted-foreground" title={token.description || ''}>
                                            <p className="line-clamp-2">
                                                {token.description || '-'}
                                            </p>
                                        </div>
                                        <div className="text-left md:text-right">
                                            <span className="block font-medium text-foreground">Total Supply</span>
                                            <span className="block text-muted-foreground">
                                                {formatSupplyWithDecimals(token.total_supply, token.decimals)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className={`flex-shrink-0 ml-auto flex items-center gap-1 transition-all duration-300 ${isExpanded ? 'scale-105' : ''}`}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => { e.stopPropagation(); handleRefresh(token.contractId || ''); }}
                                            disabled={isLoading}
                                            aria-label={`Refresh ${token.symbol}`}
                                            title="Refresh Token Data"
                                            className="text-primary hover:bg-primary/10 disabled:opacity-50"
                                        >
                                            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        </Button>
                                        {isDevelopment && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => { e.stopPropagation(); handleBlacklist(token.contractId || ''); }}
                                                disabled={isLoading}
                                                aria-label={`Blacklist ${token.symbol}`}
                                                title="Add to Blacklist (Dev Only)"
                                                className="text-orange-600 hover:bg-orange-600/10 disabled:opacity-50"
                                            >
                                                {isBlacklisting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                            </Button>
                                        )}
                                        {isDevelopment && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => { e.stopPropagation(); handleRemove(token.contractId || ''); }}
                                                disabled={isLoading}
                                                aria-label={`Remove ${token.symbol}`}
                                                title="Remove (Dev Only)"
                                                className="text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                            >
                                                {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        )}
                                        {/* Inspect Link Icon */}
                                        {token.contractId && (
                                            <Link href={`/inspect?tokenId=${encodeURIComponent(token.contractId)}`} >
                                                <div
                                                    title={`Inspect ${token.name || token.contractId}`}
                                                    className="inline-flex items-center justify-center h-9 w-9 rounded-md text-primary hover:bg-primary/10 disabled:opacity-50"
                                                    onClick={(e) => e.stopPropagation()} // Prevent card from toggling
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </div>
                                            </Link>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                            className="text-muted-foreground hover:bg-accent"
                                        // onClick={(e) => { e.stopPropagation(); toggleExpand(token.contractId || ''); }} // Already handled by parent div click
                                        >
                                            <ChevronDown className={`h-4 w-4 transform transition-all duration-300 ease-out ${isExpanded ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded JSON View */}
                                <div className={`border-t border-border bg-muted/50 transition-height ${
                                    isExpanded ? 'expanded' : 'collapsed'
                                }`}>
                                    {isExpanded && (
                                        <div className="p-4 animate-appear">
                                            <ReactJson
                                                src={token}
                                                theme="ocean" // Consider linking to theme state later
                                                iconStyle="square"
                                                displayObjectSize={false}
                                                displayDataTypes={false}
                                                enableClipboard={false}
                                                style={{ background: 'transparent' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
                
                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Page {pagination.page} of {pagination.totalPages} 
                            ({pagination.total} total tokens{searchTerm && ` matching "${searchTerm}"`})
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={!pagination.hasPrevious}
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {/* Show page numbers around current page */}
                                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (pagination.totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (pagination.page <= 3) {
                                        pageNum = i + 1;
                                    } else if (pagination.page >= pagination.totalPages - 2) {
                                        pageNum = pagination.totalPages - 4 + i;
                                    } else {
                                        pageNum = pagination.page - 2 + i;
                                    }
                                    
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={pageNum === pagination.page ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum)}
                                            className="w-8 h-8 p-0"
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={!pagination.hasMore}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
}