"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { TokenSummary } from "@/app/token-actions";
import CompareTokenSelector from "./compare-token-selector";
import TokenTable from "./token-table";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props {
    tokens: TokenSummary[];
}

export default function TokensPageClient({ tokens }: Props) {
    const [compareId, setCompareId] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // init compareId
    useEffect(() => {
        if (compareId) return;
        const urlC = searchParams?.get("compare");
        if (urlC) {
            setCompareId(urlC);
            return;
        }
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("compareTokenId");
            if (stored) {
                setCompareId(stored);
            }
        }
    }, [compareId, searchParams]);

    // default fallback
    useEffect(() => {
        if (!compareId && tokens.length) {
            const stable = tokens.find((t) => ["aUSD", "USDC", "USDT", "USD"].includes(t.symbol));
            setCompareId(stable ? stable.contractId : tokens[0].contractId);
        }
    }, [compareId, tokens]);

    // persist compareId
    useEffect(() => {
        if (!compareId) return;
        if (typeof window !== "undefined") {
            localStorage.setItem("compareTokenId", compareId);
        }
        const params = new URLSearchParams(searchParams?.toString());
        params.set("compare", compareId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [compareId, pathname, router, searchParams]);

    const compareToken = useMemo(() => tokens.find((t) => t.contractId === compareId) ?? null, [tokens, compareId]);

    return (
        <>
            {/* Header row with selector */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                {/* title & subtitle */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Tokens</h1>
                    <p className="text-muted-foreground max-w-prose">
                        Live USD prices &amp; metadata for every supported token.
                    </p>
                </div>

                {compareToken && (
                    <CompareTokenSelector
                        tokens={tokens}
                        primary={compareToken}
                        selectedId={compareId}
                        onSelect={setCompareId}
                    />
                )}
            </div>

            {/* token table */}
            <TokenTable tokens={tokens} compareId={compareId} />
        </>
    );
} 