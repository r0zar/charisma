"use client";

import React from 'react';
import { Button } from '../ui/button';
import { ClockArrowUp, Repeat, Loader2 } from 'lucide-react';
import { useOrderConditions } from '@/contexts/order-conditions-context';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { convertToMicroUnits } from '@/lib/swap-utils';
import { useWallet } from '@/contexts/wallet-context';
import { toast } from 'sonner';

export default function OrderButton() {
    const { createOrder, isCreatingOrder, isValidTriggers } = useOrderConditions();
    const { 
        mode, 
        displayAmount, 
        triggerValidationAlert, 
        setIsDcaDialogOpen,
        selectedFromToken,
        selectedToToken,
        useSubnetFrom,
        useSubnetTo,
        subnetDisplayTokens
    } = useSwapTokens();
    const { address: walletAddress } = useWallet();
    
    // Helper function to get the contract ID to use for a token based on subnet toggle
    const getContractIdForToken = (token: any, useSubnet: boolean): string | null => {
        if (!token) return null;
        
        // If we want subnet and token is mainnet, find subnet version
        if (useSubnet && token.type !== 'SUBNET') {
            const subnetVersion = subnetDisplayTokens.find(t => t.base === token.contractId);
            return subnetVersion?.contractId || token.contractId;
        }
        
        return token.contractId;
    };

    // Button should be disabled if creating order, no required data, or invalid triggers
    const isDisabled = isCreatingOrder || 
                      !displayAmount || 
                      displayAmount === "0" || 
                      displayAmount.trim() === "" ||
                      !selectedFromToken ||
                      !selectedToToken ||
                      !walletAddress ||
                      (mode === 'order' && !isValidTriggers);

    const handleClick = async () => {
        if (isDisabled) {
            triggerValidationAlert('order');
            return;
        }

        if (!selectedFromToken || !selectedToToken || !walletAddress) {
            triggerValidationAlert('order');
            return;
        }

        try {
            const fromContractId = getContractIdForToken(selectedFromToken, useSubnetFrom);
            const toContractId = getContractIdForToken(selectedToToken, useSubnetTo);
            
            if (!fromContractId || !toContractId) {
                throw new Error('Unable to determine contract IDs');
            }

            const microAmount = convertToMicroUnits(displayAmount, selectedFromToken.decimals || 6);

            // Show loading toast
            toast.loading('Creating Order', {
                description: (
                    <div className="space-y-1">
                        <div className="text-white/90 font-medium">Processing your swap request</div>
                        <div className="text-white/70 text-sm font-mono">
                            {displayAmount} {selectedFromToken.symbol} → {selectedToToken.symbol}
                        </div>
                    </div>
                ),
                duration: Infinity,
                id: 'order-creation',
                className: "bg-white/[0.02] border-white/[0.08] text-white backdrop-blur-sm"
            });

            await createOrder({
                fromToken: fromContractId,
                toToken: toContractId,
                amountIn: microAmount,
                walletAddress
            });

            // Success toast is handled by SwapInterfaceContent
            toast.dismiss('order-creation');

        } catch (error) {
            console.error('Order creation failed:', error);
            
            // Show error toast
            const errorMessage = error instanceof Error ? error.message : 'Order creation failed';
            toast.error('Order Creation Failed', {
                description: errorMessage,
                duration: 5000,
                id: 'order-creation'
            });
        }
    };

    const handleDcaClick = () => {
        if (isDisabled) {
            triggerValidationAlert('order');
            return;
        }
        setIsDcaDialogOpen(true);
    };

    return (
        <div className="mt-6">
            <div className="flex w-full shadow-lg">
                <Button
                    onClick={handleClick}
                    className={`relative flex-1 rounded-r-none bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 font-semibold overflow-hidden transition-transform focus:outline-none rounded-l-xl ${
                        isDisabled 
                            ? 'opacity-70 cursor-pointer hover:opacity-80'
                            : 'hover:brightness-110 active:scale-95'
                    }`}
                >
                    <span className="absolute inset-0 opacity-10 animate-pulse" />
                    <span className="relative z-10 flex items-center justify-center">
                        {isCreatingOrder ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating Order...
                            </>
                        ) : (
                            <>
                                <ClockArrowUp className="w-4 h-4 mr-2" />
                                Create Swap Order
                            </>
                        )}
                    </span>
                </Button>

                {/* DCA trigger button */}
                <Button
                    className={`relative w-12 h-auto rounded-l-none bg-gradient-to-r from-purple-700 to-purple-800 text-white overflow-hidden transition-transform focus:outline-none rounded-r-xl border-l border-white/20 ${
                        isDisabled
                            ? 'opacity-70 cursor-pointer hover:opacity-80'
                            : 'hover:brightness-110 active:scale-95'
                    }`}
                    title="Create DCA orders"
                    onClick={handleDcaClick}
                >
                    <Repeat className="w-5 h-5" />
                </Button>
            </div>
        </div>
    );
} 