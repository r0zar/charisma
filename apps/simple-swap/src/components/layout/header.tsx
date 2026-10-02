"use client"

import React from "react";
import Link from "next/link";
import { WalletButton } from "../wallet-button";
import { BarChart3, ChevronDown, Menu, Settings, Shield } from "lucide-react";
import { ThemeToggle } from "@repo/brand/react";
import { advancedLinks } from "./nav-links";
import { useWallet } from "@/contexts/wallet-context";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

// Navigation links array for reuse in both desktop and mobile views
const navigationLinks = [
    // { href: "/activity", label: "Activity" },
    { href: "/swap", label: "Swap" },
    { href: "/orders", label: "Orders" },
    // { href: "/tokens", label: "Tokens" },
];

export function Header() {
    const [isOpen, setIsOpen] = React.useState(false);
    const { connected } = useWallet();
    const isDev = process.env.NODE_ENV === 'development';


    return (
        <header className="relative z-20 border-b border-line bg-chrome text-on-chrome">
            <div className="container flex h-16 items-center justify-between relative">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                        <span className="hidden text-[18px] font-bold tracking-tight sm:inline-block">
                            Charisma <span className="text-chrome-accent">Swap</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation - Hidden on mobile */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navigationLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="px-4 py-2 text-sm font-semibold text-on-chrome-muted hover:text-on-chrome hover:bg-on-chrome/10 rounded-xl transition-all duration-200"
                            >
                                {link.label}
                            </Link>
                        ))}
                        <DropdownMenu>
                            <DropdownMenuTrigger aria-haspopup="menu" className="flex cursor-pointer items-center gap-1 px-4 py-2 text-sm font-semibold text-on-chrome-muted hover:text-on-chrome hover:bg-on-chrome/10 rounded-xl transition-all duration-200">
                                Advanced <ChevronDown className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[340px] p-1.5">
                                {advancedLinks.map((link) => (
                                    <DropdownMenuItem key={link.href} className="cursor-pointer rounded-lg p-0">
                                        <Link href={link.href} className="flex w-full items-center gap-3 p-2.5">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-body">
                                                <link.icon className="h-4 w-4" />
                                            </span>
                                            <span className="flex min-w-0 flex-col">
                                                <span className="text-sm font-medium text-ink">{link.label}</span>
                                                <span className="truncate text-xs text-ink-muted">{link.hint}</span>
                                            </span>
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {isDev && (
                            <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-chrome-accent hover:bg-on-chrome/10 rounded-xl transition-all duration-200">
                                <Shield className="h-3.5 w-3.5" />
                                Admin
                            </Link>
                        )}
                    </nav>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/analytics" aria-label="Analytics" title="Analytics" className="hidden md:inline-flex">
                        <div className="p-2 rounded-xl text-on-chrome-muted hover:text-on-chrome hover:bg-on-chrome/10 transition-all duration-200">
                            <BarChart3 className="h-4 w-4" />
                        </div>
                    </Link>
                    {connected && (
                        <Link href="/settings" aria-label="Settings" className="hidden md:inline-flex">
                            <div className="p-2 rounded-xl text-on-chrome-muted hover:text-on-chrome hover:bg-on-chrome/10 transition-all duration-200">
                                <Settings className="h-4 w-4" />
                            </div>
                        </Link>
                    )}
                    <ThemeToggle className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-chrome-muted hover:text-on-chrome hover:bg-on-chrome/10 transition-all duration-200" />
                    <WalletButton />

                    {/* Mobile Menu Button - Visible only on mobile */}
                    <Drawer.Root open={isOpen} onOpenChange={setIsOpen} direction="right">
                        <Drawer.Trigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden p-2 rounded-xl text-on-chrome-muted hover:text-on-chrome hover:bg-on-chrome/10 transition-all duration-200"
                            >
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </Drawer.Trigger>
                        <Drawer.Portal>
                            <Drawer.Overlay className="fixed inset-0 bg-overlay backdrop-blur-sm" />
                            <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 w-[75vw] sm:w-[350px] bg-surface-raised text-ink border-l border-line shadow-[var(--shadow-overlay)] flex flex-col">
                                <div className="flex-1 p-6">
                                    <div className="flex items-center mb-6">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/charisma.png" alt="" className="mr-2.5 h-6 w-6 rounded-full" />
                                        <h2 className="flex-1 text-lg font-bold text-ink">Charisma <span className="text-accent-text">Swap</span></h2>
                                        <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-surface-hover" />
                                    </div>

                                    <nav className="flex flex-col space-y-2">
                                        {navigationLinks.map((link) => (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                className="flex items-center py-3 px-4 rounded-xl text-ink-body hover:text-ink hover:bg-surface-hover transition-all duration-200"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                {link.label}
                                            </Link>
                                        ))}

                                        <div className="px-4 pt-2 text-xs uppercase tracking-wider text-ink-muted">Advanced</div>
                                        {advancedLinks.map((link) => (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                className="flex items-center gap-3 py-3 px-4 rounded-xl text-ink-body hover:text-ink hover:bg-surface-hover transition-all duration-200"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <link.icon className="h-4 w-4" />
                                                {link.label}
                                            </Link>
                                        ))}

                                        <Link
                                            href="/analytics"
                                            className="flex items-center gap-3 py-3 px-4 rounded-xl text-ink-body hover:text-ink hover:bg-surface-hover transition-all duration-200"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <BarChart3 className="h-4 w-4" />
                                            Analytics
                                        </Link>

                                        {connected && (
                                            <Link
                                                href="/settings"
                                                className="flex items-center gap-3 py-3 px-4 rounded-xl text-ink-body hover:text-ink hover:bg-surface-hover transition-all duration-200"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <Settings className="h-4 w-4" />
                                                Settings
                                            </Link>
                                        )}

                                        {isDev && (
                                            <Link
                                                href="/admin"
                                                className="flex items-center gap-3 py-3 px-4 rounded-xl text-accent-text/90 hover:text-accent-text hover:bg-accent/[0.08] transition-all duration-200"
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