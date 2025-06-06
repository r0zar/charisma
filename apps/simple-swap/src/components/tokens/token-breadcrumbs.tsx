import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { TokenSummary } from "@/app/token-actions";
import { cn } from "@/lib/utils";

interface TokenBreadcrumbsProps {
    token: TokenSummary;
    className?: string;
}

export default function TokenBreadcrumbs({ token, className }: TokenBreadcrumbsProps) {
    return (
        <nav className={cn("flex items-center text-sm text-muted-foreground", className)}>
            <Link
                href="/"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
                <Home className="h-4 w-4" />
                Home
            </Link>

            <ChevronRight className="h-4 w-4 mx-2" />

            <Link
                href="/tokens"
                className="hover:text-foreground transition-colors"
            >
                Tokens
            </Link>

            <ChevronRight className="h-4 w-4 mx-2" />

            <span className="text-foreground font-medium">
                {token.symbol}
            </span>
        </nav>
    );
} 