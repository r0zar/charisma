"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import { useSwap } from "@/hooks/useSwap";
import { PurchaseDialog } from "./checkout";
import TokenDropdown from "@/components/TokenDropdown";
import { CHARISMA_TOKEN_SUBNET } from "@/lib/constants";
import { callReadOnlyFunction } from "@repo/polyglot";
import { getTokenMetadataCached } from "@repo/tokens";

export function TokenPurchaseForm() {
    const [usdAmount, setUsdAmount] = useState("5");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    const {
        displayTokens,
        selectedToToken,
        setSelectedToToken,
        tokenPrices,
        userAddress,
    } = useSwap();

    // set selected token to charisma token
    useEffect(() => {
        getTokenMetadataCached(CHARISMA_TOKEN_SUBNET).then(token => {
            setSelectedToToken(token as any);
        });
    }, [displayTokens]);

    const selectedPrice =
        selectedToToken && tokenPrices[selectedToToken.contractId];

    const tokenAmount =
        selectedPrice && parseFloat(usdAmount)
            ? Math.floor((parseFloat(usdAmount) / selectedPrice) * 10 ** selectedToToken.decimals)
            : 0;

    const handleCheckout = async () => {
        if (!selectedToToken || !userAddress || !usdAmount) return;

        // Construct metadata object
        const purchaseMetadata = {
            userId: userAddress, // STX Address
            selectedTokenContractId: selectedToToken.contractId,
            selectedTokenSymbol: selectedToToken.symbol,
            selectedTokenName: selectedToToken.name, // Assuming selectedToToken has a 'name' property
            selectedTokenDecimals: selectedToToken.decimals.toString(),
            usdAmount: usdAmount, // Original string value, e.g., "50"
            calculatedTokenAmount: tokenAmount,
            fiatCurrency: "USD", // Assuming USD, make dynamic if needed
            // Add any other relevant form values here
        };

        const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            body: JSON.stringify({
                // Core fields your endpoint expects
                userId: userAddress,
                tokenAmount: tokenAmount, // For display or core logic
                tokenType: selectedToToken.contractId, // Changed from symbol to contractId
                amount: parseFloat(usdAmount) * 100, // Amount in cents for Stripe

                // The metadata object
                metadata: purchaseMetadata,
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await res.json();
        if (data?.clientSecret) {
            setClientSecret(data.clientSecret);
            setDialogOpen(true);
        }
    };

    return (
        <>
            <div className="m-2 space-y-5">
                <h2 className="text-xl font-semibold">Buy Tokens with USD</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm mb-1 block">USD Amount</label>
                        <input
                            type="number"
                            value={usdAmount}
                            onChange={(e) => setUsdAmount(e.target.value)}
                            className="input-field"
                            min={1}
                            max={20}
                            step={1}
                        />
                    </div>
                    <div>
                        <label className="text-sm mb-1 block">Token</label>
                        <TokenDropdown
                            tokens={[selectedToToken as any]}
                            selected={selectedToToken}
                            onSelect={setSelectedToToken}
                            label=""
                        />
                    </div>
                </div>
                <div className="text-sm text-muted-foreground">
                    You'll receive approx{" "}
                    <span className="text-foreground font-semibold">
                        {tokenAmount / 10 ** selectedToToken?.decimals!} {selectedToToken?.symbol}
                    </span>
                </div>
                <Button className="button-primary w-full" onClick={handleCheckout}>
                    Continue to Checkout
                </Button>
            </div>

            {/* Checkout Dialog */}
            {clientSecret && selectedToToken && (
                <PurchaseDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    amountUsd={parseFloat(usdAmount)}
                    tokenAmount={tokenAmount}
                    tokenSymbol={selectedToToken.symbol}
                    userAddress={userAddress}
                    tokenContract={selectedToToken.contractId}
                    tokenDecimals={selectedToToken.decimals}
                />
            )}
        </>
    );
}
