import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import TokenLogo from "./TokenLogo";
import { TokenCacheData } from "@/lib/contract-registry-adapter";
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { useTokenPrices } from '@/contexts/token-price-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { ChevronDown, Search, X, ArrowLeft } from 'lucide-react';
import { rowBlazeVersion } from '@/lib/subnet-pairs';

interface TokenDropdownProps {
    tokens: TokenCacheData[];
    selected?: TokenCacheData | null;
    onSelect: (t: TokenCacheData) => void;
    label?: string;
    suppressFlame?: boolean;
    showBalances?: boolean;
    forceOpen?: boolean;
    onForceOpenChange?: (open: boolean) => void;
    /** Prepend the synthetic STX row when it isn't already in `tokens`. Default true. */
    includeStx?: boolean;
    /** 'subnet' shows only the subnet balance/value, for flows that only spend subnet funds. Default 'combined'. */
    balanceMode?: 'combined' | 'subnet';
}

export default function TokenDropdown({
    tokens,
    selected,
    onSelect,
    label,
    suppressFlame = false,
    showBalances = false,
    forceOpen = false,
    onForceOpenChange,
    includeStx = true,
    balanceMode = 'combined',
}: TokenDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [mounted, setMounted] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Get balance data for enhanced display
    const { address } = useWallet();
    
    const { getFormattedBalanceWithSubnet, getFormattedSubnetBalance, getTokenBalance, getStxBalance, balances, isLoading, error } = useBalances(address ? [address] : []);
    const { prices } = useTokenPrices();
    const { getTokenDecimals } = useTokenMetadata();
    const { getSubnetContractId } = useSubnetTokens();

    /* ---------------- helpers ---------------- */
    
    // Calculate USD value for a token (mainnet + subnet, or subnet-only in 'subnet' mode)
    const calculateTokenUSDValue = (token: TokenCacheData): number => {
        if (!address || !showBalances) return 0;

        // Special price lookup for STX
        let price = prices[token.contractId] || 0;
        if (token.contractId === 'STX' && price === 0) {
            price = prices['.stx'] || 0; // STX prices are stored under '.stx' key
        }

        if (price === 0) return 0;

        // Special handling for STX
        if (['stx', '.stx'].includes(token.contractId.toLowerCase())) {
            if (balanceMode === 'subnet') return 0;
            const stxBalance = getStxBalance(address);
            return stxBalance * price;
        }

        // Use raw balances and convert to decimal-adjusted values for USD calculation
        const rawMainnetBalance = getTokenBalance(address, token.contractId);

        // Get subnet balance if applicable
        let rawSubnetBalance = 0;
        const subnetContractId = getSubnetContractId(token.contractId);
        if (subnetContractId) {
            rawSubnetBalance = getTokenBalance(address, subnetContractId);
        }

        // Convert raw balances to decimal-adjusted values
        const decimals = getTokenDecimals(token.contractId) || 6;
        const mainnetValue = rawMainnetBalance / Math.pow(10, decimals);
        const subnetValue = rawSubnetBalance / Math.pow(10, decimals);
        const totalBalance = balanceMode === 'subnet' ? subnetValue : mainnetValue + subnetValue;

        return totalBalance * price;
    };

    const filtered = useMemo(() => {
        // Add STX as a synthetic token if not already present
        const hasSTX = tokens.some(t => ['stx', '.stx'].includes(t.contractId.toLowerCase()));
        let result = tokens;

        if (includeStx && !hasSTX) {
            const stxToken: TokenCacheData = {
                type: 'token',
                contractId: 'STX',
                name: 'Stacks',
                description: 'Native STX token',
                image: 'https://assets.coingecko.com/coins/images/2069/standard/Stacks_logo_full.png',
                lastUpdated: Date.now(),
                decimals: 6,
                symbol: 'STX',
                token_uri: null,
                identifier: 'stx',
                total_supply: null,
                tokenAContract: null,
                tokenBContract: null,
                lpRebatePercent: null,
                externalPoolId: null,
                engineContractId: null,
                base: null,
                usdPrice: null,
                confidence: null,
                marketPrice: null,
                intrinsicValue: null,
                totalLiquidity: null
            };
            result = [stxToken, ...tokens];
        }
        
        // Filter by search term
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (t) =>
                    t.symbol?.toLowerCase().includes(q) ||
                    t.name?.toLowerCase().includes(q) ||
                    t.contractId?.toLowerCase().includes(q)
            );
        }
        
        // Sort by USD value if showing balances, otherwise by symbol
        if (showBalances && address) {
            result = [...result].sort((a, b) => {
                const aValue = calculateTokenUSDValue(a);
                const bValue = calculateTokenUSDValue(b);
                
                // Sort by USD value (highest first), then by symbol for ties
                if (bValue !== aValue) {
                    return bValue - aValue;
                }
                return (a.symbol || '').localeCompare(b.symbol || '');
            });
        } else {
            // Default sort by symbol
            result = [...result].sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
        }
        
        return result;
    }, [tokens, search, showBalances, address, includeStx, balanceMode, getFormattedBalanceWithSubnet, getTokenBalance, getStxBalance, getTokenDecimals, getSubnetContractId, prices]);

    const close = () => {
        setOpen(false);
        setSearch("");
        if (onForceOpenChange) {
            onForceOpenChange(false);
        }
    };

    const handleSelect = (token: TokenCacheData) => {
        onSelect(token);
        close();
    };

    /* ---------------- effects ---------------- */
    useEffect(() => setMounted(true), []);

    // Handle forceOpen prop
    useEffect(() => {
        if (forceOpen && !open) {
            setOpen(true);
        }
    }, [forceOpen, open]);

    // Focus search input when modal opens
    useEffect(() => {
        if (open && searchInputRef.current) {
            // Small delay to ensure the modal is fully rendered
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) {
                close();
            }
        };
        
        if (open) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [open]);

    /* ---------------- Full Screen Modal ---------------- */
    const modal =
        open && mounted
            ? createPortal(
                <div 
                    className="fixed inset-0 z-[9999] flex flex-col bg-bg/90 backdrop-blur-xl"
                    onClick={close}
                >
                    {/* Multi-layer Background Effects */}
                    
                    {/* Modal Content */}
                    <div 
                        className="relative flex flex-col h-full max-w-2xl mx-auto w-full px-4 sm:px-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 p-4 sm:p-6 pb-4">
                            <div className="flex items-center justify-between mb-4 sm:mb-6">
                                <div className="flex items-center space-x-3 sm:space-x-4">
                                    <button
                                        onClick={close}
                                        className="h-10 w-10 rounded-xl bg-surface-hover border border-line-strong text-ink-body hover:text-ink hover:bg-surface-selected transition-all duration-200 flex items-center justify-center backdrop-blur-sm"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <div>
                                        <h2 className="text-lg sm:text-xl font-semibold text-ink">Select Token</h2>
                                        <p className="text-xs sm:text-sm text-ink-muted mt-1">Choose from {tokens.length} available tokens</p>
                                    </div>
                                </div>
                                <button
                                    onClick={close}
                                    className="h-10 w-10 rounded-xl bg-surface-hover border border-line-strong text-ink-body hover:text-ink hover:bg-surface-selected transition-all duration-200 flex items-center justify-center backdrop-blur-sm lg:hidden"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {/* Premium Search */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-muted" />
                                <input
                                    ref={searchInputRef}
                                    placeholder="Search by name, symbol, or address..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-surface-hover border border-line-strong rounded-2xl text-ink placeholder:text-ink-muted focus:outline-none focus:bg-surface-selected focus:border-line-strong transition-all duration-200 text-base backdrop-blur-sm"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 h-6 w-6 rounded-full bg-surface-hover text-ink-muted hover:text-ink-body hover:bg-surface-selected transition-all duration-200 flex items-center justify-center"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Token Grid */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64">
                                    <div className="h-16 w-16 rounded-2xl bg-surface border border-line flex items-center justify-center mb-4">
                                        <Search className="w-6 h-6 text-ink-muted" />
                                    </div>
                                    <div className="text-ink-muted text-lg font-medium">No tokens found</div>
                                    <div className="text-ink-muted text-sm mt-2">Try adjusting your search terms</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                    {filtered.map((token) => (
                                        <div
                                            key={token.contractId}
                                            onClick={() => handleSelect(token)}
                                            className={`group relative cursor-pointer rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-200 border backdrop-blur-sm ${
                                                selected?.contractId === token.contractId
                                                    ? "bg-surface-selected border-accent-line shadow-lg"
                                                    : "bg-surface border-line hover:bg-surface-hover hover:border-line-strong hover:shadow-lg"
                                            }`}
                                        >
                                            
                                            <div className="relative flex items-center justify-between gap-2">
                                                <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                                                    {/* Token Logo */}
                                                    <div className="relative flex-shrink-0">
                                                        <TokenLogo token={token} size="lg" suppressFlame={suppressFlame} blazeVersion={rowBlazeVersion(token.contractId)} />
                                                        {token.type === 'SUBNET' && (
                                                            <div className={`absolute -bottom-1 -right-1 h-4 w-4 ${rowBlazeVersion(token.contractId) === 2 ? 'bg-blaze-v2' : 'bg-blaze'} rounded-full border-2 border-line-strong flex items-center justify-center`}>
                                                                <div className="h-1.5 w-1.5 bg-ink rounded-full" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Token Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-3 mb-1">
                                                            <h3 className="font-semibold text-ink text-sm sm:text-base">{token.symbol}</h3>
                                                            {token.type === 'SUBNET' && (
                                                                <div className="px-2 py-1 bg-blaze/20 text-blaze text-xs rounded-md font-medium border border-blaze/30">
                                                                    SUBNET
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-ink-muted truncate">{token.name}</p>
                                                        <p className="text-xs text-ink-muted truncate font-mono mt-1 hidden sm:block">{token.contractId}</p>
                                                    </div>
                                                </div>
                                                
                                                {/* Balance Info */}
                                                {showBalances && address && (
                                                    <div className="text-right flex-shrink-0 ml-2 sm:ml-4">
                                                        {(() => {
                                                            // Use the new function that automatically handles subnet/mainnet lookup
                                                            const { mainnet, subnet, hasSubnet } = getFormattedBalanceWithSubnet(address, token.contractId);
                                                            const usdValue = calculateTokenUSDValue(token);
                                                            
                                                            
                                                            if (balanceMode === 'subnet') {
                                                                // Same lookup path as calculateTokenUSDValue/the funded-token filter:
                                                                // pairings map, not the base-scan getFormattedBalanceWithSubnet does.
                                                                const subnetId = getSubnetContractId(token.contractId);
                                                                const subnetBalance = subnetId ? getFormattedSubnetBalance(address, subnetId) : '0';
                                                                return (
                                                                    <>
                                                                        {/* USD Value */}
                                                                        {usdValue > 0 && (
                                                                            <div className="text-sm sm:text-base font-bold text-success mb-1">
                                                                                ${usdValue >= 1000000
                                                                                    ? `${(usdValue / 1000000).toFixed(2)}M`
                                                                                    : usdValue >= 1000
                                                                                        ? `${(usdValue / 1000).toFixed(2)}K`
                                                                                        : usdValue.toFixed(2)
                                                                                }
                                                                            </div>
                                                                        )}

                                                                        {/* Subnet Balance (primary in subnet mode) */}
                                                                        <div className="text-sm sm:text-base font-semibold text-ink">
                                                                            {subnetBalance || '0'}
                                                                        </div>
                                                                        <div className="text-xs text-ink-muted">
                                                                            on subnet
                                                                        </div>
                                                                    </>
                                                                );
                                                            }

                                                            return (
                                                                <>
                                                                    {/* USD Value */}
                                                                    {usdValue > 0 && (
                                                                        <div className="text-sm sm:text-base font-bold text-success mb-1">
                                                                            ${usdValue >= 1000000
                                                                                ? `${(usdValue / 1000000).toFixed(2)}M`
                                                                                : usdValue >= 1000
                                                                                    ? `${(usdValue / 1000).toFixed(2)}K`
                                                                                    : usdValue.toFixed(2)
                                                                            }
                                                                        </div>
                                                                    )}

                                                                    {/* Token Balance */}
                                                                    <div className="text-sm sm:text-base font-semibold text-ink">
                                                                        {mainnet || '0'}
                                                                    </div>
                                                                    {hasSubnet && (
                                                                        <div className="text-xs sm:text-sm text-blaze font-medium">
                                                                            +{subnet}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )
            : null;

    return (
        <div className="relative w-full">
            {label && (
                <label className="mb-2 block text-xs font-medium text-ink-body">
                    {label}
                </label>
            )}

            {/* Premium Token Selector Button */}
            <button
                type="button"
                onClick={() => { setOpen(true); if (onForceOpenChange) onForceOpenChange(false); }}
                className="group relative w-full flex items-center justify-between p-3 bg-transparent hover:bg-surface border-none cursor-pointer transition-all duration-200 rounded-xl"
            >
                {selected ? (
                    <div className="flex items-center space-x-3 flex-1">
                        <div className="relative">
                            <TokenLogo token={selected} size="sm" suppressFlame={suppressFlame} blazeVersion={rowBlazeVersion(selected.contractId)} />
                            {selected.type === 'SUBNET' && (
                                <div className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 ${rowBlazeVersion(selected.contractId) === 2 ? 'bg-blaze-v2' : 'bg-blaze'} rounded-full border border-line-strong`} />
                            )}
                        </div>
                        <div className="text-left">
                            <div className="font-semibold text-ink text-sm">{selected.symbol}</div>
                            <div className="text-xs text-ink-muted">{selected.name}</div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center space-x-3 flex-1">
                        <div className="h-8 w-8 rounded-full bg-surface border border-line flex items-center justify-center">
                            <span className="text-ink-muted text-xs">?</span>
                        </div>
                        <div className="text-left">
                            <div className="text-ink-muted text-sm">Select token</div>
                            <div className="text-ink-muted text-xs">Choose from list</div>
                        </div>
                    </div>
                )}
                
                <ChevronDown className="w-4 h-4 text-ink-muted group-hover:text-ink-body transition-all duration-200" />
            </button>

            {modal}
        </div>
    );
}