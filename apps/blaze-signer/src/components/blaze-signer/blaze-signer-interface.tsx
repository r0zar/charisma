"use client"

import React, { useState, useEffect } from "react"
import { STACKS_MAINNET } from "@stacks/network"
import { useRouter, usePathname } from "next/navigation"
import { HashGenerator } from "./hash-generator"
import { UuidChecker } from "./uuid-checker"
import { SignatureVerifier } from "./signature-verifier"
import { VerifySignature } from "./verify-signature"
import { SubmitSignature } from "./submit-signature"
import {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
} from "../ui/navigation-menu"
import { cn } from "../ui/utils"
import { Button } from "../ui/button"
import { useWallet } from "@/context/wallet-context"
import { BulkSignatureGenerator } from "./bulk-signature-generator"

// Default to mainnet
const defaultNetwork = STACKS_MAINNET

// --- New Type for Token Sub-navigation ---
type TokenSubNav = 'welsh-credits' | 'charisma-credits';

export function BlazeSignerInterface() {
    const router = useRouter()
    const pathname = usePathname()
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    // Use the wallet context hook
    const { connected, address, publicKey } = useWallet()

    const [network] = useState(defaultNetwork)

    // --- Routing Logic (remains mostly the same) ---
    const getTabFromPath = (path: string): string => {
        if (path.startsWith("/signer/uuid")) return "uuid"
        if (path.startsWith("/signer/bulk")) return "bulk"
        if (path.startsWith("/signer/tokens")) return "tokens"
        return "signatures" // Default tab
    }

    const getTokensSubNavFromPath = (path: string): TokenSubNav | null => {
        if (path.includes("/welsh-credits")) return 'welsh-credits';
        if (path.includes("/charisma-credits")) return 'charisma-credits';
        return null;
    }

    const [activeTab, setActiveTab] = useState(() => getTabFromPath(pathname || "/signer"))
    const [activeTokenSubNav, setActiveTokenSubNav] = useState<TokenSubNav | null>(() => getTokensSubNavFromPath(pathname || ""));

    // Update active tab and subNav when pathname changes
    useEffect(() => {
        if (pathname) {
            const currentTab = getTabFromPath(pathname);
            const currentTokenSubNav = getTokensSubNavFromPath(pathname);
            if (currentTab !== activeTab) {
                setActiveTab(currentTab);
            }
            if (currentTab !== 'tokens') {
                setActiveTokenSubNav(null);
            } else if (currentTokenSubNav !== activeTokenSubNav) {
                setActiveTokenSubNav(currentTokenSubNav ?? 'welsh-credits');
            }
        }
    }, [pathname, activeTab, activeTokenSubNav]);

    // Handle MAIN tab change
    const handleTabChange = (tabId: string) => {
        let path = "/signer"
        switch (tabId) {
            case "uuid": path = "/signer/uuid"; break;
            case "bulk": path = "/signer/bulk"; break;
            case "tokens": path = "/tokens"; break; // Default to welsh
            default: path = "/signer";
        }
        router.push(path, { scroll: false });
        if (tabId !== 'tokens') setActiveTokenSubNav(null);
    }

    // Handle TOKEN SUB NAV change
    const handleTokenSubNavChange = (subNavItem: TokenSubNav) => {
        const path = `/tokens/${subNavItem}`;
        setActiveTokenSubNav(subNavItem);
        router.push(path, { scroll: false });
    }

    // --- Updated Nav Items (Use context values) ---
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
                            isWalletConnected={connected}
                            walletAddress={address || ""}
                        />
                        <VerifySignature
                            network={network}
                            walletAddress={address || ""}
                        />
                        <SignatureVerifier
                            network={network}
                            walletAddress={address || ""}
                        />
                        <SubmitSignature
                            network={network}
                            walletAddress={address || ""}
                        />
                    </div>
                </div>
            )
        },
        {
            id: 'uuid',
            label: 'Verify UUID',
            href: '/signer/uuid',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Check if a specific UUID has already been processed by the Blaze Protocol contract.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <UuidChecker
                            network={network}
                            walletAddress={address || ""}
                        />
                    </div>
                </div>
            )
        },
        {
            id: 'bulk',
            label: 'Bulk Signing',
            href: '/signer/bulk',
            content: (
                <BulkSignatureGenerator
                    network={network}
                />
            )
        }
    ]

    const renderActiveTabContent = () => {
        const activeItem = navItems.find(item => item.id === activeTab)
        return activeItem?.content || null
    }

    return (
        <div className="container max-w-7xl mx-auto px-4 py-8">
            <div className="mb-6 border-b pb-4">
                <NavigationMenu className="max-w-full w-full">
                    <NavigationMenuList className="flex space-x-4">
                        {navItems.map(item => (
                            <NavigationMenuItem key={item.id}>
                                <Button
                                    variant={activeTab === item.id ? "default" : "ghost"}
                                    className={cn(
                                        "text-sm font-medium",
                                        activeTab === item.id
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground"
                                    )}
                                    onClick={() => handleTabChange(item.id)}
                                >
                                    {item.label}
                                </Button>
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>
            </div>
            {renderActiveTabContent()}
        </div>
    )
}