"use client";

import React, { useState } from "react";
import { Asset, TokenDef } from "@/types/otc";
import TokenDropdown from "@/components/TokenDropdown";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { IntentInput, signIntentWithWallet } from "blaze-sdk";
import { v4 as uuidv4 } from "uuid";
import { useWallet } from "@/contexts/wallet-context";


interface Props {
    subnetTokens: TokenDef[];
}

interface SignedAsset extends Asset {
    intentUuid: string;
    signature: string;
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

/*───────────────────────────────────────────────────────────────────────────*/

export default function OfferForm({ subnetTokens }: Props) {
    const { address: stxAddress } = useWallet();
    const router = useRouter();
    const [offerAssets, setOfferAssets] = useState<Asset[]>([
        { token: "", amount: "" },
    ]);
    const [isSigning, setIsSigning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    /* helpers ---------------------------------------------------------------*/
    const addRow = (setRows: React.Dispatch<React.SetStateAction<Asset[]>>) =>
        setRows((rows) => [...rows, { token: "", amount: "" }]);

    const removeRow = (
        setRows: React.Dispatch<React.SetStateAction<Asset[]>>,
        idx: number,
    ) => setRows((rows) => rows.filter((_, i) => i !== idx));

    const updateRow = (
        setRows: React.Dispatch<React.SetStateAction<Asset[]>>,
        idx: number,
        field: "token" | "amount",
        value: string,
    ) =>
        setRows((rows) => {
            const next = [...rows];
            (next[idx] as any)[field] = value;
            return next;
        });

    const isValid = () => {
        if (!stxAddress) return false;
        return offerAssets.every((r) => {
            const tokenInfo = subnetTokens.find(t => t.id === r.token);
            if (!tokenInfo) return false;
            const amount = parseFloat(r.amount);
            return amount > 0 && !isNaN(amount);
        });
    };

    /* POST ------------------------------------------------------------------*/
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
            const signedOfferAssets: SignedAsset[] = [];

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

            console.log("[OfferForm] Payload to API:", JSON.stringify(payload, null, 2));

            const res = await fetch("/api/v1/otc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (json.success && json.offer && json.offer.intentUuid) {
                toast.success("Offer created successfully!", {
                    action: <Button onClick={() => router.push(`/otc/${json.offer.intentUuid}`)}>View Offer</Button>,
                });
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

    /* row component ---------------------------------------------------------*/
    const RowGroup = ({
        rows,
        setRows,
    }: {
        rows: Asset[];
        setRows: React.Dispatch<React.SetStateAction<Asset[]>>;
    }) => (
        <>
            {rows.map((row, idx) => {
                const selectedTokenInfo = subnetTokens?.find((t) => t.id === row.token);

                // Prepare tokens for the dropdown, ensuring it has the required `type` property.
                const dropdownTokens = subnetTokens.map(st => ({
                    ...st, // Spread all properties from TokenDef (id, name, logo, symbol, decimals)
                    contractId: st.id, // Assuming TokenDropdown might prefer/use contractId
                    type: "SUBNET" // Adding the required 'type' property
                }));
                const currentSelectedForDropdown = dropdownTokens?.find(t => t.id === row.token) ?? null;

                return (
                    <div key={idx} className="space-y-2 mb-3 pb-3 border-b last:border-b-0 last:mb-0 last:pb-0">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <TokenDropdown
                                    tokens={dropdownTokens}
                                    selected={currentSelectedForDropdown}
                                    onSelect={(t: any) => updateRow(setRows, idx, "token", t.id)}
                                />
                            </div>
                            {rows.length > 1 && (
                                <button
                                    type="button"
                                    className="rounded-md p-1 hover:bg-muted self-start mt-1.5"
                                    onClick={() => removeRow(setRows, idx)}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        {selectedTokenInfo && selectedTokenInfo.logo && (
                            <div className="mt-1 flex items-center space-x-2 p-1.5 bg-muted/30 rounded-md text-xs">
                                <img src={selectedTokenInfo.logo} alt={selectedTokenInfo.name} className="h-5 w-5 rounded-full" />
                                <span className="text-muted-foreground">Selected: {selectedTokenInfo.name} ({selectedTokenInfo.symbol})</span>
                            </div>
                        )}
                        <div className="flex items-center">
                            <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0.0"
                                className="w-full rounded-lg border px-3 py-2 text-sm rounded-r-none"
                                value={row.amount}
                                onChange={(e) => updateRow(setRows, idx, "amount", e.target.value)}
                            />
                            {selectedTokenInfo && (
                                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-input bg-muted text-sm text-muted-foreground h-10">
                                    {selectedTokenInfo.symbol}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => addRow(setRows)}
            >
                + Add row
            </Button>
        </>
    );

    /* render ----------------------------------------------------------------*/
    const isLoading = isSigning || isSubmitting;
    let buttonText = "Create Offer";
    if (isSigning) buttonText = "Signing...";
    if (isSubmitting) buttonText = "Submitting...";

    return (
        <div className="space-y-8">
            <section>
                <h3 className="mb-2 text-sm font-semibold">You are offering</h3>
                <RowGroup rows={offerAssets} setRows={setOfferAssets} />
            </section>

            <Button
                className="w-full"
                onClick={postOffer}
                disabled={isLoading || !isValid()}
            >
                {buttonText}
            </Button>
        </div>
    );
}
