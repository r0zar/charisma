"use client";

import React, { useState } from "react";
import { Asset as OtcAsset, TokenDef } from "@/types/otc";
import TokenDropdown from "@/components/TokenDropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Info, AlertCircle, ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/wallet-context";
import { IntentInput, signIntentWithWallet } from "blaze-sdk";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from 'next/navigation';
import Image from "next/image";

interface Props {
    subnetTokens: TokenDef[];
}

const toAtomicString = (amountStr: string, decimals: number): string => {
    if (!amountStr || isNaN(parseFloat(amountStr)) || !Number.isInteger(decimals) || decimals < 0) {
        console.error("Invalid input for toAtomicString", { amountStr, decimals });
        return "0";
    }
    const [integer, fraction = ""] = amountStr.split(".");
    const BIGNUMBER_SCALING_FACTOR = BigInt(10 ** decimals);

    let total = BigInt(0);
    if (integer) {
        total += BigInt(integer) * BIGNUMBER_SCALING_FACTOR;
    }
    if (fraction) {
        const numericallyScaledFraction = parseFloat("0." + fraction) * (10 ** decimals);
        total += BigInt(Math.round(numericallyScaledFraction));
    }
    return total.toString();
};

export default function EnhancedOfferForm({ subnetTokens }: Props) {
    const { address: stxAddress } = useWallet();
    const router = useRouter();
    const [offerAssets, setOfferAssets] = useState<OtcAsset[]>([
        { token: "", amount: "" },
    ]);
    const [isSigning, setIsSigning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    /* Add/remove/update row helpers */
    const addRow = () => {
        setOfferAssets((rows) => [...rows, { token: "", amount: "" }]);
    };

    const removeRow = (idx: number) => {
        setOfferAssets((rows) => rows.filter((_, i) => i !== idx));
    };

    const updateRow = (
        idx: number,
        field: "token" | "amount",
        value: string,
    ) => {
        setOfferAssets((rows) => {
            const next = [...rows];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const isValid = () => {
        if (!stxAddress) return false;
        return offerAssets.every((r) => {
            const tokenInfo = subnetTokens.find(t => t.id === r.token);
            if (!tokenInfo) return false;
            const amount = parseFloat(r.amount);
            return amount > 0 && !isNaN(amount);
        });
    };

    /* Handle form submission */
    const postOffer = async () => {
        if (!isValid()) {
            if (!stxAddress) {
                toast.error("Please connect your wallet first.");
            } else {
                toast.error("Complete every row with valid amounts before submitting.");
            }
            return;
        }

        if (!signIntentWithWallet || !stxAddress) {
            toast.error("Wallet not available. Please connect or refresh.");
            return;
        }

        setIsSigning(true);
        try {
            const signedOfferAssets = [];

            for (const asset of offerAssets) {
                const tokenInfo = subnetTokens.find(t => t.id === asset.token);
                if (!tokenInfo) {
                    throw new Error(`Token details not found for ${asset.token}`);
                }

                const atomicAmountStr = toAtomicString(asset.amount, tokenInfo.decimals);
                const numericAtomicAmount = parseInt(atomicAmountStr, 10);
                if (isNaN(numericAtomicAmount)) {
                    throw new Error(`Failed to convert amount to atomic units for ${tokenInfo.name}`);
                }

                const assetIntentUuid = uuidv4();
                const intentInput: IntentInput = {
                    intent: "REDEEM_BEARER",
                    contract: asset.token,
                    amount: numericAtomicAmount,
                    uuid: assetIntentUuid,
                };

                const signedResult = await signIntentWithWallet(intentInput);
                signedOfferAssets.push({
                    token: asset.token,
                    amount: atomicAmountStr,
                    intentUuid: assetIntentUuid,
                    signature: signedResult.signature,
                });
            }

            setIsSigning(false);
            setIsSubmitting(true);

            const payload = {
                offerCreatorAddress: stxAddress,
                offerAssets: signedOfferAssets,
            };

            const res = await fetch("/api/v1/otc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (json.success && json.offer && json.offer.intentUuid) {
                toast.success("Offer created successfully!", {
                    action: <Button onClick={() => router.push(`/shop/${json.offer.intentUuid}`)}>View Offer</Button>,
                });
                router.push(`/shop/${json.offer.intentUuid}`);
            } else {
                throw new Error(json.error || "Failed to create offer. API returned an error.");
            }
        } catch (err: any) {
            console.error("Error creating offer:", err);
            toast.error(err.message || "An unexpected error occurred while creating the offer.");
        } finally {
            setIsSigning(false);
            setIsSubmitting(false);
        }
    };

    /* row component */
    const RowGroup = () => (
        <div className="space-y-4">
            {offerAssets.map((row, idx) => {
                const selectedTokenInfo = subnetTokens?.find((t) => t.id === row.token);

                // Prepare tokens for the dropdown
                const dropdownTokens = subnetTokens.map(st => ({
                    ...st,
                    contractId: st.id,
                    type: "SUBNET"
                }));
                const currentSelectedForDropdown = dropdownTokens?.find(t => t.id === row.token) ?? null;

                return (
                    <div key={idx} className="flex flex-col p-4 rounded-xl border border-border/60 bg-muted/5 relative">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium">Asset {idx + 1}</h4>
                            {offerAssets.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => removeRow(idx)}
                                >
                                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1.5">Token</label>
                                <TokenDropdown
                                    tokens={dropdownTokens}
                                    selected={currentSelectedForDropdown}
                                    onSelect={(t: any) => updateRow(idx, "token", t.id)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-muted-foreground mb-1.5">Amount</label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="text"
                                        placeholder="0.0"
                                        value={row.amount}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
                                                updateRow(idx, "amount", value);
                                            }
                                        }}
                                        className="flex-1"
                                    />
                                    {selectedTokenInfo && (
                                        <div className="bg-muted/30 px-2 py-1.5 rounded border border-border/50 text-sm text-muted-foreground min-w-16 text-center">
                                            {selectedTokenInfo.symbol}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {selectedTokenInfo && selectedTokenInfo.logo && (
                            <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-muted/20 text-xs text-muted-foreground">
                                <Image src={selectedTokenInfo.logo} width={20} height={20} alt={selectedTokenInfo.name} className="h-5 w-5 rounded-full" />
                                <span>Selected: {selectedTokenInfo.name} ({selectedTokenInfo.symbol})</span>
                            </div>
                        )}
                    </div>
                );
            })}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="mt-2 w-full flex items-center justify-center"
            >
                <Plus className="h-4 w-4 mr-2" /> Add another asset
            </Button>
        </div>
    );

    /* Preview section */
    const Preview = () => {
        if (!offerAssets.some(asset => asset.token && asset.amount)) {
            return null;
        }

        return (
            <div className="mt-6 pt-6 border-t border-border">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium">Offer Preview</h4>
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                        Will be publicly visible
                    </Badge>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-muted/5">
                    <h5 className="text-sm font-medium mb-3">You are offering:</h5>

                    {offerAssets.map((asset, idx) => {
                        if (!asset.token || !asset.amount) return null;
                        const tokenInfo = subnetTokens.find(t => t.id === asset.token);
                        if (!tokenInfo) return null;

                        return (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 mb-2">
                                {tokenInfo.logo ? (
                                    <Image src={tokenInfo.logo} width={24} height={24} alt={tokenInfo.name} className="h-6 w-6 rounded-full" />
                                ) : (
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                        {tokenInfo.symbol.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <div className="font-medium">{asset.amount} {tokenInfo.symbol}</div>
                                    <div className="text-xs text-muted-foreground">{tokenInfo.name}</div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowRightCircle className="h-3.5 w-3.5 text-primary/70" />
                        <span>Open for bids</span>
                    </div>
                </div>
            </div>
        );
    };

    const isLoading = isSigning || isSubmitting;
    let buttonText = "Create Offer";
    if (isSigning) buttonText = "Signing...";
    if (isSubmitting) buttonText = "Creating Offer...";

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Create a New Offer</CardTitle>
                <CardDescription>
                    Specify what tokens you want to offer for trading. Others can place bids which you can accept or reject.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-sm font-medium mb-3">You are offering:</h3>
                    <RowGroup />
                </div>

                <Preview />

                <Alert variant="info" className="mt-4 flex items-start gap-2">

                    <Info className="h-4 w-4" />
                    <div>
                        <AlertTitle>How it works</AlertTitle>
                        <AlertDescription className="text-xs mt-1">
                            After creating your offer, other users can place bids with tokens they're willing to trade.
                            You'll then be able to review and accept the best bid for your offer.
                        </AlertDescription>
                    </div>
                </Alert>

                <Button
                    onClick={postOffer}
                    disabled={isLoading || !isValid()}
                    className="w-full"
                >
                    {isLoading && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    {buttonText}
                </Button>
            </CardContent>
        </Card>
    );
}