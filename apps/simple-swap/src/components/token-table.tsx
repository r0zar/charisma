"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import Image from "next/image";
import type { TokenSummary } from "@/app/token-actions";

interface TokenTableProps {
    tokens: TokenSummary[];
    compareId: string | null;
}

type SortKey = "name" | "price" | "change1h" | "change24h" | "change7d";

export default function TokenTable({ tokens, compareId }: TokenTableProps) {
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [asc, setAsc] = useState<boolean>(true);

    const searchInputRef = useRef<HTMLInputElement>(null);

    /* ------------- hot-key focus '/' ------------- */
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (
                e.key === "/" &&
                !(
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement ||
                    (e.target as HTMLElement).isContentEditable
                )
            ) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    const compareToken = useMemo(() => tokens.find((t) => t.contractId === compareId) ?? null, [tokens, compareId]);

    function diff(a: number | null, b: number | null) {
        if (a === null || b === null) return null;
        return a - b;
    }

    function getSortValue(token: TokenSummary, key: SortKey) {
        switch (key) {
            case "name":
                return token.name.toLowerCase();
            case "price":
                return token.price ?? 0;
            case "change1h":
                return diff(token.change1h, compareToken?.change1h ?? null) ?? -Infinity;
            case "change24h":
                return diff(token.change24h, compareToken?.change24h ?? null) ?? -Infinity;
            case "change7d":
                return diff(token.change7d, compareToken?.change7d ?? null) ?? -Infinity;
            default:
                return 0;
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let out = tokens;
        if (q) {
            out = tokens.filter((t) =>
                t.name.toLowerCase().includes(q) ||
                t.symbol.toLowerCase().includes(q) ||
                t.contractId.toLowerCase().includes(q)
            );
        }

        out = [...out].sort((a, b) => {
            const dir = asc ? 1 : -1;
            const aVal = getSortValue(a, sortKey);
            const bVal = getSortValue(b, sortKey);
            if (aVal === bVal) return 0;
            return aVal > bVal ? dir : -dir;
        });

        return out;
    }, [tokens, query, sortKey, asc, compareToken]);

    function toggleSort(key: SortKey) {
        if (key === sortKey) {
            setAsc(!asc);
        } else {
            setSortKey(key);
            setAsc(true);
        }
    }

    return (
        <div className="w-full">
            {/* Search */}
            <div className="mb-6">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search by name, symbol or address"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full h-12 pl-10 pr-12 rounded-lg border border-input bg-background text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5 bg-muted/50 select-none">
                        /
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="min-w-full text-sm">
                    <thead className="bg-muted text-muted-foreground sticky top-0 z-20">
                        <tr>
                            {headerCell("Token", "name", "sticky bg-muted left-0 z-10 w-[11rem]")}
                            {headerCell("Price", "price", "text-right")}
                            {headerCell("1h %", "change1h", "text-right")}
                            {headerCell("24h %", "change24h", "text-right")}
                            {headerCell("7d %", "change7d", "text-right")}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filtered.map((token) => (
                            <tr
                                key={token.contractId}
                                className="hover:bg-muted/20 cursor-pointer"
                                onClick={() => (window.location.href = `/tokens/${encodeURIComponent(token.contractId)}`)}
                            >
                                {/* Token */}
                                <td className="p-4 flex items-center gap-3 sticky left-0 bg-card z-10 w-[11rem]">
                                    <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden">
                                        {token.image ? (
                                            <Image src={token.image} alt={token.symbol} width={32} height={32} className="object-cover" />
                                        ) : (
                                            <span className="text-xs font-semibold text-primary/80">
                                                {token.symbol.charAt(0)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium leading-tight truncate max-w-[8rem]">{token.name}</div>
                                        <div className="text-xs text-muted-foreground">{token.symbol}</div>
                                    </div>
                                </td>
                                {/* Price */}
                                <td className="p-4 text-right font-medium">{fmtPrice(token.price)}</td>
                                {/* 1h */}
                                <td className={`p-4 text-right ${getDeltaColour(diff(token.change1h, compareToken?.change1h ?? null))}`}>{fmtDelta(diff(token.change1h, compareToken?.change1h ?? null))}</td>
                                {/* 24h */}
                                <td className={`p-4 text-right ${getDeltaColour(diff(token.change24h, compareToken?.change24h ?? null))}`}>{fmtDelta(diff(token.change24h, compareToken?.change24h ?? null))}</td>
                                {/* 7d */}
                                <td className={`p-4 text-right ${getDeltaColour(diff(token.change7d, compareToken?.change7d ?? null))}`}>{fmtDelta(diff(token.change7d, compareToken?.change7d ?? null))}</td>
                            </tr>
                        ))}

                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                                    No tokens match your query.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    function headerCell(label: string, key: SortKey, extraClass = "") {
        const active = sortKey === key;
        return (
            <th
                onClick={() => toggleSort(key)}
                className={`p-4 cursor-pointer select-none ${extraClass}`}
            >
                <div className="inline-flex items-center gap-1">
                    {label}
                    <ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-primary" : ""}`} />
                </div>
            </th>
        );
    }
}

/* ---------------- helpers ---------------- */
function fmtPrice(price: number | null) {
    if (price === null) return "-";
    return `$${price.toFixed(4)}`;
}

function fmtDelta(delta: number | null) {
    if (delta === null) return "-";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(2)}%`;
}

function getDeltaColour(delta: number | null) {
    if (delta === null) return "text-muted-foreground";
    if (delta > 0) return "text-green-600";
    if (delta < 0) return "text-red-600";
    return "";
} 