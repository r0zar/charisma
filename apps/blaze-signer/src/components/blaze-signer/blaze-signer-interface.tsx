"use client"

import React, { useState, useEffect } from "react"
import { STACKS_MAINNET } from "@stacks/network"
import { useRouter, usePathname } from "next/navigation"
import { WalletConnector } from "./wallet-connector"
import { CompactWalletConnector } from "./compact-wallet-connector"
import { HashGenerator } from "./hash-generator"
import { UuidChecker } from "./uuid-checker"
import { SignatureVerifier } from "./signature-verifier"
import { Tabs } from "@repo/ui/tabs"
import { VerifySignature } from "./verify-signature"
import { SubmitSignature } from "./submit-signature"
import { WelshCreditsInterface } from "./welsh-credits"
import { DeployContractForm } from "./deploy-contract-form"
import { VerifyContent } from "./verify-content"
import { RedeemPageContent } from "./redeem-content"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"
import { cn } from "@repo/ui/utils"
import { Link } from "@repo/ui/link"

// Default to mainnet
const defaultNetwork = STACKS_MAINNET

export function BlazeSignerInterface() {
    const router = useRouter()
    const pathname = usePathname()

    const [walletStatus, setWalletStatus] = useState({
        connected: false,
        address: "",
        publicKey: ""
    })
    const [network] = useState(defaultNetwork)

    // Determine active tab based on current path
    const getTabFromPath = (path: string) => {
        if (path.includes("/submit")) return "submit"
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
            case "submit":
                path = "/signer/submit"
                break
            case "uuid":
                path = "/signer/uuid-checker"
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

    // Add this function to handle client-side navigation
    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
        e.preventDefault();
        router.push(path, { scroll: false });
    };

    const tabs = [
        {
            id: 'signatures',
            label: 'Signatures',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Generate and verify SIP-018 structured data hashes and signatures for off-chain operations.
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
                    </div>
                </div>
            )
        },
        {
            id: 'submit',
            label: 'Submit',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-2">
                        Submit a previously generated and signed message (hash + signature) to the main Blaze Protocol contract.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        const activeTabData = tabs.find(tab => tab.id === activeTab);
        return activeTabData?.content || null;
    }

    return (
        <>
            {/* Navigation Bar */}
            <header className="bg-background border-b border-border">
                <nav className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <a
                        href="/signer"
                        className="text-xl font-bold text-foreground hover:text-primary transition-colors"
                        onClick={(e) => handleLinkClick(e, '/signer')}
                    >
                        Blaze Protocol
                    </a>
                    <div className="flex items-center justify-end gap-6">
                        {/* Desktop Navigation */}
                        <div className="hidden md:flex space-x-4">
                            {tabs.map(tab => {
                                const href = `/signer${tab.id === 'signatures' ? '' : `/${tab.id}`}`;
                                return (
                                    <Link
                                        key={tab.id}
                                        href={href}
                                        className={cn(
                                            "text-sm font-medium px-3 py-2 rounded-md transition-colors",
                                            activeTab === tab.id
                                                ? "bg-muted text-foreground"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        )}
                                        onClick={(e) => handleLinkClick(e, href)}
                                    >
                                        {tab.label}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Wallet Status in Header - Compact Version */}
                        <div className="flex items-center ml-auto md:ml-0">
                            <CompactWalletConnector
                                onWalletUpdate={setWalletStatus}
                            />
                        </div>
                    </div>
                </nav>
            </header>

            <div className="container max-w-7xl mx-auto px-4 py-8">
                <div className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <h1 className="text-2xl md:text-3xl font-bold">Blaze Protocol Interface</h1>
                            <p className="text-muted-foreground">
                                Test the functions of the blaze-signer Clarity smart contract
                            </p>
                        </div>
                        <div className="p-3 rounded-md border border-border text-sm bg-muted/30 min-w-[260px] text-center md:text-right">
                            <span className="font-medium font-mono">{BLAZE_SIGNER_CONTRACT}</span>
                        </div>
                    </div>

                    {/* Mobile Navigation */}
                    <div className="md:hidden mb-8">
                        <Tabs
                            tabs={tabs.map(tab => ({
                                id: tab.id,
                                label: tab.label,
                                content: null
                            }))}
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            variant="pills"
                            size="sm"
                            alignment="center"
                        />
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