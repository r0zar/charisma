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
import { debounce } from 'lodash'; // Using lodash for debounce
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Import Accordion

interface PoolAddLiquidityFormProps {
    poolInfo: PoolInfo;
    contractId: string; // Pool contract ID (e.g., monkey-d-luffy-rc8)
}

interface LiquidityQuote {
    dx: bigint; // Amount of Token A needed
    dy: bigint; // Amount of Token B needed
    dk: bigint; // Amount of LP tokens minted (should match input)
}

// Updated function to call our new API endpoint with separate UUIDs
async function executePoolAddLiquidity(params: {
    poolContractId: string;
    signatureA: string;
    signatureB: string;
    lpAmount: bigint; // Send as string to avoid JSON limitations with BigInt
    uuidA: string;
    uuidB: string;
}): Promise<TxBroadcastResult> { // Return the raw broadcast result
    console.log("Calling /api/pools/add-liquidity with params:", params);
    const response = await fetch('/api/pools/add-liquidity', {
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
        // Check if result has error, otherwise use statusText
        const errorMsg = ('error' in result && result.error) ? result.error : `API Error: ${response.statusText}`;
        console.error("API Execution Error:", errorMsg, result);
        throw new Error(errorMsg as string); // Cast as string, error type is complex
    }

    // Return the broadcast result directly (could be success or failure)
    return result;
}

export const PoolAddLiquidityForm: React.FC<PoolAddLiquidityFormProps> = ({ poolInfo, contractId }) => {
    const { address: walletAddress, connected: isWalletConnected } = useWallet();
    const network: StacksNetwork = STACKS_MAINNET;
    const [signerContractAddress, signerContractName] = BLAZE_SIGNER_CONTRACT.split('.');

    // Form State
    const [lpAmountInput, setLpAmountInput] = useState(""); // User input for LP tokens
    const [quote, setQuote] = useState<LiquidityQuote | null>(null);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);

    // Signing State (Updated for separate UUIDs)
    const [uuidA, setUuidA] = useState<string>("");
    const [uuidB, setUuidB] = useState<string>("");
    const [sigA, setSigA] = useState<string>("");
    const [sigB, setSigB] = useState<string>("");
    // State to hold the actual CVs for inspection
    const [messageDomainCV, setMessageDomainCV] = useState<ClarityValue | null>(null);
    const [messageACV, setMessageACV] = useState<ClarityValue | null>(null);
    const [messageBCV, setMessageBCV] = useState<ClarityValue | null>(null);
    const [isSigningA, setIsSigningA] = useState(false);
    const [isSigningB, setIsSigningB] = useState(false);
    const [signError, setSignError] = useState<string | null>(null);

    // Execution State
    const [isExecuting, setIsExecuting] = useState(false);
    const [execResult, setExecResult] = useState<TxBroadcastResult | null>(null); // State holds the raw result

    // Reset state when inputs change significantly
    useEffect(() => {
        setQuote(null);
        setQuoteError(null);
        setSigA("");
        setSigB("");
        setMessageDomainCV(null); // Clear CVs
        setMessageACV(null);
        setMessageBCV(null);
        setUuidA("");
        setUuidB("");
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
                functionName: 'get-liquidity-quote',
                functionArgs: [uintCV(lpAmount)],
                network,
                senderAddress: walletAddress || poolAddress,
            });
            const data = cvToValue(result);
            console.log("Quote data:", data);
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
    }, 500), [contractId, network, walletAddress]); // Dependencies for useCallback

    // Effect to trigger debounced quote fetch
    useEffect(() => {
        const lpAmountBigInt = parseUnits(lpAmountInput, poolInfo.lpToken.decimals);
        if (lpAmountBigInt !== null && lpAmountBigInt > 0n) {
            fetchQuote(lpAmountBigInt);
        } else {
            // Clear quote if input is invalid or zero
            setQuote(null);
            setQuoteError(null);
            fetchQuote.cancel(); // Cancel any pending debounced calls
        }
        // Cleanup function to cancel debounce on unmount
        return () => fetchQuote.cancel();
    }, [lpAmountInput, poolInfo.lpToken.decimals, fetchQuote]);

    // --- Signing Logic (Updated for unique UUIDs) ---
    const handleSignMessageA = async () => {
        if (!quote || !walletAddress) return;
        setSignError(null);
        setIsSigningA(true);
        setMessageDomainCV(null); // Clear previous CVs
        setMessageACV(null);
        try {
            // Generate a unique UUID for token A
            const currentUuidA = uuidv4();
            setUuidA(currentUuidA);

            const amountACv = optionalCVOf(uintCV(quote.dx));
            const targetCv = optionalCVOf(principalCV(contractId));
            const intent = "TRANSFER_TOKENS";
            const tokenAContract = poolInfo.tokenA.contractId;

            const domain = tupleCV({
                name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                "chain-id": uintCV(network.chainId),
            });
            const messageA = tupleCV({
                contract: principalCV(tokenAContract),
                intent: stringAsciiCV(intent),
                opcode: noneCV(),
                amount: amountACv,
                target: targetCv,
                uuid: stringAsciiCV(currentUuidA), // Use unique UUID A
            });

            // Store CVs for inspection *before* signing
            setMessageDomainCV(domain);
            setMessageACV(messageA);

            const data = await request("stx_signStructuredMessage", {
                domain: domain as TupleCV<TupleData<ClarityValue>>,
                message: messageA as TupleCV<TupleData<ClarityValue>>,
            });

            if (data && data.signature) {
                setSigA(data.signature);
                setSigB(""); // Clear sig B when A changes
                setMessageBCV(null); // Clear message B CV
                setUuidB(""); // Clear UUID B
            } else {
                throw new Error("Signature request failed or was cancelled.");
            }
        } catch (err) {
            console.error("Signing A error:", err);
            setSignError(err instanceof Error ? err.message : "Failed to sign message A");
            setMessageDomainCV(null); // Clear CVs on error
            setMessageACV(null);
        } finally {
            setIsSigningA(false);
        }
    };

    const handleSignMessageB = async () => {
        if (!quote || !walletAddress || !sigA || !messageDomainCV) return; // Need domain CV from A
        setSignError(null);
        setIsSigningB(true);
        setMessageBCV(null); // Clear previous B CV
        try {
            // Generate a unique UUID for token B
            const currentUuidB = uuidv4();
            setUuidB(currentUuidB);

            const amountBCv = optionalCVOf(uintCV(quote.dy));
            const targetCv = optionalCVOf(principalCV(contractId));
            const intent = "TRANSFER_TOKENS";
            const tokenBContract = poolInfo.tokenB.contractId;

            const domain = messageDomainCV; // Reuse domain CV from step A

            const messageB = tupleCV({
                contract: principalCV(tokenBContract),
                intent: stringAsciiCV(intent),
                opcode: noneCV(),
                amount: amountBCv,
                target: targetCv,
                uuid: stringAsciiCV(currentUuidB), // Use unique UUID B
            });

            // Store B CV for inspection *before* signing
            setMessageBCV(messageB);

            const data = await request("stx_signStructuredMessage", {
                domain: domain as TupleCV<TupleData<ClarityValue>>,
                message: messageB as TupleCV<TupleData<ClarityValue>>,
            });

            if (data && data.signature) {
                setSigB(data.signature);
            } else {
                throw new Error("Signature request failed or was cancelled.");
            }
        } catch (err) {
            console.error("Signing B error:", err);
            setSignError(err instanceof Error ? err.message : "Failed to sign message B");
            setMessageBCV(null);
        } finally {
            setIsSigningB(false);
        }
    };

    // --- Execution Logic (Updated for separate UUIDs) ---
    const handleExecute = async () => {
        if (!sigA || !sigB || !uuidA || !uuidB || !quote) return;
        setIsExecuting(true);
        setExecResult(null);
        setSignError(null);
        try {
            const lpAmountBigInt = parseUnits(lpAmountInput, poolInfo.lpToken.decimals);
            if (lpAmountBigInt === null || lpAmountBigInt <= BigInt(0)) { // Use BigInt(0) instead of 0n
                throw new Error("Invalid LP amount for execution.");
            }

            // Call the updated API client function with separate UUIDs
            const result = await executePoolAddLiquidity({
                poolContractId: contractId,
                signatureA: sigA,
                signatureB: sigB,
                lpAmount: lpAmountBigInt,
                uuidA: uuidA,
                uuidB: uuidB,
            });
            setExecResult(result);

            // Check for broadcast error within the result object itself
            if ('error' in result) {
                const reasonData = 'reason_data' in result ? result.reason_data : undefined;
                console.warn("Transaction Broadcast Failed:", result.reason, reasonData);
                // Error is implicitly displayed via the Alert rendering logic below
            } else {
                console.log("Transaction Broadcast Success TXID:", result.txid);
            }
        } catch (err) {
            console.error("Execution error (API call or parsing):", err);
            // Create a synthetic error object matching TxBroadcastResultRejected structure
            const syntheticError: TxBroadcastResult = {
                error: (err instanceof Error ? err.message : "Client-side execution error."),
                reason: "ServerFailureOther", // Use a valid reason literal type
                reason_data: { message: "Error occurred during client-side processing before broadcast." },
                txid: '' // Add placeholder txid to satisfy BaseRejection
            };
            setExecResult(syntheticError);
        } finally {
            setIsExecuting(false);
        }
    };


    // --- Render (Updated with Accordions) --- 
    const lpAmountBigInt = parseUnits(lpAmountInput, poolInfo.lpToken.decimals);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium mb-2">1. Specify LP Tokens</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Enter the amount of {poolInfo.lpToken.symbol} LP tokens you wish to mint.
                </p>
                <Input
                    id="lpAmount"
                    placeholder={`Amount of ${poolInfo.lpToken.symbol}`}
                    value={lpAmountInput}
                    onChange={(e) => setLpAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
                    disabled={isSigningA || isSigningB || isExecuting}
                />
            </div>

            {(isLoadingQuote || quote || quoteError) && (
                <div className="p-4 border rounded-md bg-muted/50 space-y-2">
                    <h4 className="text-sm font-medium mb-2">Required Deposits (Quote)</h4>
                    {isLoadingQuote && <p className="text-sm text-muted-foreground">Loading quote...</p>}
                    {quoteError && <Alert variant="destructive"><AlertDescription>{quoteError}</AlertDescription></Alert>}
                    {quote && (
                        <div className="text-sm space-y-1">
                            <p>Deposit {formatUnits(quote.dx, poolInfo.tokenA.decimals)} {poolInfo.tokenA.symbol}</p>
                            <p>Deposit {formatUnits(quote.dy, poolInfo.tokenB.decimals)} {poolInfo.tokenB.symbol}</p>
                            <p className="text-xs text-muted-foreground">(For {formatUnits(quote.dk, poolInfo.lpToken.decimals)} {poolInfo.lpToken.symbol})</p>
                        </div>
                    )}
                </div>
            )}

            {quote && !quoteError && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-medium mb-2">2. Sign Messages</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Sign two messages to authorize the transfer of {poolInfo.tokenA.symbol} and {poolInfo.tokenB.symbol} to the pool.
                        </p>

                        {/* Accordion for Signing Data A (Displayed before signing A) */}
                        {messageDomainCV && messageACV && !sigA && (
                            <Accordion type="single" collapsible className="w-full mb-4 border rounded-md px-3 bg-background">
                                <AccordionItem value="item-1" className="border-b-0">
                                    <AccordionTrigger className="text-sm py-3 hover:no-underline">Inspect Data for {poolInfo.tokenA.symbol} Signature</AccordionTrigger>
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
                                                {JSON.stringify(cvToValue(messageACV, true), null, 2)}
                                            </pre>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* Sign A Button */}
                            <Button
                                onClick={handleSignMessageA}
                                disabled={isSigningA || isSigningB || !!sigA || isExecuting || !walletAddress}
                                className="flex-1"
                            >
                                {isSigningA && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {sigA ? `✓ Signed ${poolInfo.tokenA.symbol}` : `Sign ${poolInfo.tokenA.symbol} Transfer`}
                            </Button>
                            {/* Sign B Button - enable only after A is signed */}
                            <Button
                                onClick={handleSignMessageB}
                                disabled={!sigA || isSigningB || !!sigB || isExecuting || !walletAddress}
                                className="flex-1"
                            >
                                {isSigningB && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {sigB ? `✓ Signed ${poolInfo.tokenB.symbol}` : `Sign ${poolInfo.tokenB.symbol} Transfer`}
                            </Button>
                        </div>

                        {/* Accordion for Signing Data B (Displayed after signing A, before signing B) */}
                        {sigA && messageDomainCV && messageBCV && !sigB && (
                            <Accordion type="single" collapsible className="w-full mt-4 border rounded-md px-3 bg-background">
                                <AccordionItem value="item-1" className="border-b-0">
                                    <AccordionTrigger className="text-sm py-3 hover:no-underline">Inspect Data for {poolInfo.tokenB.symbol} Signature</AccordionTrigger>
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
                                                {JSON.stringify(cvToValue(messageBCV, true), null, 2)}
                                            </pre>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}

                        {/* Display Signatures and UUIDs Accordion (Updated to show UUIDs) */}
                        {(sigA || sigB) && (
                            <Accordion type="single" collapsible className="w-full mt-4 border rounded-md px-3 bg-background">
                                <AccordionItem value="item-1" className="border-b-0">
                                    <AccordionTrigger className="text-sm py-3 hover:no-underline">View Signatures & UUIDs</AccordionTrigger>
                                    <AccordionContent className="space-y-2 pb-3">
                                        {sigA && (
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Signature A ({poolInfo.tokenA.symbol})</Label>
                                                <div className="mt-1 break-all rounded-md bg-muted p-2 text-xs font-mono">
                                                    {sigA}
                                                </div>
                                                <Label className="text-xs text-muted-foreground mt-2">UUID A</Label>
                                                <div className="mt-1 break-all rounded-md bg-muted p-2 text-xs font-mono">
                                                    {uuidA}
                                                </div>
                                            </div>
                                        )}
                                        {sigB && (
                                            <div className="mt-3">
                                                <Label className="text-xs text-muted-foreground">Signature B ({poolInfo.tokenB.symbol})</Label>
                                                <div className="mt-1 break-all rounded-md bg-muted p-2 text-xs font-mono">
                                                    {sigB}
                                                </div>
                                                <Label className="text-xs text-muted-foreground mt-2">UUID B</Label>
                                                <div className="mt-1 break-all rounded-md bg-muted p-2 text-xs font-mono">
                                                    {uuidB}
                                                </div>
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </div>

                    {/* Step 3: Execute Button */}
                    {sigA && sigB && (
                        <div>
                            <h3 className="text-lg font-medium mb-2">3. Execute</h3>
                            <Button
                                onClick={handleExecute}
                                disabled={isExecuting || !walletAddress}
                                className="w-full"
                            >
                                {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Liquidity
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
            {/* Display based on execResult */}
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
                        {/* Optionally display reason_data if helpful and exists */}
                        {('reason_data' in execResult && execResult.reason_data) &&
                            <pre className="text-xs mt-2 whitespace-pre-wrap break-all">Reason Data: {JSON.stringify(execResult.reason_data, null, 2)}</pre>}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}; 