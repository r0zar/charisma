"use client"

import React, { useState } from "react"
import { request } from "@stacks/connect"
import { noneCV, Pc, PostConditionMode, uintCV } from "@stacks/transactions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Form, FormItem, FormLabel, FormControl, FormField, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { getTokenMetadataCached } from "@/lib/token-cache-client"
import { useWallet } from "@/context/wallet-context"
import { CHARISMA_CREDITS_CONTRACT, CHARISMA_TOKEN_CONTRACT, WELSHCORGICOIN_CONTRACT } from "@/constants/contracts"

const formSchema = z.object({
    amount: z.string()
        .min(1, "Amount is required")
        .refine(val => !isNaN(Number(val)) && Number(val) > 0, {
            message: "Amount must be a positive number"
        })
})

type FormValues = z.infer<typeof formSchema>

interface DepositFormProps {
    contractId: string
    tokenSymbol: string
    decimals?: number
}

type DepositError = {
    type: 'error'
    message: string
}

type DepositSuccess = {
    type: 'success'
    txid: string
}

type DepositResult = DepositError | DepositSuccess | null

export function DepositForm({ contractId, tokenSymbol, decimals = 6 }: DepositFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [depositResult, setDepositResult] = useState<DepositResult>(null)

    const { address } = useWallet()

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: ""
        }
    })

    const onSubmit = async (values: FormValues) => {
        setIsSubmitting(true)
        setDepositResult(null)

        try {
            const [contractAddress, contractName] = contractId.split(".")
            if (!contractAddress || !contractName) {
                throw new Error("Invalid contract format")
            }

            const tokenContractId = contractId === CHARISMA_CREDITS_CONTRACT ? CHARISMA_TOKEN_CONTRACT : WELSHCORGICOIN_CONTRACT

            const tokenMetadata = await getTokenMetadataCached(tokenContractId)

            const numericAmount = Number(values.amount) * Math.pow(10, decimals)

            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: "deposit",
                functionArgs: [
                    uintCV(numericAmount),
                    noneCV()
                ],
                network: "mainnet",
                postConditions: [Pc.principal(address!).willSendEq(numericAmount).ft(tokenMetadata.contractId as any, tokenMetadata.identifier!)]
            } as any

            const result = await request('stx_callContract', params) as any

            if (result && result.txid) {
                setDepositResult({
                    type: 'success',
                    txid: result.txid
                })
                toast.success("Deposit initiated", {
                    description: "Your deposit has been submitted to the network",
                })
            } else {
                const errorMessage = result?.error?.message || "Transaction failed or was rejected"
                throw new Error(`Deposit Failed: ${errorMessage}`)
            }
        } catch (error) {
            console.error("Error depositing tokens:", error)
            setDepositResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
            toast.error("Error", {
                description: "There was an error initiating the deposit",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount ({tokenSymbol})</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="any"
                                        placeholder="0.00"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            <span>Depositing...</span>
                        </>
                    ) : (
                        `Deposit ${tokenSymbol}`
                    )}
                </Button>

                {depositResult && (
                    <div className="mt-4 p-4 rounded-md border">
                        <p className="text-sm font-medium mb-1">Deposit Result</p>
                        <div className="font-mono text-sm break-all">
                            {depositResult.type === 'error' ? (
                                <span className="text-destructive">{depositResult.message}</span>
                            ) : (
                                <span className="text-primary">TxID: {depositResult.txid}</span>
                            )}
                        </div>
                    </div>
                )}
            </form>
        </Form>
    )
} 