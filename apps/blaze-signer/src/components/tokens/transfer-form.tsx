"use client"

import React, { useState } from "react"
import { request } from "@stacks/connect"
import { stringAsciiCV, uintCV, principalCV, noneCV } from "@stacks/transactions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Form, FormItem, FormLabel, FormControl, FormField, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useWallet } from "@/context/wallet-context"

const formSchema = z.object({
    recipient: z.string()
        .min(1, "Recipient address is required")
        .refine(val => val.startsWith('SP') || val.startsWith('ST'), {
            message: "Address should start with SP or ST"
        }),
    amount: z.string()
        .min(1, "Amount is required")
        .refine(val => !isNaN(Number(val)) && Number(val) > 0, {
            message: "Amount must be a positive number"
        })
})

type FormValues = z.infer<typeof formSchema>

interface TransferFormProps {
    contractId: string
    tokenSymbol: string
    decimals?: number
}

type TransferError = {
    type: 'error'
    message: string
}

type TransferSuccess = {
    type: 'success'
    txid: string
}

type TransferResult = TransferError | TransferSuccess | null

export function TransferForm({ contractId, tokenSymbol, decimals = 6 }: TransferFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [transferResult, setTransferResult] = useState<TransferResult>(null)
    const { address } = useWallet()

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            recipient: "",
            amount: ""
        }
    })

    const onSubmit = async (values: FormValues) => {
        setIsSubmitting(true)
        setTransferResult(null)

        try {
            const [contractAddress, contractName] = contractId.split(".")
            if (!contractAddress || !contractName) {
                throw new Error("Invalid contract format")
            }

            const numericAmount = Number(values.amount) * Math.pow(10, decimals)

            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: "transfer",
                functionArgs: [
                    uintCV(numericAmount),
                    principalCV(address!),
                    principalCV(values.recipient),
                    noneCV()
                ],
                network: "mainnet",
            }

            const result = await request('stx_callContract', params) as any

            if (result && result.txid) {
                setTransferResult({
                    type: 'success',
                    txid: result.txid
                })
                toast.success("Transfer initiated", {
                    description: "Your transfer has been submitted to the network",
                })
            } else {
                const errorMessage = result?.error?.message || "Transaction failed or was rejected"
                throw new Error(`Transfer Failed: ${errorMessage}`)
            }
        } catch (error) {
            console.error("Error transferring tokens:", error)
            setTransferResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
            toast.error("Error", {
                description: "There was an error initiating the transfer",
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
                        name="recipient"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Recipient Address</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="SP..."
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

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
                            <span>Transferring...</span>
                        </>
                    ) : (
                        `Transfer ${tokenSymbol}`
                    )}
                </Button>

                {transferResult && (
                    <div className="mt-4 p-4 rounded-md border">
                        <p className="text-sm font-medium mb-1">Transfer Result</p>
                        <div className="font-mono text-sm break-all">
                            {transferResult.type === 'error' ? (
                                <span className="text-destructive">{transferResult.message}</span>
                            ) : (
                                <span className="text-primary">TxID: {transferResult.txid}</span>
                            )}
                        </div>
                    </div>
                )}
            </form>
        </Form>
    )
} 