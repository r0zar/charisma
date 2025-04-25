import React, { useState } from "react"
import { type StacksNetwork } from "@stacks/network"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BalanceDisplay } from "./balance-display"
import { TransferForm } from "./transfer-form"
import { DepositForm } from "./deposit-form"
import { WithdrawForm } from "./withdraw-form"
import { TokenSubnetMessages } from "./token-subnet-messages"

interface TokenInterfaceProps {
    network: StacksNetwork
    walletAddress: string
    isWalletConnected: boolean
    contractId: string
    tokenName: string
    tokenSymbol: string
    decimals?: number
    customComponents?: React.ReactNode
}

type OperationType = "transfer" | "deposit" | "withdraw"

export function TokenInterface({
    network,
    walletAddress,
    isWalletConnected,
    contractId,
    tokenName,
    tokenSymbol,
    decimals = 6,
    customComponents
}: TokenInterfaceProps) {
    const [operation, setOperation] = useState<OperationType>("transfer")

    if (!isWalletConnected) {
        return (
            <Card className="p-6">
                <div className="text-center text-muted-foreground">
                    Please connect your wallet to interact with {tokenName}
                </div>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <BalanceDisplay
                contractId={contractId}
                walletAddress={walletAddress}
                tokenSymbol={tokenSymbol}
                decimals={decimals}
            />

            <div>
                <h2 className="mb-4 text-lg font-semibold">Basic Operations</h2>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Button
                                variant={operation === "transfer" ? "default" : "outline"}
                                onClick={() => setOperation("transfer")}
                            >
                                Transfer
                            </Button>
                            <Button
                                variant={operation === "deposit" ? "default" : "outline"}
                                onClick={() => setOperation("deposit")}
                            >
                                Deposit
                            </Button>
                            <Button
                                variant={operation === "withdraw" ? "default" : "outline"}
                                onClick={() => setOperation("withdraw")}
                            >
                                Withdraw
                            </Button>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {operation === "transfer" && `Transfer ${tokenName}`}
                                {operation === "deposit" && `Deposit ${tokenName}`}
                                {operation === "withdraw" && `Withdraw ${tokenName}`}
                            </CardTitle>
                            <CardDescription>
                                {operation === "transfer" && `Send ${tokenSymbol} to another address`}
                                {operation === "deposit" && `Deposit ${tokenSymbol} to your account`}
                                {operation === "withdraw" && `Withdraw ${tokenSymbol} from your account`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {operation === "transfer" && (
                                <TransferForm
                                    contractId={contractId}
                                    tokenSymbol={tokenSymbol}
                                    decimals={decimals}
                                />
                            )}
                            {operation === "deposit" && (
                                <DepositForm
                                    contractId={contractId}
                                    tokenSymbol={tokenSymbol}
                                    decimals={decimals}
                                />
                            )}
                            {operation === "withdraw" && (
                                <WithdrawForm
                                    contractId={contractId}
                                    tokenSymbol={tokenSymbol}
                                    decimals={decimals}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div>
                <h2 className="mb-4 text-lg font-semibold">Off-chain Message Signing</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                    Generate and sign intent messages for off-chain token operations that can be submitted to the subnet
                </p>
                <TokenSubnetMessages
                    network={network}
                    isWalletConnected={isWalletConnected}
                    walletAddress={walletAddress}
                    contractId={contractId}
                />
            </div>

            {customComponents}
        </div>
    )
} 