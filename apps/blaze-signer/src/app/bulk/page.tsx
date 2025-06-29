'use client'

import React from 'react'
import { STACKS_MAINNET } from '@stacks/network'
import { BulkSignatureGenerator } from '@/components/blaze-signer/bulk-signature-generator'

export default function BulkPage() {
    return (
        <div className="container py-8 mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Money Printer</h1>
                <p className="text-muted-foreground">
                    Generate multiple bearer notes with unique UUIDs in one operation using a private key.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="rounded-lg border bg-card text-card-foreground shadow p-4">
                    <div className="text-sm text-amber-600 dark:text-amber-500 mb-4 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-md flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 flex-shrink-0">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                            <path d="M12 9v4"></path>
                            <path d="M12 17h.01"></path>
                        </svg>
                        <span>
                            <strong>Security Warning:</strong> Your private key should be kept secure. This tool processes your key locally in your browser and never transmits it to any server, but you should still be careful. Ideally, use a temporary or dedicated key for bulk signing.
                        </span>
                    </div>

                    <BulkSignatureGenerator network={STACKS_MAINNET} />
                </div>
            </div>

            <div className="mt-8 text-sm text-muted-foreground p-4 border rounded-md bg-muted/20">
                <h3 className="text-base font-medium mb-2">About Bulk Signatures</h3>
                <p className="mb-2">
                    This tool allows you to create multiple "bearer-redeem" notes that can be redeemed for tokens. Each note:
                </p>
                <ul className="list-disc pl-5 space-y-1 mb-2">
                    <li>Has a unique UUID to prevent double-spending</li>
                    <li>Contains the same amount of tokens</li>
                    <li>Is signed with your private key</li>
                    <li>Can be redeemed by anyone who has the full signature data</li>
                </ul>
                <p>
                    Use the exported CSV or JSON data for distribution or integration with other systems. The bearer notes can be redeemed through the standard redeem interface.
                </p>
            </div>
        </div>
    )
} 