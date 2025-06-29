"use client";

import React, { useState, useEffect } from "react";
import { TokenDef } from "@/types/otc";
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
import { getTokenBalance } from "@/app/actions";

interface Props {
    subnetTokens: TokenDef[];
}

// Simple interface for asset with stable ID
interface OfferAssetWithId {
    id: string;
    token: string;
    amount: string;
}

const toAtomicString = (amountStr: string, decimals: number): string => {
    // Enhanced logging for debugging
    console.log("toAtomicString called with:", { amountStr, decimals, amountType: typeof amountStr, decimalsType: typeof decimals });

    if (!amountStr || amountStr.trim() === "") {
        console.error("Invalid input for toAtomicString: amountStr is empty or undefined", { amountStr, decimals });
        return "0";
    }

    if (isNaN(parseFloat(amountStr))) {
        console.error("Invalid input for toAtomicString: amountStr is not a valid number", { amountStr, decimals });
        return "0";
    }

    if (!Number.isInteger(decimals) || decimals < 0) {
        console.error("Invalid input for toAtomicString: decimals is not a valid integer", { amountStr, decimals });
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

    console.log("toAtomicString result:", total.toString());
    return total.toString();
};

export default function EnhancedOfferForm({ subnetTokens }: Props) {
    const { address: stxAddress, prices } = useWallet();
    const router = useRouter();
    const [offerAssets, setOfferAssets] = useState<OfferAssetWithId[]>([
        { id: uuidv4(), token: "", amount: "" },
    ]);
    const [isSigning, setIsSigning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
    const [loadingBalances, setLoadingBalances] = useState<Record<string, boolean>>({});

    // Helper function to get token balance from server
    const fetchTokenBalance = async (tokenId: string) => {
        if (!stxAddress || !tokenId || loadingBalances[tokenId]) return;

        setLoadingBalances(prev => ({ ...prev, [tokenId]: true }));
        try {
            const balance = await getTokenBalance(tokenId, stxAddress);
            const tokenInfo = subnetTokens.find(t => t.id === tokenId);

            // Parse decimals to ensure it's a valid number
            const decimals = typeof tokenInfo?.decimals === 'string'
                ? parseInt(tokenInfo.decimals, 10)
                : (tokenInfo?.decimals || 6);

            const humanReadableBalance = balance / Math.pow(10, decimals);

            setTokenBalances(prev => ({ ...prev, [tokenId]: humanReadableBalance }));
        } catch (error) {
            console.error('Error fetching balance for', tokenId, error);
            setTokenBalances(prev => ({ ...prev, [tokenId]: 0 }));
        } finally {
            setLoadingBalances(prev => ({ ...prev, [tokenId]: false }));
        }
    };

    // Fetch balances when tokens are selected
    useEffect(() => {
        const uniqueTokens = [...new Set(offerAssets.map(asset => asset.token).filter(Boolean))];
        uniqueTokens.forEach(tokenId => {
            if (tokenBalances[tokenId] === undefined && !loadingBalances[tokenId]) {
                fetchTokenBalance(tokenId);
            }
        });
    }, [offerAssets, stxAddress]);

    // Helper function to get cached token balance
    const getCachedTokenBalance = (tokenId: string): number => {
        return tokenBalances[tokenId] || 0;
    };

    // Helper function to check if offering more than balance
    const isOverBalance = (asset: OfferAssetWithId): boolean => {
        if (!asset.token || !asset.amount) return false;

        const amount = parseFloat(asset.amount);
        const balance = getCachedTokenBalance(asset.token);

        return !isNaN(amount) && amount > balance && balance >= 0;
    };

    // Helper function to get USD price for a token
    const getTokenUsdPrice = (tokenId: string): number => {
        if (!prices || !tokenId) return 0;

        // Look for price by contract ID in the prices object
        const priceEntry = Object.entries(prices).find(([key]) =>
            key.includes(tokenId) || tokenId.includes(key)
        );
        return priceEntry ? parseFloat(String(priceEntry[1])) : 0;
    };

    // Helper function to calculate USD value for an asset
    const calculateAssetUsdValue = (asset: OfferAssetWithId): number => {
        if (!asset.token || !asset.amount) return 0;

        const tokenInfo = subnetTokens.find(t => t.id === asset.token);
        if (!tokenInfo) return 0;

        const amount = parseFloat(asset.amount);
        if (isNaN(amount) || amount <= 0) return 0;

        const usdPrice = getTokenUsdPrice(asset.token);
        return amount * usdPrice;
    };

    // Calculate total USD value
    const calculateTotalUsdValue = (): number => {
        return offerAssets.reduce((total, asset) => {
            return total + calculateAssetUsdValue(asset);
        }, 0);
    };

    const addRow = () => {
        setOfferAssets((rows) => [...rows, { id: uuidv4(), token: "", amount: "" }]);
    };

    const removeRow = (id: string) => {
        setOfferAssets((rows) => rows.filter((asset) => asset.id !== id));
    };

    const updateRow = (id: string, field: "token" | "amount", value: string) => {
        setOfferAssets((rows) => {
            return rows.map(asset =>
                asset.id === id
                    ? { ...asset, [field]: value }
                    : asset
            );
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

                // Enhanced validation before calling toAtomicString
                console.log("Processing asset:", { asset, tokenInfo });

                if (!asset.amount || asset.amount.trim() === "") {
                    throw new Error(`Amount is required for ${tokenInfo.name}`);
                }

                if (isNaN(parseFloat(asset.amount))) {
                    throw new Error(`Invalid amount "${asset.amount}" for ${tokenInfo.name}`);
                }

                // Parse decimals to ensure it's a valid number
                const decimals = typeof tokenInfo.decimals === 'string'
                    ? parseInt(tokenInfo.decimals, 10)
                    : tokenInfo.decimals;

                if (isNaN(decimals) || !Number.isInteger(decimals) || decimals < 0) {
                    throw new Error(`Invalid decimals "${tokenInfo.decimals}" for ${tokenInfo.name}`);
                }

                const atomicAmountStr = toAtomicString(asset.amount, decimals);
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
                toast.success("Offer created successfully!");
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

                    {/* Asset Rows */}
                    <div className="space-y-4">
                        {offerAssets.map((asset, idx) => {
                            const selectedTokenInfo = subnetTokens?.find((t) => t.id === asset.token);
                            const usdValue = calculateAssetUsdValue(asset);
                            const balance = selectedTokenInfo ? getCachedTokenBalance(asset.token) : 0;
                            const overBalance = isOverBalance(asset);

                            // Prepare tokens for the dropdown
                            const dropdownTokens = subnetTokens.map(st => ({
                                ...st,
                                contractId: st.id,
                                type: "SUBNET"
                            }));
                            const currentSelectedForDropdown = dropdownTokens?.find(t => t.id === asset.token) ?? null;

                            return (
                                <div key={asset.id} className="flex flex-col p-4 rounded-xl border border-border/60 bg-muted/5 relative">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-medium">Asset {idx + 1}</h4>
                                        {offerAssets.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => removeRow(asset.id)}
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
                                                onSelect={(t: any) => updateRow(asset.id, "token", t.id)}
                                            />
                                            {/* Balance Display */}
                                            {selectedTokenInfo && (
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    {loadingBalances[asset.token] ? (
                                                        <span className="animate-pulse">Loading balance...</span>
                                                    ) : (
                                                        <>Balance: {balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {selectedTokenInfo.symbol}</>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs text-muted-foreground mb-1.5">Amount</label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="text"
                                                    placeholder="0.0"
                                                    value={asset.amount}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
                                                            updateRow(asset.id, "amount", value);
                                                        }
                                                    }}
                                                    className={`flex-1 ${overBalance ? 'border-amber-300 focus:border-amber-500' : ''}`}
                                                />
                                                {selectedTokenInfo && (
                                                    <div className="bg-muted/30 px-2 py-1.5 rounded border border-border/50 text-sm text-muted-foreground min-w-16 text-center">
                                                        {selectedTokenInfo.symbol}
                                                    </div>
                                                )}
                                            </div>
                                            {/* USD Value Display */}
                                            {usdValue > 0 && (
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    ≈ ${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                                </div>
                                            )}
                                            {/* Over Balance Warning */}
                                            {overBalance && (
                                                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    Offering more than your current balance
                                                </div>
                                            )}
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
                </div>

                {/* Preview section */}
                {offerAssets.some(asset => asset.token && asset.amount) && (
                    <div className="mt-6 pt-6 border-t border-border">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-medium">Offer Preview</h4>
                            <Badge variant="outline" className="text-muted-foreground text-xs">
                                Will be publicly visible
                            </Badge>
                        </div>

                        <div className="p-4 rounded-xl border border-border/60 bg-muted/5">
                            <h5 className="text-sm font-medium mb-3">You are offering:</h5>

                            {offerAssets.map((asset) => {
                                if (!asset.token || !asset.amount) return null;
                                const tokenInfo = subnetTokens.find(t => t.id === asset.token);
                                if (!tokenInfo) return null;

                                const usdValue = calculateAssetUsdValue(asset);

                                return (
                                    <div key={asset.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20 mb-2">
                                        <div className="flex items-center gap-2">
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
                                        {usdValue > 0 && (
                                            <div className="text-sm font-medium text-muted-foreground">
                                                ${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Grand Total */}
                            {(() => {
                                const totalUsd = calculateTotalUsdValue();
                                const validAssets = offerAssets.filter(asset => asset.token && asset.amount).length;

                                return (
                                    <>
                                        {totalUsd > 0 && (
                                            <div className="mt-4 pt-3 border-t border-border/40">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium">Total Value:</span>
                                                    <span className="text-lg font-bold text-primary">
                                                        ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Across {validAssets} asset{validAssets !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                                            <ArrowRightCircle className="h-3.5 w-3.5 text-primary/70" />
                                            <span>Open for bids</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

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

                {/* Balance Information */}
                {offerAssets.some(asset => isOverBalance(asset)) && (
                    <Alert variant="default" className="mt-4 flex items-start gap-2 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <div>
                            <AlertTitle className="text-amber-800 dark:text-amber-200">Balance Notice</AlertTitle>
                            <AlertDescription className="text-xs mt-1 text-amber-700 dark:text-amber-300">
                                You're offering more than your current balance for some tokens. This is allowed - just ensure
                                you have the required tokens before accepting any bids. The trade will only execute when you
                                accept a bid and have sufficient balance.
                            </AlertDescription>
                        </div>
                    </Alert>
                )}

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