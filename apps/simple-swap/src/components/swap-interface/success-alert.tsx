"use client";

import React from 'react';
import { useSwapContext } from '../../contexts/swap-context';

// Helper function to get explorer URL
const getExplorerUrl = (txId: string) => {
    // You can switch this to mainnet or testnet as appropriate
    return `https://explorer.stacks.co/txid/${txId}`;
};

export default function SuccessAlert() {
    const { swapSuccessInfo } = useSwapContext();

    if (!swapSuccessInfo) {
        return null;
    }

    return (
        <div className="mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-700 dark:text-green-400 animate-[appear_0.3s_ease-out]">
            <div className="flex items-start space-x-3">
                <div className="h-6 w-6 flex-shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mt-0.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold mb-1">Swap Successful</h4>
                    <p className="text-xs mb-1.5">Your transaction has been broadcast to the Stacks blockchain.</p>
                    <div className="flex items-center space-x-1 text-xs">
                        <span className="text-muted-foreground">View on explorer:</span>
                        <a
                            href={getExplorerUrl(swapSuccessInfo.txid!)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/90 hover:underline flex items-center font-medium"
                        >
                            {swapSuccessInfo.txid?.substring(0, 8)}...{swapSuccessInfo.txid?.substring(swapSuccessInfo.txid.length - 6)}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
} 