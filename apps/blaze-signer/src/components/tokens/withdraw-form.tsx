"use client"

import React, { useState } from "react"
import { request } from "@stacks/connect"
import { noneCV, uintCV } from "@stacks/transactions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Form, FormItem, FormLabel, FormControl, FormField, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

const formSchema = z.object({
    amount: z.string()
        .min(1, "Amount is required")
        .refine(val => !isNaN(Number(val)) && Number(val) > 0, {
            message: "Amount must be a positive number"
        })
})

type FormValues = z.infer<typeof formSchema>

interface WithdrawFormProps {
    contractId: string
    tokenSymbol: string
    decimals?: number
}

type WithdrawError = {
    type: 'error'
    message: string
}

type WithdrawSuccess = {
    type: 'success'
    txid: string
}

type WithdrawResult = WithdrawError | WithdrawSuccess | null

export function WithdrawForm({ contractId, tokenSymbol, decimals = 6 }: WithdrawFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [withdrawResult, setWithdrawResult] = useState<WithdrawResult>(null)

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: ""
        }
    })

    const onSubmit = async (values: FormValues) => {
        setIsSubmitting(true)
        setWithdrawResult(null)

        try {
            const [contractAddress, contractName] = contractId.split(".")
            if (!contractAddress || !contractName) {
                throw new Error("Invalid contract format")
            }

            const numericAmount = Number(values.amount) * Math.pow(10, decimals)

            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: "withdraw",
                functionArgs: [
                    uintCV(numericAmount),
                    noneCV()
                ],
                network: "mainnet",
            }

            const result = await request('stx_callContract', params) as any

            if (result && result.txid) {
                setWithdrawResult({
                    type: 'success',
                    txid: result.txid
                })
                toast.success("Withdrawal initiated", {
                    description: "Your withdrawal has been submitted to the network",
                })
            } else {
                const errorMessage = result?.error?.message || "Transaction failed or was rejected"
                throw new Error(`Withdrawal Failed: ${errorMessage}`)
            }
        } catch (error) {
            console.error("Error withdrawing tokens:", error)
            setWithdrawResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
            toast.error("Error", {
                description: "There was an error initiating the withdrawal",
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
                            <span>Withdrawing...</span>
                        </>
                    ) : (
                        `Withdraw ${tokenSymbol}`
                    )}
                </Button>

                {withdrawResult && (
                    <div className="mt-4 p-4 rounded-md border">
                        <p className="text-sm font-medium mb-1">Withdrawal Result</p>
                        <div className="font-mono text-sm break-all">
                            {withdrawResult.type === 'error' ? (
                                <span className="text-destructive">{withdrawResult.message}</span>
                            ) : (
                                <span className="text-primary">TxID: {withdrawResult.txid}</span>
                            )}
                        </div>
                    </div>
                )}
            </form>
        </Form>
    )
} 