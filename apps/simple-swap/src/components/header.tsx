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
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-muted-foreground/70 cursor-not-allowed">
                                Tokens
                            </span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-muted/50 text-muted-foreground rounded-full border border-border/50">
                                Soon
                            </span>
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