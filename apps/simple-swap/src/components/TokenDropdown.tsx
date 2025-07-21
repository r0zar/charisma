import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import TokenLogo from "./TokenLogo";
import { TokenCacheData } from "@/lib/contract-registry-adapter";
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { ChevronDown, Search, X, ArrowLeft } from 'lucide-react';

interface TokenDropdownProps {
    tokens: TokenCacheData[];
    selected?: TokenCacheData | null;
    onSelect: (t: TokenCacheData) => void;
    label?: string;
    suppressFlame?: boolean;
    showBalances?: boolean;
    forceOpen?: boolean;
    onForceOpenChange?: (open: boolean) => void;
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
}: TokenDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [mounted, setMounted] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Get balance data for enhanced display
    const { address } = useWallet();
    const { getTokenBalance, getSubnetBalance } = useBalances(address ? [address] : []);
    const { getTokenDecimals } = useTokenMetadata();

    /* ---------------- helpers ---------------- */
    const filtered = useMemo(() => {
        if (!search) return tokens;
        const q = search.toLowerCase();
        return tokens.filter(
            (t) =>
                t.symbol?.toLowerCase().includes(q) ||
                t.name?.toLowerCase().includes(q) ||
                t.contractId?.toLowerCase().includes(q)
        );
    }, [tokens, search]);

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
                    className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-xl"
                    onClick={close}
                >
                    {/* Multi-layer Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-transparent to-purple-500/[0.03]" />
                    
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
                                        className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.15] text-white/70 hover:text-white/90 hover:bg-white/[0.12] transition-all duration-200 flex items-center justify-center backdrop-blur-sm"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <div>
                                        <h2 className="text-lg sm:text-xl font-semibold text-white/95">Select Token</h2>
                                        <p className="text-xs sm:text-sm text-white/60 mt-1">Choose from {tokens.length} available tokens</p>
                                    </div>
                                </div>
                                <button
                                    onClick={close}
                                    className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.15] text-white/70 hover:text-white/90 hover:bg-white/[0.12] transition-all duration-200 flex items-center justify-center backdrop-blur-sm lg:hidden"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {/* Premium Search */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                                <input
                                    ref={searchInputRef}
                                    placeholder="Search by name, symbol, or address..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white/[0.08] border border-white/[0.15] rounded-2xl text-white/95 placeholder:text-white/50 focus:outline-none focus:bg-white/[0.12] focus:border-white/[0.25] transition-all duration-200 text-base backdrop-blur-sm"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 h-6 w-6 rounded-full bg-white/[0.1] text-white/60 hover:text-white/80 hover:bg-white/[0.15] transition-all duration-200 flex items-center justify-center"
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
                                    <div className="h-16 w-16 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center mb-4">
                                        <Search className="w-6 h-6 text-white/40" />
                                    </div>
                                    <div className="text-white/60 text-lg font-medium">No tokens found</div>
                                    <div className="text-white/40 text-sm mt-2">Try adjusting your search terms</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                    {filtered.map((token) => (
                                        <div
                                            key={token.contractId}
                                            onClick={() => handleSelect(token)}
                                            className={`group relative cursor-pointer rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-200 border backdrop-blur-sm ${
                                                selected?.contractId === token.contractId
                                                    ? "bg-white/[0.12] border-white/[0.2] shadow-lg"
                                                    : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] hover:shadow-lg"
                                            }`}
                                        >
                                            {/* Selection Glow Effect */}
                                            {selected?.contractId === token.contractId && (
                                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/[0.1] to-purple-500/[0.1] pointer-events-none" />
                                            )}
                                            
                                            <div className="relative flex items-center justify-between gap-2">
                                                <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                                                    {/* Token Logo */}
                                                    <div className="relative flex-shrink-0">
                                                        <TokenLogo token={token} size="lg" suppressFlame={suppressFlame} />
                                                        {token.type === 'SUBNET' && (
                                                            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-purple-500 rounded-full border-2 border-white/20 flex items-center justify-center">
                                                                <div className="h-1.5 w-1.5 bg-white rounded-full" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Token Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-3 mb-1">
                                                            <h3 className="font-semibold text-white/95 text-sm sm:text-base">{token.symbol}</h3>
                                                            {token.type === 'SUBNET' && (
                                                                <div className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-md font-medium border border-purple-500/30">
                                                                    SUBNET
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-white/60 truncate">{token.name}</p>
                                                        <p className="text-xs text-white/40 truncate font-mono mt-1 hidden sm:block">{token.contractId}</p>
                                                    </div>
                                                </div>
                                                
                                                {/* Balance Info */}
                                                {showBalances && address && (
                                                    <div className="text-right flex-shrink-0 ml-2 sm:ml-4">
                                                        {(() => {
                                                            const mainnetBalance = getTokenBalance(address, token.contractId);
                                                            const subnetBalance = getSubnetBalance(address, token.contractId);
                                                            const decimals = getTokenDecimals(token.contractId);
                                                            const displayDecimals = Math.min(decimals, 8);
                                                            const formattedMainnet = mainnetBalance > 0 ? mainnetBalance.toFixed(displayDecimals) : '0';
                                                            const formattedSubnet = subnetBalance > 0 ? subnetBalance.toFixed(displayDecimals) : '0';
                                                            
                                                            return (
                                                                <>
                                                                    <div className="text-sm sm:text-base font-semibold text-white/90">
                                                                        {formattedMainnet}
                                                                    </div>
                                                                    {subnetBalance > 0 && (
                                                                        <div className="text-xs sm:text-sm text-purple-400 font-medium">
                                                                            +{formattedSubnet} subnet
                                                                        </div>
                                                                    )}
                                                                    <div className="text-xs text-white/50 mt-1">
                                                                        {subnetBalance > 0 ? 'Mainnet' : 'Balance'}
                                                                    </div>
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
                <label className="mb-2 block text-xs font-medium text-white/70">
                    {label}
                </label>
            )}

            {/* Premium Token Selector Button */}
            <button
                type="button"
                onClick={() => { setOpen(true); if (onForceOpenChange) onForceOpenChange(false); }}
                className="group relative w-full flex items-center justify-between p-3 bg-transparent hover:bg-white/[0.03] border-none cursor-pointer transition-all duration-200 rounded-xl"
            >
                {selected ? (
                    <div className="flex items-center space-x-3 flex-1">
                        <div className="relative">
                            <TokenLogo token={selected} size="sm" suppressFlame={suppressFlame} />
                            {selected.type === 'SUBNET' && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-purple-500 rounded-full border border-white/20" />
                            )}
                        </div>
                        <div className="text-left">
                            <div className="font-semibold text-white/95 text-sm">{selected.symbol}</div>
                            <div className="text-xs text-white/60">{selected.name}</div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center space-x-3 flex-1">
                        <div className="h-8 w-8 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center">
                            <span className="text-white/50 text-xs">?</span>
                        </div>
                        <div className="text-left">
                            <div className="text-white/60 text-sm">Select token</div>
                            <div className="text-white/40 text-xs">Choose from list</div>
                        </div>
                    </div>
                )}
                
                <ChevronDown className="w-4 h-4 text-white/60 group-hover:text-white/80 transition-all duration-200" />
            </button>

            {modal}
        </div>
    );
}