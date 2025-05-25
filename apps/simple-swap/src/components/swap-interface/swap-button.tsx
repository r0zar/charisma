"use client";

import React from 'react';
import { Button } from '../ui/button';
import { useSwapContext } from '../../contexts/swap-context';

export default function SwapButton() {
    // Get swap state from context
    const {
        quote,
        isLoadingQuote,
        selectedFromToken,
        selectedToToken,
        displayAmount,
        handleSwap,
        swapping,
    } = useSwapContext();

    const isDisabled = !quote || isLoadingQuote || swapping;
    const showShimmer = !isLoadingQuote && !swapping && quote && selectedFromToken && selectedToToken && displayAmount && displayAmount !== "0";

    // Determine if this is a subnet shift operation
    const isSubnetShift = quote?.hops.some((hop: any) =>
        hop.vault.type === 'SUBLINK'
    );

    // Determine shift direction for button text
    const getShiftDirection = () => {
        if (!isSubnetShift || !selectedToToken) return null;
        return selectedToToken.type === 'SUBNET' ? 'to-subnet' : 'from-subnet';
    };

    const shiftDirection = getShiftDirection();

    let buttonContent;
    if (isLoadingQuote) {
        buttonContent = (
            <span className="flex items-center justify-center space-x-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Computing best route...</span>
            </span>
        );
    } else if (swapping) {
        buttonContent = (
            <span className="flex items-center justify-center space-x-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing transaction...</span>
            </span>
        );
    } else if (!selectedFromToken || !selectedToToken) {
        buttonContent = (
            <span className="flex items-center justify-center">
                <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                Select Tokens
            </span>
        );
    } else if (!displayAmount || displayAmount === "0") {
        buttonContent = (
            <span className="flex items-center justify-center">
                <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Enter Amount
            </span>
        );
    } else {
        buttonContent = (
            <span className="flex items-center justify-center">
                {isSubnetShift ? (
                    // Subnet shift icon and text
                    <>
                        <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 17l10-10M7 7h10v10" />
                        </svg>
                        {shiftDirection === 'to-subnet' ? 'Execute Subnet Deposit' : 'Execute Subnet Withdrawal'}
                    </>
                ) : (
                    // Normal swap icon and text
                    <>
                        <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="17 1 21 5 17 9"></polyline>
                            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                            <polyline points="7 23 3 19 7 15"></polyline>
                            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                        </svg>
                        Execute Instant Swap
                    </>
                )}
            </span>
        );
    }

    return (
        <Button
            disabled={isDisabled}
            onClick={handleSwap}
            className={`w-full py-3.5 rounded-xl font-medium text-white shadow-lg transition-all transform relative overflow-hidden ${isDisabled
                ? 'bg-primary/60 cursor-not-allowed opacity-70'
                : isSubnetShift
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-600 hover:to-purple-600 active:scale-[0.99]'
                    : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary/80 active:scale-[0.99]'
                }`}
        >
            {buttonContent}
            {showShimmer && (
                <div className="absolute top-0 right-0 bottom-0 left-0 opacity-10">
                    <div className="absolute inset-0 bg-white h-full w-1/3 blur-xl transform -skew-x-12 translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
            )}
        </Button>
    );
} 