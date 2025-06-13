"use client"

import React from "react";
import Link from "next/link";
import { WalletButton } from "../wallet-button";
import { Coins, Menu, X, Settings, Shield } from "lucide-react";
import { Button } from "../ui/button";
import { useWallet } from "@/contexts/wallet-context";

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const { connected } = useWallet();
    const isDev = process.env.NODE_ENV === 'development';

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <header className="relative z-20 border-b bg-background/95 backdrop-blur">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                            <Coins suppressHydrationWarning className="h-4 w-4 text-primary" aria-hidden={true} />
                        </div>
                        <span className="hidden tracking-tight text-foreground sm:inline-block">
                            <span className="font-bold">Charisma</span>{" "}
                            <span className="text-primary">Swap</span>
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-5">
                        <Link href="/swap" className="text-sm font-medium hover:text-primary transition-colors">
                            Swap
                        </Link>
                        <Link href="/orders" className="text-sm font-medium hover:text-primary transition-colors">
                            Orders
                        </Link>
                        <Link href="/tokens" className="text-sm font-medium hover:text-primary transition-colors">
                            Tokens
                        </Link>
                        <Link href="/fiat" className="text-sm font-medium hover:text-primary transition-colors">
                            Buy With Card
                        </Link>
                        <Link href="/shop" className="text-sm font-medium hover:text-primary transition-colors">
                            Marketplace
                        </Link>
                        {isDev && (
                            <Link href="/admin" className="flex items-center gap-1 text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors">
                                <Shield className="h-3 w-3" />
                                Admin
                            </Link>
                        )}
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    {connected && (
                        <Link href="/notifications" aria-label="Notification Settings" className="hidden md:inline-flex">
                            <Button variant="ghost" size="icon">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </Link>
                    )}
                    <WalletButton />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden cursor-pointer"
                        onClick={toggleMobileMenu}
                        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                    >
                        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu aria-hidden={true} className="h-6 w-6" />}
                    </Button>
                </div>
            </div>
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-16 left-0 right-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95 border-b">
                    <nav className="container flex flex-col gap-4 py-4">
                        <Link href="/swap" className="text-sm font-medium hover:text-primary transition-colors" onClick={toggleMobileMenu}>
                            Swap
                        </Link>
                        <Link href="/orders" className="text-sm font-medium hover:text-primary transition-colors" onClick={toggleMobileMenu}>
                            Orders
                        </Link>
                        <Link href="/tokens" className="text-sm font-medium hover:text-primary transition-colors" onClick={toggleMobileMenu}>
                            Tokens
                        </Link>
                        <Link href="/fiat" className="text-sm font-medium hover:text-primary transition-colors" onClick={toggleMobileMenu}>
                            Buy With Card
                        </Link>
                        <Link href="/shop" className="text-sm font-medium hover:text-primary transition-colors" onClick={toggleMobileMenu}>
                            Marketplace
                        </Link>
                        {connected && (
                            <Link href="/notifications" className="text-sm font-medium hover:text-primary transition-colors" onClick={toggleMobileMenu}>
                                Settings
                            </Link>
                        )}
                        {isDev && (
                            <Link href="/admin" className="flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors" onClick={toggleMobileMenu}>
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