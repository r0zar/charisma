"use client"

import React from "react";
import Link from "next/link";
import { WalletButton } from "../wallet-button";
import { Coins, Menu, Settings, Shield } from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";

// Navigation links array for reuse in both desktop and mobile views
const navigationLinks = [
    { href: "/swap", label: "Swap" },
    { href: "/orders", label: "Orders" },
    { href: "/tokens", label: "Tokens" },
];

export function Header() {
    const [isOpen, setIsOpen] = React.useState(false);
    const { connected } = useWallet();
    const isDev = process.env.NODE_ENV === 'development';


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

                    {/* Desktop Navigation - Hidden on mobile */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navigationLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all duration-200"
                            >
                                {link.label}
                            </Link>
                        ))}
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
                    
                    {/* Mobile Menu Button - Visible only on mobile */}
                    <Drawer.Root open={isOpen} onOpenChange={setIsOpen} direction="right">
                        <Drawer.Trigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="md:hidden p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200 backdrop-blur-sm"
                            >
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </Drawer.Trigger>
                        <Drawer.Portal>
                            <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                            <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 w-[75vw] sm:w-[350px] bg-black/40 backdrop-blur-xl border-l border-white/[0.08] supports-[backdrop-filter]:bg-black/20 flex flex-col">
                                <div className="flex-1 p-6">
                                    <div className="flex items-center mb-6">
                                        <div className="relative mr-3">
                                            <div className="h-6 w-6 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center backdrop-blur-sm">
                                                <Coins className="h-4 w-4 text-white/90" />
                                            </div>
                                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-white/95">Charisma Swap</h2>
                                    </div>

                                    <nav className="flex flex-col space-y-2">
                                        {navigationLinks.map((link) => (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                className="flex items-center py-3 px-4 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                {link.label}
                                            </Link>
                                        ))}
                                        
                                        {connected && (
                                            <Link
                                                href="/settings"
                                                className="flex items-center gap-3 py-3 px-4 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <Settings className="h-4 w-4" />
                                                Settings
                                            </Link>
                                        )}
                                        
                                        {isDev && (
                                            <Link
                                                href="/admin"
                                                className="flex items-center gap-3 py-3 px-4 rounded-xl text-orange-400/90 hover:text-orange-300 hover:bg-orange-500/[0.08] transition-all duration-200"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <Shield className="h-4 w-4" />
                                                Admin
                                            </Link>
                                        )}
                                    </nav>
                                </div>
                            </Drawer.Content>
                        </Drawer.Portal>
                    </Drawer.Root>
                </div>
            </div>
        </header>
    );
}