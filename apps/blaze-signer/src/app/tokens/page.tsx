"use client"

import React from "react"
import { STACKS_MAINNET, type StacksNetwork } from "@stacks/network"
import { TokenInterface } from "@/components/tokens/token-interface"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CHARISMA_CREDITS_CONTRACT, MALI_CREDITS_CONTRACT, WELSH_CREDITS_CONTRACT } from "@/constants/contracts"
import { useWallet } from "@/context/wallet-context"

export default function TokenSubnetsPage() {
    const network: StacksNetwork = STACKS_MAINNET;
    const { address, connected } = useWallet()

    return (
        <div className="container py-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Token Subnets</h1>
                <p className="text-muted-foreground">
                    Manage and interact with token subnets on the Stacks blockchain
                </p>
            </div>

            <Tabs defaultValue="charisma" className="w-full">
                <TabsList className="mb-6">
                    <TabsTrigger value="charisma">Charisma</TabsTrigger>
                    <TabsTrigger value="welsh">Welshcorgicoin</TabsTrigger>
                    <TabsTrigger value="mali">Belgian Malinois</TabsTrigger>
                </TabsList>

                <TabsContent value="charisma">
                    <TokenInterface
                        network={network}
                        walletAddress={address || ""}
                        isWalletConnected={connected}
                        contractId={CHARISMA_CREDITS_CONTRACT}
                        tokenName="Charisma"
                        tokenSymbol="CHA"
                    />
                </TabsContent>

                <TabsContent value="welsh">
                    <TokenInterface
                        network={network}
                        walletAddress={address || ""}
                        isWalletConnected={connected}
                        contractId={WELSH_CREDITS_CONTRACT}
                        tokenName="Welshcorgicoin"
                        tokenSymbol="WELSH"
                    />
                </TabsContent>

                <TabsContent value="mali">
                    <TokenInterface
                        network={network}
                        walletAddress={address || ""}
                        isWalletConnected={connected}
                        contractId={MALI_CREDITS_CONTRACT}
                        tokenName="Belgian Malinois"
                        tokenSymbol="MALi"
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
} 