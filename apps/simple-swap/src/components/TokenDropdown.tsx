import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { type Token } from "../lib/_swap-client";
import TokenLogo from "./TokenLogo";

interface TokenDropdownProps {
    tokens: Token[];
    selected?: Token | null;
    onSelect: (t: Token) => void;
    label?: string;
}

export default function TokenDropdown({
    tokens,
    selected,
    onSelect,
    label,
}: TokenDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

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
    };

    const updatePosition = () => {
        if (!dropdownRef.current) return;
        const rect = dropdownRef.current.getBoundingClientRect();
        setPos({
            top: rect.bottom + 8, // only viewport-relative values
            left: rect.left,
            width: Math.max(rect.width, 280),
        });
    };

    /* ---------------- effects ---------------- */
    useEffect(() => setMounted(true), []);

    // recalc on open + window resize / scroll
    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
        const handleOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current?.contains(e.target as Node) ||
                portalRef.current?.contains(e.target as Node)
            )
                return;
            close();
        };
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        document.addEventListener("mousedown", handleOutside);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
            document.removeEventListener("mousedown", handleOutside);
        };
    }, [open]);

    /* ---------------- render ---------------- */
    const menu =
        open && mounted
            ? createPortal(
                <div
                    ref={portalRef}
                    className="glass-card fixed z-[9999] py-2"
                    style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 320 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* search */}
                    <div className="px-3 py-2">
                        <div className="relative">
                            <input
                                placeholder="Search tokens"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full rounded-lg bg-dark-300/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <svg
                                className="absolute right-3 top-2.5 h-4 w-4 text-dark-500"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* list */}
                    <div className="mt-2 max-h-[240px] overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-center text-sm text-dark-500">
                                No tokens found
                            </div>
                        ) : (
                            filtered.map((token) => (
                                <div
                                    key={token.contractId}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelect(token);
                                        close();
                                    }}
                                    className={`flex cursor-pointer items-center space-x-3 px-3 py-2 transition-colors hover:bg-dark-300/30 ${selected?.contractId === token.contractId
                                        ? "bg-dark-300/50"
                                        : ""
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
            : null;

    return (
        <div ref={dropdownRef} className="relative w-full">
            {label && (
                <label className="mb-1 block text-xs font-medium text-dark-600">
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="token-select flex w-full items-center justify-between text-left"
            >
                {selected ? (
                    <div className="flex items-center space-x-2">
                        <TokenLogo token={selected} size="sm" />
                        <span className="font-medium">{selected.symbol}</span>
                    </div>
                ) : (
                    <span className="text-dark-500">Select token</span>
                )}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                    />
                </svg>
            </button>

            {menu}
        </div>
    );
}
