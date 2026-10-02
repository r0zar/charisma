'use client';

import Link from "next/link";
import { WalletConnector } from "@/components/wallet-connector";
import { Menu } from 'lucide-react';
import { ThemeToggle } from "@repo/brand/react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
} from "@/components/ui/sheet";
import { useState } from "react";
import { navigationLinks } from "@/lib/nav-links";

const toggleClass = "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200";

export default function Header() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 w-full border-b border-line bg-chrome text-on-chrome">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                        <span className="hidden text-[18px] font-bold tracking-tight sm:inline-block">
                            Charisma <span className="text-chrome-accent">Invest</span>
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
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    <ThemeToggle className={`hidden sm:inline-flex text-on-chrome-muted hover:text-on-chrome hover:bg-on-chrome/10 ${toggleClass}`} />
                    <WalletConnector />

                    {/* Mobile Menu Button - Visible only on mobile */}
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <button className={`md:hidden text-on-chrome-muted hover:text-on-chrome hover:bg-on-chrome/10 ${toggleClass}`}>
                                <Menu suppressHydrationWarning className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[75vw] sm:w-[350px] bg-surface-raised">
                            <SheetHeader className="mb-6">
                                <SheetTitle className="flex items-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/charisma.png" alt="" className="mr-2.5 h-6 w-6 rounded-full" />
                                    Charisma <span className="ml-1 text-accent-text">Invest</span>
                                    <ThemeToggle className={`ml-auto text-ink-muted hover:text-ink hover:bg-surface-hover ${toggleClass}`} />
                                </SheetTitle>
                            </SheetHeader>

                            <nav className="flex flex-col space-y-1">
                                {navigationLinks.map((link) => (
                                    <SheetClose asChild key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="flex items-center py-2 px-4 rounded-lg hover:bg-surface-hover transition-colors text-ink-body hover:text-ink"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            {link.label}
                                        </Link>
                                    </SheetClose>
                                ))}
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
