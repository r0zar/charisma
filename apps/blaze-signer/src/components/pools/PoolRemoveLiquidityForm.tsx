import React, { useState, useEffect, useCallback } from 'react';
import { type PoolInfo } from './PoolDetails';
import { useWallet } from '@/context/wallet-context';
import { STACKS_MAINNET, type StacksNetwork } from '@stacks/network';
import {
    fetchCallReadOnlyFunction,
    cvToValue,
    uintCV,
    stringAsciiCV,
    tupleCV,
    principalCV,
    optionalCVOf,
    noneCV,
    type ClarityValue,
    type TupleCV,
    type TupleData,
    type TxBroadcastResult,
} from '@stacks/transactions';
import { BLAZE_SIGNER_CONTRACT, BLAZE_PROTOCOL_NAME, BLAZE_PROTOCOL_VERSION } from "@/constants/contracts";
import { v4 as uuidv4 } from "uuid";
import { request } from "@stacks/connect";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { formatUnits, parseUnits } from '@/lib/utils';
import { debounce } from 'lodash';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from '@/components/ui/slider';

interface PoolRemoveLiquidityFormProps {
    poolInfo: PoolInfo;
    contractId: string; // Pool contract ID
}

interface ExitQuote {
    dx: bigint; // Amount of Token A received
    dy: bigint; // Amount of Token B received
    dk: bigint; // Amount of LP tokens burned (should match input)
}

// Function to call our API endpoint for remove liquidity
async function executePoolRemoveLiquidity(params: {
    poolContractId: string;
    signature: string;
    lpAmount: bigint;
    uuid: string;
}): Promise<TxBroadcastResult> {
    console.log("Calling /api/pools/remove-liquidity with params:", params);
    const response = await fetch('/api/pools/remove-liquidity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...params,
            lpAmount: params.lpAmount.toString(), // Convert BigInt to string for JSON
        }),
    });

    const result: TxBroadcastResult = await response.json();

    if (!response.ok) {
        const errorMsg = ('error' in result && result.error) ? result.error : `API Error: ${response.statusText}`;
        console.error("API Execution Error:", errorMsg, result);
        throw new Error(errorMsg as string);
    }

    return result;
}

