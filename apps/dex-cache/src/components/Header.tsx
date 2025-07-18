'use client';

import Link from "next/link";
import { WalletConnector } from "@/components/wallet-connector";
import { HandCoinsIcon, Menu } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
} from "@/components/ui/sheet";
import { useState } from "react";

// Navigation links array for reuse in both desktop and mobile views
const navigationLinks = [
    { href: "/vaults", label: "All" },
    { href: "/pools", label: "Liquidity Pools" },
    { href: "/sublinks", label: "Subnets" },
    { href: "/energy", label: "Hold-to-Earn" },
];

export default function Header() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur supports-[backdrop-flur]:bg-background/60">
            <div className="container flex h-16 items-center justify-between py-4">
                <div className="flex items-center gap-6 md:gap-10">
                    <Link
                        href="/"
                        className="flex items-center space-x-2 transition-opacity hover:opacity-80"
                    >
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-primary via-primary/80 to-primary/50">
                            <HandCoinsIcon suppressHydrationWarning className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="hidden tracking-tight text-foreground sm:inline-block text-lg">
                            <span className="font-bold">Charisma</span>{" "}
                            <span className="text-primary">Invest</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation - Hidden on mobile */}
                    <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
                        {navigationLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="transition-colors hover:text-foreground/80 text-foreground/60"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="relative flex items-center gap-4">
                    <WalletConnector className="ml-auto" />

                    {/* Mobile Menu Button - Visible only on mobile */}
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu suppressHydrationWarning className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[75vw] sm:w-[350px]">
                            <SheetHeader className="mb-6">
                                <SheetTitle className="flex items-center">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-primary via-primary/80 to-primary/50 mr-2">
                                        <HandCoinsIcon suppressHydrationWarning className="h-4 w-4 text-primary-foreground" />
                                    </div>
                                    Charisma Invest
                                </SheetTitle>
                            </SheetHeader>

                            <nav className="flex flex-col space-y-4">
                                {navigationLinks.map((link) => (
                                    <SheetClose asChild key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="flex items-center py-2 px-4 rounded-md hover:bg-muted transition-colors text-foreground/80 hover:text-foreground"
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