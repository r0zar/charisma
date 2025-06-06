import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useSwap } from "@/hooks/useSwap";
import { PurchaseDialog } from "./checkout";
import TokenDropdown from "@/components/TokenDropdown";
import { fetchTokenBalance } from "blaze-sdk";
import { toast } from "sonner";
import { fetchQuote } from "dexterity-sdk";
import { useWallet } from "@/contexts/wallet-context";
import { RefreshCw } from "lucide-react";

// A simple debounce hook (if not already available globally)
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

interface ServerQuoteData {
    amountOutMicro: bigint; // Amount of token to receive, in micro-units
    // Add other fields from API if needed, e.g., rate, fees
}

export default function TokenPurchaseForm() {
    const [usdAmount, setUsdAmount] = useState("");
    const debouncedUsdAmount = useDebounce(usdAmount, 500); // Debounce USD amount

    const [dialogOpen, setDialogOpen] = useState(false);
    const [clientSecret, setClientSecret] = useState(null);
    const [isLoading, setIsLoading] = useState(false); // This is for Stripe checkout loading
    const [error, setError] = useState(""); // For USD input validation error

    const [reserveBalance, setReserveBalance] = useState<bigint | null>(null);
    const [reserveError, setReserveError] = useState("");
    const MAX_USD_AMOUNT = 20;

    // State for server-side quote
    const [dexterityQuote, setDexterityQuote] = useState<ServerQuoteData | null>(null);
    const [isFetchingDexterityQuote, setIsFetchingDexterityQuote] = useState(false);
    const [dexterityQuoteError, setDexterityQuoteError] = useState<string | null>(null);

    const {
        subnetDisplayTokens,
        selectedToToken,
        setSelectedToToken,
        userAddress,
        tokenPrices,
        fetchRawPrices,
        isLoadingPrices,
    } = useSwap();

    // Set selected token to charisma token or first available subnet token
    useEffect(() => {
        if (subnetDisplayTokens && subnetDisplayTokens.length > 0 && !selectedToToken) {
            const CHA_CONTRACT_ID = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1';
            const chaToken = subnetDisplayTokens.find(t => t.contractId === CHA_CONTRACT_ID);
            setSelectedToToken(chaToken || subnetDisplayTokens[0]);
        }
    }, [subnetDisplayTokens, setSelectedToToken, selectedToToken]);

    // Fetch server-side quote when debouncedUsdAmount or selectedToToken changes
    useEffect(() => {
        async function fetchDexterityQuote() {
            if (!debouncedUsdAmount || parseFloat(debouncedUsdAmount) <= 0 || !selectedToToken?.contractId) {
                setDexterityQuote(null);
                setDexterityQuoteError(null);
                return;
            }

            setIsFetchingDexterityQuote(true);
            setDexterityQuoteError(null);
            setDexterityQuote(null);

            try {
                const amountToQuote = parseFloat(debouncedUsdAmount);

                const quoteResult = await fetchQuote(
                    "SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1",
                    selectedToToken.contractId,
                    amountToQuote * 10 ** 8
                );

                if (quoteResult && typeof quoteResult.amountOut !== 'undefined') {
                    setDexterityQuote({
                        amountOutMicro: BigInt(quoteResult.amountOut),
                    });
                } else {
                    throw new Error((quoteResult as any)?.error || "Invalid quote data received from Dexterity SDK.");
                }

            } catch (err) {
                setDexterityQuoteError(err instanceof Error ? err.message : "An unknown error occurred while fetching quote.");
                setDexterityQuote(null);
            }
            finally {
                setIsFetchingDexterityQuote(false);
            }
        }

        fetchDexterityQuote();
    }, [debouncedUsdAmount, selectedToToken]);

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

    const decimals = selectedToToken?.decimals ?? 6;
    // Calculate tokenAmount and formattedTokenAmount based on serverQuote
    const tokenAmountMicro = dexterityQuote?.amountOutMicro || 0n;

    const exceedsReserve = reserveBalance !== null && tokenAmountMicro > reserveBalance;

    const formattedTokenAmount = selectedToToken && tokenAmountMicro
        ? (Number(tokenAmountMicro) / (10 ** decimals)).toFixed(decimals) // Ensure decimals is not 0 to avoid NaN
        : "0";

    // Helper: get token price in USD
    const getTokenUsdPrice = (token: typeof selectedToToken) => {
        if (!token) return 0;
        // Try direct contractId
        if (tokenPrices[token.contractId]) return Number(tokenPrices[token.contractId]);
        // Try base if subnet
        if (token.type === 'SUBNET' && token.base && tokenPrices[token.base]) return Number(tokenPrices[token.base]);
        return 0;
    };

    // Helper: format USD
    const formatUsd = (value: number) => {
        if (!value || isNaN(value)) return "$0.00";
        if (value >= 1) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `$${value.toFixed(6)}`;
    };

    // Calculate reserve in tokens and USD
    const reserveTokens = reserveBalance !== null && selectedToToken ? Number(reserveBalance) / (10 ** decimals) : 0;
    const reserveUsd = reserveTokens * getTokenUsdPrice(selectedToToken);
    const reserveUsd90 = reserveUsd * 0.9;

    // Handler to refresh prices
    const handleRefreshPrices = async () => {
        if (fetchRawPrices) await fetchRawPrices();
    };

    const handleCheckout = async () => {
        if (!selectedToToken || !userAddress || !usdAmount || !dexterityQuote?.amountOutMicro || dexterityQuote.amountOutMicro <= 0n) {
            toast.error("Cannot proceed to checkout. Quote is missing or invalid.");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const purchaseMetadata = {
                userId: userAddress,
                selectedTokenContractId: selectedToToken.contractId,
                selectedTokenSymbol: selectedToToken.symbol,
                selectedTokenName: selectedToToken.name,
                selectedTokenDecimals: selectedToToken.decimals?.toString(),
                usdAmount: usdAmount,
                calculatedTokenAmount: dexterityQuote.amountOutMicro.toString(), // Use server quote micro amount
                fiatCurrency: "USD",
            };

            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                body: JSON.stringify({
                    userId: userAddress,
                    tokenAmount: dexterityQuote.amountOutMicro.toString(), // Use server quote micro amount
                    tokenType: selectedToToken.contractId,
                    amount: parseFloat(usdAmount) * 100, // Stripe amount in cents
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
                if (res.status === 409) {
                    toast.error("Token price changed by more than 10%. Please refresh and try again.");
                } else {
                    toast.error(data?.message || "Something went wrong with checkout initialization.");
                }
                setIsLoading(false); // Ensure loading is reset on failure
                return;
            }

            if (data?.clientSecret) {
                setClientSecret(data.clientSecret);
                setDialogOpen(true);
            }
        } catch (err) {
            toast.error((err as Error).message || "Failed to process checkout. Please try again.");
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
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm space-y-1">
                        <div>Not enough tokens in reserve to fulfill this purchase.</div>
                        {selectedToToken && (
                            <div>
                                <span className="font-medium">Reserve:</span> {reserveTokens.toLocaleString(undefined, { maximumFractionDigits: decimals })} {selectedToToken.symbol}
                            </div>
                        )}
                        {reserveUsd > 0 && (
                            <div>
                                <span className="font-medium">Available to purchase:</span> {formatUsd(reserveUsd90)}
                            </div>
                        )}
                        <div className="text-xs text-muted-foreground">Try a lower amount within this limit.</div>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Token</label>
                        <TokenDropdown
                            tokens={subnetDisplayTokens || []}
                            selected={selectedToToken}
                            onSelect={(token) => {
                                setSelectedToToken(token);
                                setDexterityQuote(null); // Reset quote when token changes
                                setDexterityQuoteError(null);
                            }}
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
                        {isFetchingDexterityQuote && (
                            <div className="text-xs text-muted-foreground mt-1">Fetching best price...</div>
                        )}
                        {dexterityQuoteError && (
                            <div className="text-xs text-destructive mt-1">Error: {dexterityQuoteError}</div>
                        )}
                        {dexterityQuote && selectedToToken && !isFetchingDexterityQuote && !dexterityQuoteError && (
                            <>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">You will receive:</span>
                                    <span className="font-medium">
                                        {formattedTokenAmount} {selectedToToken.symbol}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-1 items-center">
                                    <span>Exchange rate (approx.):</span>
                                    <div className="flex items-center gap-2">
                                        {parseFloat(usdAmount) > 0 && (
                                            <span>1 USD = {(Number(dexterityQuote.amountOutMicro) / (10 ** decimals) / parseFloat(usdAmount)).toFixed(6)} {selectedToToken.symbol}</span>
                                        )}
                                        <button
                                            type="button"
                                            className="ml-2 p-1 rounded cursor-pointer hover:bg-accent transition-colors"
                                            onClick={handleRefreshPrices}
                                            aria-label="Refresh prices"
                                            disabled={isLoadingPrices}
                                        >
                                            <RefreshCw className={"h-4 w-4 transition-transform " + (isLoadingPrices ? "animate-spin" : "")} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        {!dexterityQuote && !isFetchingDexterityQuote && !dexterityQuoteError && parseFloat(usdAmount) > 0 && selectedToToken && (
                            <div className="text-xs text-muted-foreground mt-1">Enter a valid amount to see quote.</div>
                        )}
                        {!selectedToToken && (
                            <div className="text-xs text-muted-foreground mt-1">Select a token to purchase.</div>
                        )}
                    </div>
                </div>

                <Button
                    onClick={handleCheckout}
                    disabled={isLoading || isFetchingDexterityQuote || !!dexterityQuoteError || !dexterityQuote || !selectedToToken || parseFloat(usdAmount) <= 0 || parseFloat(usdAmount) > MAX_USD_AMOUNT || exceedsReserve}
                    className="button-primary w-full"
                >
                    {isLoading ? 'Initializing Checkout...' : (isFetchingDexterityQuote ? 'Getting Price...' : 'Continue to Checkout')}
                </Button>

                <div className="text-xs text-center text-muted-foreground mt-4 flex items-center justify-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Your payment information is securely processed
                </div>
            </div>

            {/* Checkout Dialog */}
            {clientSecret && selectedToToken && dexterityQuote && (
                <PurchaseDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    amountUsd={parseFloat(usdAmount)}
                    tokenAmount={Number(dexterityQuote.amountOutMicro)} // Pass micro amount
                    tokenSymbol={selectedToToken.symbol}
                    userAddress={userAddress}
                    tokenContract={selectedToToken.contractId}
                    tokenDecimals={selectedToToken.decimals!}
                />
            )}
        </div>
    );
}