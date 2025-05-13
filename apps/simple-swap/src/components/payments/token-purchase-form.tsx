import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSwap } from "@/hooks/useSwap";
import { PurchaseDialog } from "./checkout";
import TokenDropdown from "@/components/TokenDropdown";
import { CHARISMA_TOKEN_SUBNET } from "@/lib/constants";
import { getTokenMetadataCached } from "@repo/tokens";
import { fetchTokenBalance } from "blaze-sdk";
import { toast } from "sonner";

export default function TokenPurchaseForm() {
    const [usdAmount, setUsdAmount] = useState("5");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [clientSecret, setClientSecret] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [reserveBalance, setReserveBalance] = useState<bigint | null>(null);
    const [reserveError, setReserveError] = useState("");
    const MAX_USD_AMOUNT = 20;

    const {
        subnetDisplayTokens,
        selectedToToken,
        setSelectedToToken,
        tokenPrices,
        userAddress,
    } = useSwap();

    // Set selected token to charisma token or first available subnet token
    useEffect(() => {
        // Only proceed if there are subnet tokens and no token is currently selected
        if (subnetDisplayTokens && subnetDisplayTokens.length > 0 && !selectedToToken) {
            const charismaToken = subnetDisplayTokens.find(
                (token) => token.contractId === CHARISMA_TOKEN_SUBNET
            );
            if (charismaToken) {
                setSelectedToToken(charismaToken);
            } else {
                setSelectedToToken(subnetDisplayTokens[0]); // Default to the first available subnet token
            }
        }
        // Adding subnetDisplayTokens to dependency array as its change should trigger this effect.
    }, [subnetDisplayTokens, selectedToToken, setSelectedToToken]);

    // Fetch reserve balance when selected token changes
    useEffect(() => {
        async function fetchReserve() {
            setReserveError("");
            setReserveBalance(null);
            if (!selectedToToken?.contractId) return;
            try {
                const balance = await fetchTokenBalance(
                    selectedToToken.contractId,
                    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS" // the reserves wallet
                );
                setReserveBalance(BigInt(balance));
            } catch (e) {
                setReserveError("Failed to fetch reserve balance");
            }
        }
        fetchReserve();
    }, [selectedToToken]);

    const selectedPrice = selectedToToken && tokenPrices[selectedToToken.contractId];

    const tokenAmount = selectedPrice && parseFloat(usdAmount)
        ? Math.floor((parseFloat(usdAmount) / selectedPrice) * 10 ** selectedToToken.decimals)
        : 0;

    const exceedsReserve = reserveBalance !== null && BigInt(tokenAmount) > reserveBalance;

    const formattedTokenAmount = tokenAmount
        ? (tokenAmount / 10 ** (selectedToToken?.decimals || 0)).toFixed(4)
        : "0";

    const handleCheckout = async () => {
        if (!selectedToToken || !userAddress || !usdAmount) return;

        setIsLoading(true);
        setError("");

        try {
            // Construct metadata object
            const purchaseMetadata = {
                userId: userAddress,
                selectedTokenContractId: selectedToToken.contractId,
                selectedTokenSymbol: selectedToToken.symbol,
                selectedTokenName: selectedToToken.name,
                selectedTokenDecimals: selectedToToken.decimals.toString(),
                usdAmount: usdAmount,
                calculatedTokenAmount: tokenAmount,
                fiatCurrency: "USD",
            };

            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                body: JSON.stringify({
                    userId: userAddress,
                    tokenAmount: tokenAmount,
                    tokenType: selectedToToken.contractId,
                    amount: parseFloat(usdAmount) * 100,
                    metadata: purchaseMetadata,
                }),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            let data: any = {};
            try {
                data = await res.json();
            } catch { }

            if (!res.ok) {
                toast.error(data?.message || "Something went wrong");
                return;
            }

            if (data?.clientSecret) {
                setClientSecret(data.clientSecret);
                setDialogOpen(true);
            }
        } catch (err) {
            toast.error((err as Error).message || "Failed to process checkout. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-card p-6 bg-card max-w-md mx-auto animate-[appear_0.3s_ease-out]">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Purchase Tokens</h2>
                    <div className="flex items-center text-sm text-primary">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Secure transaction</span>
                    </div>
                </div>

                {reserveError && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">
                        {reserveError}
                    </div>
                )}
                {exceedsReserve && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">
                        Not enough tokens in reserve to fulfill this purchase.
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Token</label>
                        <TokenDropdown
                            tokens={subnetDisplayTokens || []}
                            selected={selectedToToken}
                            onSelect={setSelectedToToken}
                            label="Select a token to purchase"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Amount (USD)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-muted-foreground sm:text-sm">$</span>
                            </div>
                            <input
                                type="number"
                                value={usdAmount}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (parseFloat(value) > MAX_USD_AMOUNT) {
                                        setError(`Maximum purchase is $${MAX_USD_AMOUNT}`);
                                        setUsdAmount(MAX_USD_AMOUNT.toString());
                                    } else {
                                        setError("");
                                        setUsdAmount(value);
                                    }
                                }}
                                min="1"
                                max={MAX_USD_AMOUNT}
                                step="1"
                                className="input-field pl-7 pr-12 bg-muted rounded-xl py-2"
                                placeholder="0.00"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-muted-foreground sm:text-sm">USD</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted p-4 rounded-xl">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">You will receive:</span>
                            <span className="font-medium">
                                {formattedTokenAmount} {selectedToToken?.symbol || ''}
                            </span>
                        </div>
                        {selectedPrice && (
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Exchange rate:</span>
                                <span>1 USD = {(1 / selectedPrice).toFixed(6)} {selectedToToken?.symbol}</span>
                            </div>
                        )}
                    </div>
                </div>

                <Button
                    onClick={handleCheckout}
                    disabled={isLoading || !selectedToToken || parseFloat(usdAmount) <= 0 || parseFloat(usdAmount) > MAX_USD_AMOUNT || exceedsReserve}
                    className="button-primary w-full"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </>
                    ) : (
                        'Continue to Checkout'
                    )}
                </Button>

                <div className="text-xs text-center text-muted-foreground mt-4 flex items-center justify-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Your payment information is securely processed
                </div>
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
        </div>
    );
}