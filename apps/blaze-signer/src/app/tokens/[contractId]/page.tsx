"use client"

import React from "react"
import { BalanceDisplay } from "@/components/tokens/balance-display"
import { TransferForm } from "@/components/tokens/transfer-form"
import { DepositForm } from "@/components/tokens/deposit-form"
import { WithdrawForm } from "@/components/tokens/withdraw-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { useWallet } from "@/context/wallet-context"

interface TokenPageProps {
    params: {
        contractId: string
    }
}

export default function TokenPage({ params }: TokenPageProps) {
    const { contractId } = params
    const { address } = useWallet()

    if (!address) {
        return (
            <Card className="p-6">
                <p className="text-center">Please connect your wallet to continue</p>
            </Card>
        )
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <BalanceDisplay
                contractId={contractId}
                walletAddress={address}
                tokenSymbol="TOKEN"
                decimals={6}
            />

            <Tabs defaultValue="transfer" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="transfer">Transfer</TabsTrigger>
                    <TabsTrigger value="deposit">Deposit</TabsTrigger>
                    <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                </TabsList>
                <TabsContent value="transfer">
                    <Card className="p-6">
                        <TransferForm
                            contractId={contractId}
                            tokenSymbol="TOKEN"
                            decimals={6}
                        />
                    </Card>
                </TabsContent>
                <TabsContent value="deposit">
                    <Card className="p-6">
                        <DepositForm
                            contractId={contractId}
                            tokenSymbol="TOKEN"
                            decimals={6}
                        />
                    </Card>
                </TabsContent>
                <TabsContent value="withdraw">
                    <Card className="p-6">
                        <WithdrawForm
                            contractId={contractId}
                            tokenSymbol="TOKEN"
                            decimals={6}
                        />
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
} 