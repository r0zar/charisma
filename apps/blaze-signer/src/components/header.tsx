"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { Zap, Github } from "lucide-react"
import { cn } from "@/lib/utils"
import { CompactWalletConnector } from "./blaze-signer/compact-wallet-connector"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function Header() {
    const pathname = usePathname()
    const isLandingPage = pathname === "/"

    const landingNavItems = [
        { href: "#features", label: "Features" },
        { href: "#how-it-works", label: "How it Works" },
        { href: "#use-cases", label: "Use Cases" },
    ]

    const appNavItems = [
        { href: "/signer", label: "Signer" },
        { href: "/tokens", label: "Tokens" },
        { href: "/pools", label: "Pools" },
    ]

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-7xl items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link
                        href="/"
                        className="flex items-center gap-2"
                    >
                        <div className="flex items-center justify-center rounded-lg bg-primary/10 p-1">
                            <Zap className="h-6 w-6 text-primary" />
                        </div>
                        <span className="text-xl font-bold">Blaze Protocol</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6">
                        {isLandingPage ? (
                            // Landing page navigation
                            <>
                                {landingNavItems.map((item) => (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </>
                        ) : (
                            // App navigation
                            <>
                                {appNavItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "text-sm font-medium transition-colors hover:text-foreground",
                                            pathname.startsWith(item.href)
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </>
                        )}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    {isLandingPage ? (
                        <div className="flex items-center gap-3">
                            <a
                                href="https://github.com/r0zar/charisma"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Github className="h-5 w-5" />
                                <span className="sr-only">GitHub</span>
                            </a>
                            <Link href="/signer">
                                <Button size="sm">Launch App</Button>
                            </Link>
                        </div>
                    ) : (
                        <CompactWalletConnector />
                    )}
                </div>
            </div>
        </header>
    )
} 