"use client"

import React, { useState } from "react"
import { STACKS_MAINNET } from "@stacks/network"
import { WalletConnector } from "./wallet-connector"
import { HashGenerator } from "./hash-generator"
import { UuidChecker } from "./uuid-checker"
import { SignatureVerifier } from "./signature-verifier"
import { Tabs } from "@repo/ui/tabs"
import { VerifySignature } from "./verify-signature"
import { SubmitSignature } from "./submit-signature"
import { WelshCreditsInterface } from "./welsh-credits"
import { DeployContractForm } from "./deploy-contract-form"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"

// Default to testnet for development
const defaultNetwork = STACKS_MAINNET

export function BlazeSignerInterface() {
    const [walletStatus, setWalletStatus] = useState({
        connected: false,
        address: "",
        publicKey: ""
    })
    const [network] = useState(defaultNetwork)
    const [activeTab, setActiveTab] = useState('signatures')

    const tabs = [
        {
            id: 'signatures',
            label: 'Signatures',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted mb-2">
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
                    <p className="text-sm text-muted mb-2">
                        Submit a previously generated and signed message (hash + signature) to the main Blaze Signer contract.
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
            label: 'UUID Checker',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-muted mb-2">
                        Check if a specific UUID has already been processed by the Blaze Signer contract.
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
                    <p className="text-sm text-muted mb-2">
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
        // {
        //     id: 'deploy',
        //     label: 'Deploy Contract',
        //     content: (
        //         <div className="space-y-4">
        //             <DeployContractForm
        //                 network={network}
        //                 isWalletConnected={walletStatus.connected}
        //             />
        //         </div>
        //     )
        // }
    ]

    return (
        <div className="container py-8">
            <div className="space-y-8">
                <div className="text-center space-y-4">
                    <h1 className="text-3xl font-bold">Blaze Signer Test Interface</h1>
                    <p className="text-muted">
                        This interface allows you to test the functions of the blaze-signer Clarity smart contract.
                    </p>
                    <div className="result-box text-sm">
                        Active Signer Contract: {BLAZE_SIGNER_CONTRACT}
                    </div>
                </div>

                <WalletConnector
                    onWalletUpdate={setWalletStatus}
                />

                <Tabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </div>
        </div>
    )
} 