export const PoolRemoveLiquidityForm: React.FC<PoolRemoveLiquidityFormProps> = ({ poolInfo, contractId }) => {
    const { address: walletAddress, connected: isWalletConnected } = useWallet();
    const network: StacksNetwork = STACKS_MAINNET;
    const [signerContractAddress, signerContractName] = BLAZE_SIGNER_CONTRACT.split('.');

    // Form State
    const [percentToRemove, setPercentToRemove] = useState(50); // Default to 50%
    const [lpAmountInput, setLpAmountInput] = useState("");
    const [quote, setQuote] = useState<ExitQuote | null>(null);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);

    // Max LP amount the user can remove (their balance)
    const maxLpAmount = poolInfo.lpToken.userBalance || BigInt(0);
    const maxLpAmountFormatted = formatUnits(maxLpAmount, poolInfo.lpToken.decimals);

    // Signing State
    const [uuid, setUuid] = useState<string>("");
    const [signature, setSignature] = useState<string>("");
    const [messageDomainCV, setMessageDomainCV] = useState<ClarityValue | null>(null);
    const [messageCV, setMessageCV] = useState<ClarityValue | null>(null);
    const [isSigning, setIsSigning] = useState(false);
    const [signError, setSignError] = useState<string | null>(null);

    // Execution State
    const [isExecuting, setIsExecuting] = useState(false);
    const [execResult, setExecResult] = useState<TxBroadcastResult | null>(null);

    // Calculate LP amount based on percentage slider
    useEffect(() => {
        if (maxLpAmount > 0n) {
            const amount = (maxLpAmount * BigInt(percentToRemove)) / BigInt(100);
            setLpAmountInput(formatUnits(amount, poolInfo.lpToken.decimals));
        }
    }, [percentToRemove, maxLpAmount, poolInfo.lpToken.decimals]);

    // Reset state when inputs change
    useEffect(() => {
        setQuote(null);
        setQuoteError(null);
        setSignature("");
        setMessageDomainCV(null);
        setMessageCV(null);
        setUuid("");
        setSignError(null);
        setExecResult(null);
    }, [lpAmountInput]);

    // Debounced Quote Fetching
    const fetchQuote = useCallback(debounce(async (lpAmount: bigint) => {
        if (lpAmount === 0n) {
            setQuote(null);
            setQuoteError(null);
            setIsLoadingQuote(false);
            return;
        }
        setIsLoadingQuote(true);
        setQuoteError(null);
        setQuote(null);
        try {
            const [poolAddress, poolName] = contractId.split('.');
            const result = await fetchCallReadOnlyFunction({
                contractAddress: poolAddress,
                contractName: poolName,
                functionName: 'get-liquidity-quote', // Assuming this function exists in the contract
                functionArgs: [uintCV(lpAmount)],
                network,
                senderAddress: walletAddress || poolAddress,
            });
            const data = cvToValue(result);
            if (data && typeof data === 'object' && 'dx' in data && 'dy' in data && 'dk' in data) {
                setQuote({
                    dx: BigInt(data.dx.value),
                    dy: BigInt(data.dy.value),
                    dk: BigInt(data.dk.value)
                });
            } else {
                throw new Error('Unexpected data structure from get-liquidity-quote');
            }
        } catch (err) {
            console.error("Quote fetching error:", err);
            setQuoteError(err instanceof Error ? err.message : 'Failed to fetch quote');
            setQuote(null);
        } finally {
            setIsLoadingQuote(false);
        }
    }, 500), [contractId, network, walletAddress]);

    // Effect to trigger debounced quote fetch
    useEffect(() => {
        const lpAmountBigInt = parseUnits(lpAmountInput, poolInfo.lpToken.decimals);
        if (lpAmountBigInt !== null && lpAmountBigInt > 0n) {
            fetchQuote(lpAmountBigInt);
        } else {
            setQuote(null);
            setQuoteError(null);
            fetchQuote.cancel();
        }
        return () => fetchQuote.cancel();
    }, [lpAmountInput, poolInfo.lpToken.decimals, fetchQuote]);

    // Signing Logic
    const handleSignMessage = async () => {
        if (!quote || !walletAddress) return;
        setSignError(null);
        setIsSigning(true);
        setMessageDomainCV(null);
        setMessageCV(null);
        try {
            const currentUuid = uuidv4();
            setUuid(currentUuid);

            const lpAmountBigInt = parseUnits(lpAmountInput, poolInfo.lpToken.decimals);
            if (!lpAmountBigInt || lpAmountBigInt <= 0n) {
                throw new Error("Invalid LP amount");
            }

            const amountCv = optionalCVOf(uintCV(lpAmountBigInt));
            const intent = "REMOVE_LIQUIDITY";

            const domain = tupleCV({
                name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                "chain-id": uintCV(network.chainId),
            });

            const message = tupleCV({
                contract: principalCV(contractId),
                intent: stringAsciiCV(intent),
                opcode: noneCV(),
                amount: amountCv,
                target: noneCV(),
                uuid: stringAsciiCV(currentUuid),
            });

            // Store CVs for inspection
            setMessageDomainCV(domain);
            setMessageCV(message);

            const data = await request("stx_signStructuredMessage", {
                domain: domain as TupleCV<TupleData<ClarityValue>>,
                message: message as TupleCV<TupleData<ClarityValue>>,
            });

            if (data && data.signature) {
                setSignature(data.signature);
            } else {
                throw new Error("Signature request failed or was cancelled.");
            }
        } catch (err) {
            console.error("Signing error:", err);
            setSignError(err instanceof Error ? err.message : "Failed to sign message");
            setMessageDomainCV(null);
            setMessageCV(null);
        } finally {
            setIsSigning(false);
        }
    };

    // Execution Logic
    const handleExecute = async () => {
        if (!signature || !uuid || !quote) return;
        setIsExecuting(true);
        setExecResult(null);
        setSignError(null);
        try {
            const lpAmountBigInt = parseUnits(lpAmountInput, poolInfo.lpToken.decimals);
            if (lpAmountBigInt === null || lpAmountBigInt <= BigInt(0)) {
                throw new Error("Invalid LP amount for execution.");
            }

            // Call the API endpoint
            const result = await executePoolRemoveLiquidity({
                poolContractId: contractId,
                signature: signature,
                lpAmount: lpAmountBigInt,
                uuid: uuid,
            });
            setExecResult(result);

            // Check for broadcast error
            if ('error' in result) {
                const reasonData = 'reason_data' in result ? result.reason_data : undefined;
                console.warn("Transaction Broadcast Failed:", result.reason, reasonData);
            } else {
                console.log("Transaction Broadcast Success TXID:", result.txid);
            }
        } catch (err) {
            console.error("Execution error:", err);
            // Create a synthetic error object
            const syntheticError: TxBroadcastResult = {
                error: (err instanceof Error ? err.message : "Client-side execution error."),
                reason: "ServerFailureOther",
                reason_data: { message: "Error occurred during client-side processing before broadcast." },
                txid: ''
            };
            setExecResult(syntheticError);
        } finally {
            setIsExecuting(false);
        }
    };

    // Disabled state if user has no LP tokens
    const hasNoBalance = maxLpAmount <= 0n;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium mb-2">1. Specify LP Tokens to Remove</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Choose how much {poolInfo.lpToken.symbol} you want to burn to receive {poolInfo.tokenA.symbol} and {poolInfo.tokenB.symbol}.
                </p>

                {hasNoBalance ? (
                    <Alert className="mb-4">
                        <AlertDescription>
                            You don't have any {poolInfo.lpToken.symbol} tokens to remove from this pool.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        <div className="mb-4">
                            <Label htmlFor="percentSlider" className="block mb-2 text-sm">
                                Percentage to remove: {percentToRemove}%
                            </Label>
                            <Slider
                                id="percentSlider"
                                min={1}
                                max={100}
                                step={1}
                                value={[percentToRemove]}
                                onValueChange={(value: number[]) => setPercentToRemove(value[0])}
                                disabled={hasNoBalance || isSigning || isExecuting}
                                className="mb-3"
                            />
                        </div>

                        <div className="mb-4 flex flex-col sm:flex-row gap-2 items-end">
                            <div className="flex-1">
                                <Label htmlFor="lpAmount" className="text-sm block mb-1">LP Amount</Label>
                                <Input
                                    id="lpAmount"
                                    value={lpAmountInput}
                                    onChange={(e) => {
                                        setLpAmountInput(e.target.value.replace(/[^0-9.]/g, ''));
                                        // When user types, disconnect from slider
                                        const newValue = parseFloat(e.target.value);
                                        if (!isNaN(newValue)) {
                                            const newPercentage = Math.min(100, Math.max(1,
                                                Math.round((newValue / parseFloat(maxLpAmountFormatted)) * 100)
                                            ));
                                            setPercentToRemove(newPercentage);
                                        }
                                    }}
                                    disabled={hasNoBalance || isSigning || isExecuting}
                                    placeholder="Amount to remove"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPercentToRemove(100)}
                                disabled={hasNoBalance || isSigning || isExecuting}
                                className="mb-0.5"
                            >
                                Max
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Available: {maxLpAmountFormatted} {poolInfo.lpToken.symbol}
                        </p>
                    </>
                )}
            </div>

            {(isLoadingQuote || quote || quoteError) && !hasNoBalance && (
                <div className="p-4 border rounded-md bg-muted/50 space-y-2">
                    <h4 className="text-sm font-medium mb-2">Expected Output</h4>
                    {isLoadingQuote && <p className="text-sm text-muted-foreground">Loading quote...</p>}
                    {quoteError && <Alert variant="destructive"><AlertDescription>{quoteError}</AlertDescription></Alert>}
                    {quote && (
                        <div className="text-sm space-y-1">
                            <p>Receive {formatUnits(quote.dx, poolInfo.tokenA.decimals)} {poolInfo.tokenA.symbol}</p>
                            <p>Receive {formatUnits(quote.dy, poolInfo.tokenB.decimals)} {poolInfo.tokenB.symbol}</p>
                            <p className="text-xs text-muted-foreground">(For burning {formatUnits(quote.dk, poolInfo.lpToken.decimals)} {poolInfo.lpToken.symbol})</p>
                        </div>
                    )}
                </div>
            )}

            {quote && !quoteError && !hasNoBalance && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-medium mb-2">2. Sign Message</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Sign a message to authorize burning your {poolInfo.lpToken.symbol} LP tokens.
                        </p>

                        {/* Accordion for Signing Data (Displayed before signing) */}
                        {messageDomainCV && messageCV && !signature && (
                            <Accordion type="single" collapsible className="w-full mb-4 border rounded-md px-3 bg-background">
                                <AccordionItem value="item-1" className="border-b-0">
                                    <AccordionTrigger className="text-sm py-3 hover:no-underline">Inspect Signing Data</AccordionTrigger>
                                    <AccordionContent className="space-y-2 pb-3">
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Domain (SIP-018)</Label>
                                            <pre className="mt-1 break-all rounded-md bg-muted p-2 text-xs font-mono">
                                                {JSON.stringify(cvToValue(messageDomainCV, true), null, 2)}
                                            </pre>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Message (SIP-018)</Label>
                                            <pre className="mt-1 break-all rounded-md bg-muted p-2 text-xs font-mono">
                                                {JSON.stringify(cvToValue(messageCV, true), null, 2)}
                                            </pre>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}

                        <Button
                            onClick={handleSignMessage}
                            disabled={isSigning || !!signature || isExecuting || !walletAddress || hasNoBalance}
                            className="w-full"
                        >
                            {isSigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {signature ? "✓ Signed" : "Sign to Remove Liquidity"}
                        </Button>

                        {/* Display Signature Accordion */}
                        {signature && (
                            <Accordion type="single" collapsible className="w-full mt-4 border rounded-md px-3 bg-background">
                                <AccordionItem value="item-1" className="border-b-0">
                                    <AccordionTrigger className="text-sm py-3 hover:no-underline">View Signature & UUID</AccordionTrigger>
                                    <AccordionContent className="space-y-2 pb-3">
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Signature</Label>
                                            <div className="mt-1 break-all rounded-md bg-muted p-2 text-xs font-mono">
                                                {signature}
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">UUID</Label>
                                            <div className="mt-1 break-all rounded-md bg-muted p-2 text-xs font-mono">
                                                {uuid}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </div>

                    {/* Step 3: Execute Button */}
                    {signature && (
                        <div>
                            <h3 className="text-lg font-medium mb-2">3. Execute</h3>
                            <Button
                                onClick={handleExecute}
                                disabled={isExecuting || !walletAddress || hasNoBalance}
                                className="w-full"
                            >
                                {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Remove Liquidity
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Error/Success Display */}
            {signError && (
                <Alert variant="destructive">
                    <AlertDescription>{signError}</AlertDescription>
                </Alert>
            )}
            {execResult && (
                <Alert
                    variant={'error' in execResult ? "destructive" : "default"}
                    className={!('error' in execResult) ? "bg-green-50 border-green-200" : ""}
                >
                    <AlertDescription className={!('error' in execResult) ? "text-green-800" : ""}>
                        {('error' in execResult)
                            ? `Error: ${execResult.error}${'reason' in execResult && execResult.reason ? ` (${execResult.reason})` : ''}`
                            : `Transaction Submitted!`}
                        {'txid' in execResult && execResult.txid && (
                            <span className="block mt-1 text-xs">TXID: {execResult.txid}</span>
                        )}
                        {('reason_data' in execResult && execResult.reason_data) &&
                            <pre className="text-xs mt-2 whitespace-pre-wrap break-all">Reason Data: {JSON.stringify(execResult.reason_data, null, 2)}</pre>}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}; 