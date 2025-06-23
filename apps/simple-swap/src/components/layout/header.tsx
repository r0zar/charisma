"use client"

import React from "react";
import Link from "next/link";
import { WalletButton } from "../wallet-button";
import { Coins, Menu, X, Settings, Shield } from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const { connected } = useWallet();
    const isDev = process.env.NODE_ENV === 'development';

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <header className="relative z-20 border-b border-white/[0.08] bg-black/40 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20">
            <div className="absolute inset-0 bg-gradient-to-r from-white/[0.01] to-transparent pointer-events-none" />
            <div className="container flex h-16 items-center justify-between relative">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative">
                            <div className="h-8 w-8 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center backdrop-blur-sm group-hover:bg-white/[0.12] transition-all duration-200">
                                <Coins suppressHydrationWarning className="h-4 w-4 text-white/90" aria-hidden={true} />
                            </div>
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
                        </div>
                        <span className="hidden tracking-tight text-white/95 sm:inline-block group-hover:text-white transition-colors duration-200">
                            <span className="font-semibold">Charisma</span>{" "}
                            <span className="text-white/70 font-medium">Swap</span>
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1">
                        <Link href="/swap" className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all duration-200">
                            Swap
                        </Link>
                        <Link href="/orders" className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all duration-200">
                            Orders
                        </Link>
                        <Link href="/tokens" className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all duration-200">
                            Tokens
                        </Link>
                        {isDev && (
                            <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-400/90 hover:text-orange-300 hover:bg-orange-500/[0.08] rounded-xl transition-all duration-200">
                                <Shield className="h-3.5 w-3.5" />
                                Admin
                            </Link>
                        )}
                    </nav>
                </div>

                <div className="flex items-center gap-3">
                    {connected && (
                        <Link href="/settings" aria-label="Settings" className="hidden md:inline-flex">
                            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200 backdrop-blur-sm">
                                <Settings className="h-4 w-4" />
                            </div>
                        </Link>
                    )}
                    <WalletButton />
                    <button
                        className="md:hidden p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200 backdrop-blur-sm"
                        onClick={toggleMobileMenu}
                        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                    >
                        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu aria-hidden={true} className="h-5 w-5" />}
                    </button>
                </div>
            </div>
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-16 left-0 right-0 z-10 bg-black/40 backdrop-blur-xl border-b border-white/[0.08] supports-[backdrop-filter]:bg-black/20">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />
                    <nav className="container flex flex-col gap-2 py-6 relative">
                        <Link href="/swap" className="px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all duration-200" onClick={toggleMobileMenu}>
                            Swap
                        </Link>
                        <Link href="/orders" className="px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all duration-200" onClick={toggleMobileMenu}>
                            Orders
                        </Link>
                        <Link href="/tokens" className="px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all duration-200" onClick={toggleMobileMenu}>
                            Tokens
                        </Link>
                        {connected && (
                            <Link href="/settings" className="px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all duration-200" onClick={toggleMobileMenu}>
                                Settings
                            </Link>
                        )}
                        {isDev && (
                            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-orange-400/90 hover:text-orange-300 hover:bg-orange-500/[0.08] rounded-xl transition-all duration-200" onClick={toggleMobileMenu}>
                                <Shield className="h-4 w-4" />
                                Admin
                            </Link>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
}