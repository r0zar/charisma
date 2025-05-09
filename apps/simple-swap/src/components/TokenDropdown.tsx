import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { type Token } from "../lib/swap-client";
import TokenLogo from "./TokenLogo";

// Shared styles
const fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
const textStyles = {
    fontFamily,
    label: { fontSize: 12, fontWeight: 500, color: "#6b7280" },
    tokenSymbol: { fontSize: 14, fontWeight: 600, lineHeight: 1.2 },
    tokenName: { fontSize: 12, fontWeight: 400, color: "#6b7280", lineHeight: 1.2 },
};

interface TokenDropdownProps {
    tokens: Token[];
    selected?: Token | null;
    onSelect: (t: Token) => void;
    label?: string;
}

export default function TokenDropdown({ tokens, selected, onSelect, label }: TokenDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);
    const [isMounted, setIsMounted] = useState(false);

    // Handle client-side only rendering for the portal
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const filtered = useMemo(() => {
        if (!search) return tokens;
        const q = search.toLowerCase();
        return tokens.filter(
            (t) => t.symbol?.toLowerCase()?.includes(q) || t.name?.toLowerCase()?.includes(q) || t.contractId?.toLowerCase()?.includes(q)
        );
    }, [tokens, search]);

    const handleSelectToken = (token: Token, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the click from bubbling up
        e.preventDefault();
        onSelect(token);
        setOpen(false);
        setSearch("");
    };

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Check if the click is outside both the dropdown trigger and the portal content
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                portalRef.current &&
                !portalRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        function updatePosition() {
            if (dropdownRef.current) {
                const rect = dropdownRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + window.scrollY + 8,
                    left: rect.left + window.scrollX,
                    width: Math.max(rect.width, 280)
                });
            }
        }

        if (open) {
            // Add event listeners when dropdown is open
            document.addEventListener("mousedown", handleClickOutside);
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            // Calculate initial position
            updatePosition();
        }

        return () => {
            // Clean up event listeners
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [open]);

    const dropdownMenu = open && isMounted ? (
        createPortal(
            <div
                ref={portalRef}
                className="glass-card py-2 fixed z-[9999]"
                style={{
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                    width: `${position.width}px`,
                    maxHeight: '320px',
                }}
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
            >
                <div className="px-3 py-2">
                    <div className="relative">
                        <input
                            placeholder="Search tokens"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-dark-300/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <svg className="absolute right-3 top-2.5 h-4 w-4 text-dark-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                <div className="mt-2 max-h-[240px] overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-center text-dark-500 text-sm">No tokens found</div>
                    ) : (
                        filtered.map((token) => (
                            <div
                                key={token.contractId}
                                onClick={(e) => handleSelectToken(token, e)}
                                className={`px-3 py-2 flex items-center space-x-3 hover:bg-dark-300/30 cursor-pointer transition-colors ${selected?.contractId === token.contractId ? "bg-dark-300/50" : ""
                                    }`}
                            >
                                <TokenLogo token={token} size="sm" />
                                <div>
                                    <div className="font-medium">{token.symbol}</div>
                                    <div className="text-xs text-dark-500">{token.name}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>,
            document.body
        )
    ) : null;

    return (
        <div ref={dropdownRef} className="relative w-full">
            {label && <label className="text-dark-600 text-xs font-medium mb-1 block">{label}</label>}

            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="token-select w-full justify-between text-left"
            >
                {selected ? (
                    <div className="flex items-center space-x-2">
                        <TokenLogo token={selected} size="sm" />
                        <span className="font-medium">{selected.symbol}</span>
                    </div>
                ) : (
                    <span className="text-dark-500">Select token</span>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {dropdownMenu}
        </div>
    );
} 