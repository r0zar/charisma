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
                        <Link href="/tokens" className="text-sm font-medium hover:text-primary transition-colors">
                            Tokens
                        </Link>
                        <Link href="/pools" className="text-sm font-medium hover:text-primary transition-colors">
                            Pools
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <WalletButton />
                </div>
            </div>
        </header>
    );
} 