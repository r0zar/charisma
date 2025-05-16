"use client";

import React, { useState } from "react";
import { Asset, TokenDef } from "@/types/otc";
import { Offer } from "@/lib/otc/schema";
import TokenDropdown from "@/components/TokenDropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ArrowRightCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/wallet-context";
import { IntentInput, signIntentWithWallet } from "blaze-sdk";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from 'next/navigation';
import TokenLogo from "@/components/TokenLogo";

interface Props {
    intentUuid: string;
    subnetTokens: TokenDef[];
    offer: Offer;
    onBidPlaced?: () => void;
}

const toAtomicString = (amountStr: string, decimals: number): string => {
    return (Number(amountStr) * 10 ** decimals).toString();
};

// Helper to format token amount
const formatTokenAmount = (atomicAmount: string, tokenInfo: TokenDef | undefined): string => {
    if (!tokenInfo) return atomicAmount + " (atomic)";
    const amount = parseInt(atomicAmount) / 10 ** tokenInfo.decimals;
    return amount.toLocaleString(undefined, {
        maximumFractionDigits: tokenInfo.decimals,
        minimumFractionDigits: Math.min(tokenInfo.decimals, 2),
    }) + ` ${tokenInfo.symbol}`;
};

export default function EnhancedBidForm({ intentUuid, subnetTokens, offer, onBidPlaced }: Props) {
    const router = useRouter();
    const { address: stxAddress } = useWallet();
    const [bidAsset, setBidAsset] = useState<Asset>({ token: "", amount: "" });
    const [isSigning, setIsSigning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedTokenInfo = subnetTokens?.find(t => t.id === bidAsset.token);

    const dropdownTokens = subnetTokens.map(td => ({
        ...td,
        contractId: td.id,
        type: "SUBNET"
    }));

    const updateBidAsset = (field: "token" | "amount", value: string) => {
        setBidAsset((prev) => ({ ...prev, [field]: value }));
    };

    const isValid = () => {
        if (!stxAddress) return false;
        if (!bidAsset.token || !bidAsset.amount) return false;
        const tokenInfo = subnetTokens.find(t => t.id === bidAsset.token);
        if (!tokenInfo) return false;
        const amountNum = parseFloat(bidAsset.amount);
        return amountNum > 0 && !isNaN(amountNum);
    };

    const placeBid = async () => {
        if (!isValid()) {
            if (!stxAddress) {
                toast.error("Please connect your wallet to place a bid.");
            } else {
                toast.error("Please select a token and enter a valid amount for your bid.");
            }
            return;
        }

        if (!signIntentWithWallet) {
            toast.error("Signing function is not available. Please try again.");
            return;
        }

        if (!selectedTokenInfo) {
            toast.error("Selected token details not found.");
            return;
        }

        setIsSigning(true);
        try {
            const atomicBidAmountStr = toAtomicString(bidAsset.amount, selectedTokenInfo.decimals);
            const numericAtomicBidAmount = parseInt(atomicBidAmountStr, 10);

            if (isNaN(numericAtomicBidAmount)) {
                throw new Error(`Failed to convert bid amount to atomic units for ${selectedTokenInfo.name}`);
            }

            const bidderSideIntentUuid = uuidv4();
            const intentInputForBidAsset: IntentInput = {
                intent: "TRANSFER_TOKENS",
                contract: bidAsset.token,
                amount: numericAtomicBidAmount,
                uuid: bidderSideIntentUuid,
                target: offer.offerCreatorAddress,
            };

            const signedBidIntent = await signIntentWithWallet(intentInputForBidAsset);
            setIsSigning(false);
            setIsSubmitting(true);

            const payload = {
                originalOfferIntentUuid: intentUuid,
                bidderAddress: stxAddress!,
                bidAssets: [{ token: bidAsset.token, amount: atomicBidAmountStr }],
                bidSignature: signedBidIntent.signature,
                bidderSideIntentUuid: bidderSideIntentUuid,
            };

            const res = await fetch(`/api/v1/otc/bid`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (json.success) {
                toast.success("Bid placed successfully!");
                router.refresh();
                onBidPlaced?.();
                setBidAsset({ token: "", amount: "" });
            } else {
                throw new Error(json.error || "API failed to process the bid.");
            }
        } catch (err: any) {
            console.error("Error placing bid:", err);
            toast.error(err.message || "Failed to place bid due to an unexpected error.");
        } finally {
            setIsSigning(false);
            setIsSubmitting(false);
        }
    };

    // For preview - get offer asset info for display
    const getOfferAssetDisplay = () => {
        // Since we're only showing the first offered asset in this preview
        if (!offer.offerAssets || offer.offerAssets.length === 0) return null;

        const offerAsset = offer.offerAssets[0];
        const tokenInfo = subnetTokens.find(t => t.id === offerAsset.token);

        if (!tokenInfo) return null;

        return {
            amount: formatTokenAmount(offerAsset.amount, tokenInfo),
            symbol: tokenInfo.symbol,
            logo: tokenInfo.logo
        };
    };

    const isLoading = isSigning || isSubmitting;
    let buttonText = "Place Bid";
    if (isSigning) buttonText = "Signing...";
    if (isSubmitting) buttonText = "Submitting...";

    const offerAssetDisplay = getOfferAssetDisplay();

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Place a Bid</CardTitle>
                <CardDescription>
                    Offer tokens in exchange for this offer. If the creator accepts your bid, the trade will be executed.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium mb-3">You are offering:</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1.5 block">Token</label>
                                <TokenDropdown
                                    tokens={dropdownTokens}
                                    selected={dropdownTokens.find((t) => t.contractId === bidAsset.token) ?? null}
                                    onSelect={(token) => updateBidAsset("token", token.contractId)}
                                />
                            </div>

                            <div>
                                <label className="text-xs text-muted-foreground mb-1.5 block">Amount</label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="text"
                                        placeholder="0.0"
                                        value={bidAsset.amount}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (/^[0-9]*\.?[0-9]*$/.test(v) || v === "") {
                                                updateBidAsset("amount", v);
                                            }
                                        }}
                                        disabled={isLoading}
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
                    </div>

                    {selectedTokenInfo && (
                        <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-muted/20 text-xs text-muted-foreground">
                            {selectedTokenInfo.logo ? (
                                <img src={selectedTokenInfo.logo} alt={selectedTokenInfo.name} className="h-5 w-5 rounded-full" />
                            ) : (
                                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-primary text-xs font-semibold">{selectedTokenInfo.symbol.charAt(0)}</span>
                                </div>
                            )}
                            <span>Selected: {selectedTokenInfo.name} ({selectedTokenInfo.symbol})</span>
                        </div>
                    )}
                </div>

                {/* Bid preview */}
                {bidAsset.token && bidAsset.amount && offerAssetDisplay && (
                    <div className="pt-4 border-t border-border">
                        <h3 className="text-sm font-medium mb-3">Bid Preview</h3>
                        <div className="p-4 rounded-xl border border-border/60 bg-muted/5">
                            <div className="flex justify-between items-center mb-3">
                                <div className="text-sm text-muted-foreground">You send:</div>
                                <div className="flex items-center gap-2">
                                    {selectedTokenInfo?.logo ? (
                                        <img src={selectedTokenInfo.logo} alt={selectedTokenInfo.symbol} className="h-5 w-5 rounded-full" />
                                    ) : (
                                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-primary text-xs font-semibold">{selectedTokenInfo?.symbol.charAt(0)}</span>
                                        </div>
                                    )}
                                    <span className="font-medium">{bidAsset.amount} {selectedTokenInfo?.symbol}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="text-sm text-muted-foreground">You receive:</div>
                                <div className="flex items-center gap-2">
                                    {offerAssetDisplay.logo ? (
                                        <img src={offerAssetDisplay.logo} alt={offerAssetDisplay.symbol} className="h-5 w-5 rounded-full" />
                                    ) : (
                                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-primary text-xs font-semibold">{offerAssetDisplay.symbol.charAt(0)}</span>
                                        </div>
                                    )}
                                    <span className="font-medium">{offerAssetDisplay.amount}</span>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground border-t border-border/40 pt-3">
                                <ArrowRightCircle className="h-3.5 w-3.5 text-primary/70" />
                                <span>Trade will execute if the offer creator accepts your bid</span>
                            </div>
                        </div>
                    </div>
                )}

                <Alert variant="info" className="mt-4 flex items-start gap-2">
                    <Info className="h-4 w-4" />
                    <div>

                        <AlertTitle>How it works</AlertTitle>
                        <AlertDescription className="text-xs mt-1">
                            When you place a bid, you're offering to swap your tokens for the offered tokens. If your bid is accepted,
                            a peer-to-peer swap will be executed automatically.
                        </AlertDescription>
                    </div>
                </Alert>
            </CardContent>
            <CardFooter>
                <Button
                    onClick={placeBid}
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
            </CardFooter>
        </Card>
    );
}