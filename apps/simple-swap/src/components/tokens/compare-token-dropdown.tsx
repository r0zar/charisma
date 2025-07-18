"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { TokenSummary } from "@/types/token-types";

interface CompareTokenDropdownProps {
    tokens: TokenSummary[];
    selected?: TokenSummary | null;
    onSelect: (t: TokenSummary) => void;
}

export default function CompareTokenDropdown({ tokens, selected, onSelect }: CompareTokenDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const filtered = useMemo(() => {
        if (!search.trim()) return tokens;
        const q = search.toLowerCase();
        return tokens.filter(
            (t) =>
                t.symbol.toLowerCase().includes(q) ||
                t.name.toLowerCase().includes(q) ||
                t.contractId.toLowerCase().includes(q),
        );
    }, [tokens, search]);

    useEffect(() => {
        function handleOutside(e: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                portalRef.current &&
                !portalRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        function updatePos() {
            if (dropdownRef.current) {
                const rect = dropdownRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + window.scrollY + 8,
                    left: rect.left + window.scrollX,
                    width: Math.max(rect.width, 260),
                });
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleOutside);
            window.addEventListener("scroll", updatePos, true);
            window.addEventListener("resize", updatePos);
            updatePos();
        }
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            window.removeEventListener("scroll", updatePos, true);
            window.removeEventListener("resize", updatePos);
        };
    }, [open]);

    const menu =
        open && mounted
            ? createPortal(
                <div
                    ref={portalRef}
                    className="glass-card py-2 fixed z-[9999] bg-card border border-border rounded-xl shadow-lg"
                    style={{ top: position.top, left: position.left, width: position.width, maxHeight: 320 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search tokens"
                            className="w-full bg-muted/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <div className="max-h-[240px] overflow-y-auto divide-y divide-border">
                        {filtered.length === 0 ? (
                            <div className="py-6 text-center text-muted-foreground text-sm">No tokens found</div>
                        ) : (
                            filtered.map((t) => (
                                <div
                                    key={t.contractId}
                                    onClick={() => {
                                        onSelect(t);
                                        setOpen(false);
                                        setSearch("");
                                    }}
                                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 ${selected?.contractId === t.contractId ? "bg-muted/20" : ""}`}
                                >
                                    {t.image ? (
                                        <Image src={t.image} alt={t.symbol} width={24} height={24} className="rounded-full" />
                                    ) : (
                                        <div className="rounded-full bg-muted/50 h-6 w-6 flex items-center justify-center text-[10px] font-semibold text-primary/80">
                                            {t.symbol.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-sm font-medium leading-tight">{t.symbol}</div>
                                        <div className="text-[11px] text-muted-foreground leading-tight">{t.name}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>,
                document.body,
            )
            : null;

    return (
        <div ref={dropdownRef} className="relative w-full">
            <button
                type="button"
                className="token-select w-full flex justify-between items-center bg-muted/20 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                onClick={() => setOpen(!open)}
            >
                {selected ? (
                    <div className="flex items-center gap-2">
                        {selected.image ? (
                            <Image src={selected.image} alt={selected.symbol} width={20} height={20} className="rounded-full" />
                        ) : (
                            <div className="rounded-full bg-muted/50 h-5 w-5 flex items-center justify-center text-[10px] font-semibold text-primary/80">
                                {selected.symbol.charAt(0)}
                            </div>
                        )}
                        <span className="text-sm font-medium">{selected.symbol}</span>
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">Select token</span>
                )}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {menu}
        </div>
    );
} 