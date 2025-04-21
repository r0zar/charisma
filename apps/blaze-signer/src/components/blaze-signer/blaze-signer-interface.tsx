"use client"

import React, { useState, useEffect } from "react"
import { STACKS_MAINNET } from "@stacks/network"
import { useRouter, usePathname } from "next/navigation"
import { WalletConnector } from "./wallet-connector"
import { CompactWalletConnector } from "./compact-wallet-connector"
import { HashGenerator } from "./hash-generator"
import { UuidChecker } from "./uuid-checker"
import { SignatureVerifier } from "./signature-verifier"
import { VerifySignature } from "./verify-signature"
import { SubmitSignature } from "./submit-signature"
import { WelshCreditsInterface } from "./welsh-credits"
import { DeployContractForm } from "./deploy-contract-form"
import { VerifyContent } from "./verify-content"
import { RedeemPageContent } from "./redeem-content"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"
import {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
    NavigationMenuLink,
    navigationMenuTriggerStyle,
} from "@repo/ui/navigation-menu"
import Link from "next/link"
import { cn } from "@repo/ui/utils"
import { Zap, MenuIcon } from "lucide-react"
import { Button } from "@repo/ui/button"


// Default to mainnet
const defaultNetwork = STACKS_MAINNET

export function BlazeSignerInterface() {
    const router = useRouter()
    const pathname = usePathname()
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const [walletStatus, setWalletStatus] = useState({
        connected: false,
        address: "",
        publicKey: ""
    })
    const [network] = useState(defaultNetwork)

    // Determine active tab based on current path
    const getTabFromPath = (path: string) => {
        if (path.includes("/uuid")) return "uuid"
        if (path.includes("/welsh-credits")) return "welsh-credits"
        if (path.includes("/redeem")) return "redeem"
        return "signatures" // Default tab
    }

    const [activeTab, setActiveTab] = useState(() => getTabFromPath(pathname || ""))

    // Update active tab when pathname changes
    useEffect(() => {
        if (pathname) {
            const currentTab = getTabFromPath(pathname);
            if (currentTab !== activeTab) {
                setActiveTab(currentTab);
            }
        }
    }, [pathname, activeTab]);

    // Handle tab change with router navigation
    const handleTabChange = (tabId: string) => {
        let path = "/signer"
        switch (tabId) {
            case "uuid":
                path = "/signer/uuid"
                break
            case "welsh-credits":
                path = "/signer/welsh-credits"
                break
            case "redeem":
                path = "/signer/redeem"
                break
            default:
                path = "/signer"
        }

        // Use shallow routing to avoid full page reloads
        router.push(path, { scroll: false })
    }

    // Add this function to handle client-side navigation for NavMenu links
    const handleNavMenuLinkClick = (href: string) => {
        router.push(href, { scroll: false });
    };

    const navItems = [
        {
            id: 'signatures',
            label: 'Signatures',
            href: '/signer',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Generate, verify, and submit SIP-018 structured data signatures for off-chain operations.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <HashGenerator
                            network={network}
                            isWalletConnected={walletStatus.connected}
                            walletAddress={walletStatus.address}
                        />
                        <VerifySignature
                            network={network}
                            walletAddress={walletStatus.address}
                        />
                        <SignatureVerifier
                            network={network}
                            walletAddress={walletStatus.address}
                        />
                        <SubmitSignature
                            network={network}
                            walletAddress={walletStatus.address}
                        />
                    </div>
                </div>
            )
        },
        {
            id: 'uuid',
            label: 'Verify',
            href: '/signer/uuid',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Check if a specific UUID has already been processed by the Blaze Protocol contract.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <UuidChecker
                            network={network}
                            walletAddress={walletStatus.address}
                        />
                    </div>
                </div>
            )
        },
        {
            id: 'welsh-credits',
            label: 'Welsh Credits',
            href: '/signer/welsh-credits',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Interact with the Welsh Credits (SIP-010 Fungible Token) contract: view info, check balance, deposit, withdraw, transfer, and redeem notes.
                    </p>
                    <WelshCreditsInterface
                        network={network}
                        walletAddress={walletStatus.address}
                        isWalletConnected={walletStatus.connected}
                    />
                </div>
            )
        },
        {
            id: 'redeem',
            label: 'Redeem Note',
            href: '/signer/redeem',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Redeem a signed note to receive Welsh Credits tokens.
                    </p>
                    <div className="grid grid-cols-1 gap-6">
                        <RedeemPageContent />
                    </div>
                </div>
            )
        }
    ]

    // Render the appropriate content based on active tab
    const renderActiveTabContent = () => {
        const activeItemData = navItems.find(item => item.id === activeTab);
        return activeItemData?.content || null;
    }

    return (
        <>
            {/* Navigation Bar */}
            <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
                <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    {/* Logo/Brand Link */}
                    <div className="flex items-center gap-2">
                        <Zap className="h-6 w-6 text-primary" />
                        <span className="text-xl font-bold">Blaze Protocol</span>
                    </div>

                    {/* Desktop Navigation Menu */}
                    <nav className="hidden md:flex items-center gap-6">
                        <NavigationMenu>
                            <NavigationMenuList className="gap-6">
                                {navItems.map((item) => (
                                    <NavigationMenuItem key={item.id}>
                                        <Link href={item.href} legacyBehavior passHref>
                                            <NavigationMenuLink
                                                className={cn(
                                                    "text-sm text-muted-foreground hover:text-foreground transition-colors",
                                                    getTabFromPath(pathname) === item.id && "text-foreground font-medium"
                                                )}
                                                onClick={() => handleNavMenuLinkClick(item.href)}
                                            >
                                                {item.label}
                                            </NavigationMenuLink>
                                        </Link>
                                    </NavigationMenuItem>
                                ))}
                            </NavigationMenuList>
                        </NavigationMenu>

                        {/* Desktop Wallet Connector */}
                        <div className="flex items-center">
                            <CompactWalletConnector
                                onWalletUpdate={setWalletStatus}
                            />
                        </div>
                    </nav>

                    {/* Mobile Navigation */}
                    <div className="flex items-center gap-4 md:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            <MenuIcon className="h-5 w-5" />
                            <span className="sr-only">Toggle menu</span>
                        </Button>

                        {/* Mobile Wallet Connector */}
                        <CompactWalletConnector
                            onWalletUpdate={setWalletStatus}
                        />
                    </div>
                </div>

                {/* Mobile Navigation Menu */}
                {isMenuOpen && (
                    <nav className="md:hidden border-t border-border">
                        <div className="container max-w-7xl mx-auto px-4 py-4">
                            <div className="flex flex-col gap-4">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className={cn(
                                            "text-sm text-muted-foreground hover:text-foreground transition-colors py-2",
                                            getTabFromPath(pathname) === item.id && "text-foreground font-medium"
                                        )}
                                        onClick={() => {
                                            handleNavMenuLinkClick(item.href);
                                            setIsMenuOpen(false);
                                        }}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </nav>
                )}
            </header>

            <div className="container max-w-7xl mx-auto px-4 py-8">
                <div className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <h1 className="text-2xl md:text-3xl font-bold">Blaze Protocol Interface</h1>
                            <p className="text-muted-foreground text-sm sm:text-base">
                                Test the functions of the blaze-signer Clarity smart contract
                            </p>
                        </div>
                        <div className="p-3 rounded-md border border-border text-sm bg-muted/30 min-w-[260px] text-center md:text-right">
                            <span className="font-medium font-mono text-xs sm:text-sm">{BLAZE_SIGNER_CONTRACT}</span>
                        </div>
                    </div>

                    {/* Content section - always render based on active tab */}
                    <div className="w-full max-w-full mx-auto">
                        {renderActiveTabContent()}
                    </div>
                </div>
            </div>
        </>
    )
} 