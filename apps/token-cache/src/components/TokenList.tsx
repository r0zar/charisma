'use client';

import { useState, startTransition, useRef, useEffect } from 'react';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { removeTokenFromList, refreshTokenData } from '@/app/actions';
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
    ExternalLink, // Added ExternalLink
    InspectionPanel,
    Pencil
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

interface TokenListProps {
    initialTokens: TokenCacheData[];
    isDevelopment: boolean;
    initialSearchTerm?: string;
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

export default function TokenList({ initialTokens, isDevelopment, initialSearchTerm = '' }: TokenListProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [expandedTokens, setExpandedTokens] = useState<Record<string, boolean>>({});
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [removingTokenId, setRemovingTokenId] = useState<string | null>(null);
    const [refreshingTokenId, setRefreshingTokenId] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchPerformedRef = useRef(false);

    // Effect to handle initialSearchTerm
    useEffect(() => {
        if (initialSearchTerm && !searchPerformedRef.current) {
            setSearchTerm(initialSearchTerm);
            if (looksLikeContractId(initialSearchTerm) &&
                !initialTokens.some(token => token.contractId === initialSearchTerm)) {
                handleLookup(initialSearchTerm);
                searchPerformedRef.current = true;
            }
        }
    }, [initialSearchTerm, initialTokens]);

    // replace this with usestate and useEffect
    const [filteredTokens, setFilteredTokens] = useState<TokenCacheData[]>(initialTokens);
    useEffect(() => {
        setFilteredTokens(initialTokens.filter(
            (token) =>
                token.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                token.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                token.contractId?.toLowerCase().includes(searchTerm.toLowerCase())
        ));
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
                    setFilteredTokens(filteredTokens.filter(token => token.contractId !== contractId));
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

    // Focus search input on page load
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
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
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                    aria-label="Search tokens"
                />
            </div>

            {/* REMOVED: Status Messages Area (Using Toasts now) */}

            {/* Lookup Button for When Search Finds Nothing */}
            {filteredTokens.length === 0 && !isLookingUp && (
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

            {/* Token List */}
            {filteredTokens.length > 0 && (
                <ul className="space-y-3">
                    {filteredTokens.map((token) => {
                        const isExpanded = expandedTokens[token.contractId || ''] || false;
                        const isRemoving = removingTokenId === token.contractId;
                        const isRefreshing = refreshingTokenId === token.contractId;
                        const isLoading = isRemoving || isRefreshing;

                        return (
                            <li key={token.contractId} className={`border rounded-lg overflow-hidden transition-all duration-300 ${isLoading ? 'opacity-70' : ''} ${isExpanded ? 'shadow-md bg-muted/30' : 'bg-card shadow-sm hover:shadow'}`}>
                                {/* Main Row */}
                                <div
                                    className={`flex items-center p-4 gap-4 ${isLoading ? 'cursor-wait' : 'cursor-pointer'}`}
                                    onClick={() => !isLoading && toggleExpand(token.contractId || '')}
                                >
                                    {/* Image */}
                                    <div className="flex-shrink-0">
                                        {token.image ? (
                                            <Image
                                                src={token.image}
                                                alt={`${token.name} logo`}
                                                width={40}
                                                height={40}
                                                className="rounded-md object-cover border bg-background"
                                                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-icon.svg'; }} // Fallback placeholder
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
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
                                            <p className="text-xs text-muted-foreground break-all font-mono" title={token.contractId}>{truncateContractId(token.contractId || '', 4, 4)}</p>
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
                                    <div className="flex-shrink-0 ml-auto flex items-center gap-1">
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
                                            <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded JSON View */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-muted/50 animate-fadeDown">
                                        <ReactJson
                                            src={token}
                                            theme="ocean" // Consider linking to theme state later
                                            iconStyle="square"
                                            displayObjectSize={false}
                                            displayDataTypes={false}
                                            enableClipboard={false}
                                            style={{ padding: '1rem', background: 'transparent' }}
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}