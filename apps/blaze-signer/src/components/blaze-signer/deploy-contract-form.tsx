"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import { Loader2 } from "@repo/ui/icons"
import { request } from "@stacks/connect"

interface DeployContractFormProps {
    network: StacksNetwork
    isWalletConnected: boolean
    className?: string
}

type FunctionResult = {
    type: 'success' | 'error'
    message: string
}

export function DeployContractForm({
    network,
    isWalletConnected,
    className
}: DeployContractFormProps) {
    // Deploy state
    const [contractCode, setContractCode] = useState("(define-public (hello (name (string-ascii 10))) (ok (concat \"hello \" name)))")
    const [contractName, setContractName] = useState("")
    const [isDeploying, setIsDeploying] = useState(false)
    const [deployResult, setDeployResult] = useState<FunctionResult | null>(null)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setter(e.target.value)
    }

    // Handle contract deployment
    const handleDeployContract = async () => {
        if (!isWalletConnected || !contractCode || !contractName) {
            setDeployResult({
                type: 'error',
                message: 'Connect wallet, provide contract code, and a contract name.'
            })
            return
        }

        setIsDeploying(true)
        setDeployResult(null)

        try {
            // Call the deploy function
            const result = await request('stx_deployContract', {
                name: contractName,
                clarityCode: contractCode,
                clarityVersion: 3
            });

            // Assuming successful broadcast if no error is thrown
            // The actual txId might be in the result, but the structure isn't clear from types
            console.log('Deploy result:', result); // Log result to inspect its structure
            setDeployResult({
                type: 'success',
                message: `Deployment transaction submitted. Check wallet for details.`
            })

        } catch (error) {
            console.error("Error deploying contract:", error)
            // Check if the error object indicates cancellation
            const errorString = String(error).toLowerCase();
            if (errorString.includes('cancelled') || errorString.includes('user rejected')) {
                setDeployResult({
                    type: 'error',
                    message: 'Deployment transaction was cancelled.'
                })
            } else {
                setDeployResult({
                    type: 'error',
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        } finally {
            setIsDeploying(false)
        }
    }

    return (
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Deploy Smart Contract</h2>
                <p className="card-description">
                    Paste your Clarity code and provide a name to deploy a new contract.
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="contract-name" className="label">Contract Name</label>
                        <input
                            id="contract-name"
                            className="input"
                            placeholder="e.g., my-awesome-contract"
                            value={contractName}
                            onChange={handleInputChange(setContractName)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="contract-code" className="label">Contract Code (Clarity)</label>
                        <textarea
                            id="contract-code"
                            className="input h-60 font-mono text-xs"
                            placeholder=";; Paste your Clarity code here..."
                            value={contractCode}
                            onChange={handleInputChange(setContractCode)}
                        />
                    </div>

                    <button
                        className="button w-full"
                        onClick={handleDeployContract}
                        disabled={isDeploying || !isWalletConnected || !contractCode || !contractName}
                    >
                        {isDeploying ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Deploying...
                            </>
                        ) : (
                            "Deploy Contract"
                        )}
                    </button>

                    {deployResult && (
                        <div className="result-box">
                            <p className="result-box-title">Result</p>
                            <div className="result-box-content">
                                <span className={deployResult.type === 'success' ? "text-primary" : "text-destructive"}>
                                    {deployResult.message}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 