"use client"

import React from "react";
import Link from "next/link";
import { WalletButton } from "./wallet-button";
import { Coins } from "lucide-react";

export function Header() {
    return (
        <header className="relative z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Coins className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-xl font-bold">Swap</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-5">
                        <Link href="/swap" className="text-sm font-medium hover:text-primary transition-colors">
                            Swap
                        </Link>
                        <div className="relative group">
                            <span className="text-sm font-medium text-muted-foreground cursor-not-allowed">
                                Tokens
                            </span>
                            <div className="absolute left-1/2 -translate-x-1/2 top-6 bg-popover border border-border rounded-md px-2 py-1 text-xs font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                Coming Soon
                            </div>
                        </div>
                        <div className="relative group">
                            <span className="text-sm font-medium text-muted-foreground cursor-not-allowed">
                                Pools
                            </span>
                            <div className="absolute left-1/2 -translate-x-1/2 top-6 bg-popover border border-border rounded-md px-2 py-1 text-xs font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                Coming Soon
                            </div>
                        </div>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <WalletButton />
                </div>
            </div>
        </header>
    );
} 