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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown } from 'lucide-react';
import { bufferFromHex } from '@stacks/transactions/dist/cl';

interface PoolSwapFormProps {
    poolInfo: PoolInfo;
    contractId: string;
}

interface SwapQuote {
    dx: bigint; // Amount in
    dy: bigint; // Amount out
    dk: bigint; // LP tokens (not used for swaps, will be 0)
}

// Function to call the API endpoint for swaps
async function executePoolSwap(params: {
    poolContractId: string;
    signature: string;
    amount: bigint;
    uuid: string;
    recipient: string;
    direction: 'a-to-b' | 'b-to-a';
}): Promise<TxBroadcastResult> {
    console.log(`Calling /api/pools/swap-${params.direction} with params:`, params);
    const response = await fetch(`/api/pools/swap-${params.direction}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...params,
            amount: params.amount.toString(), // Convert BigInt to string for JSON
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

export const PoolSwapForm: React.FC<PoolSwapFormProps> = ({ poolInfo, contractId }) => {
    const { address: walletAddress, connected: isWalletConnected } = useWallet();
    const network: StacksNetwork = STACKS_MAINNET;

    // Token balance state
    const [tokenABalance, setTokenABalance] = useState<bigint>(BigInt(0));
    const [tokenBBalance, setTokenBBalance] = useState<bigint>(BigInt(0));
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);

    // Swap direction state
    const [swapDirection, setSwapDirection] = useState<'a-to-b' | 'b-to-a'>('a-to-b');

    // Form state
    const [amountInput, setAmountInput] = useState("");
    const [quote, setQuote] = useState<SwapQuote | null>(null);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);

    // Signing state
    const [uuid, setUuid] = useState<string>("");
    const [signature, setSignature] = useState<string>("");
    const [messageDomainCV, setMessageDomainCV] = useState<ClarityValue | null>(null);
    const [messageCV, setMessageCV] = useState<ClarityValue | null>(null);
    const [isSigning, setIsSigning] = useState(false);
    const [signError, setSignError] = useState<string | null>(null);

    // Execution state
    const [isExecuting, setIsExecuting] = useState(false);
    const [execResult, setExecResult] = useState<TxBroadcastResult | null>(null);

    // Get input and output token based on swap direction
    const inputToken = swapDirection === 'a-to-b' ? poolInfo.tokenA : poolInfo.tokenB;
    const outputToken = swapDirection === 'a-to-b' ? poolInfo.tokenB : poolInfo.tokenA;

    // Get the current input token balance based on swap direction
    const currentInputBalance = swapDirection === 'a-to-b' ? tokenABalance : tokenBBalance;

    // Fetch token balances
    const fetchTokenBalances = useCallback(async () => {
        if (!walletAddress) {
            setTokenABalance(BigInt(0));
            setTokenBBalance(BigInt(0));
            return;
        }

        setIsLoadingBalances(true);
        try {
            // Fetch token A balance
            const [tokenAAddress, tokenAName] = poolInfo.tokenA.contractId.split('.');
            const resultA = await fetchCallReadOnlyFunction({
                contractAddress: tokenAAddress,
                contractName: tokenAName,
                functionName: 'get-balance',
                functionArgs: [principalCV(walletAddress)],
                network,
                senderAddress: walletAddress,
            });

            const balanceA = cvToValue(resultA);
            if (balanceA && typeof balanceA === 'object' && 'value' in balanceA) {
                setTokenABalance(BigInt(balanceA.value));
            }

            // Fetch token B balance
            const [tokenBAddress, tokenBName] = poolInfo.tokenB.contractId.split('.');
            const resultB = await fetchCallReadOnlyFunction({
                contractAddress: tokenBAddress,
                contractName: tokenBName,
                functionName: 'get-balance',
                functionArgs: [principalCV(walletAddress)],
                network,
                senderAddress: walletAddress,
            });

            const balanceB = cvToValue(resultB);
            if (balanceB && typeof balanceB === 'object' && 'value' in balanceB) {
                setTokenBBalance(BigInt(balanceB.value));
            }
        } catch (err) {
            console.error("Error fetching token balances:", err);
        } finally {
            setIsLoadingBalances(false);
        }
    }, [walletAddress, poolInfo.tokenA.contractId, poolInfo.tokenB.contractId, network]);

    // Fetch balances when wallet or tokens change
    useEffect(() => {
        fetchTokenBalances();
    }, [fetchTokenBalances, walletAddress]);

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
    }, [amountInput, swapDirection]);

    // Debounced quote fetching
    const fetchQuote = useCallback(debounce(async (amount: bigint) => {
        if (amount === 0n) {
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
                functionName: 'get-swap-quote', // Assuming this function exists in the contract
                functionArgs: [
                    uintCV(amount),
                    optionalCVOf(swapDirection === 'a-to-b' ?
                        bufferFromHex('0x00') :
                        bufferFromHex('0x01')),
                ],
                network,
                senderAddress: walletAddress || poolAddress,
            });

            const data = cvToValue(result);
            if (data && typeof data === 'object' && 'dx' in data && 'dy' in data) {
                setQuote({
                    dx: BigInt(data.dx.value),
                    dy: BigInt(data.dy.value),
                    dk: BigInt(data.dk?.value || 0)
                });
            } else {
                throw new Error('Unexpected data structure from get-swap-quote');
            }
        } catch (err) {
            console.error("Quote fetching error:", err);
            setQuoteError(err instanceof Error ? err.message : 'Failed to fetch quote');
            setQuote(null);
        } finally {
            setIsLoadingQuote(false);
        }
    }, 500), [contractId, network, walletAddress, swapDirection]);

    // Effect to trigger debounced quote fetch
    useEffect(() => {
        const amountBigInt = parseUnits(amountInput, inputToken.decimals);
        if (amountBigInt !== null && amountBigInt > 0n) {
            fetchQuote(amountBigInt);
        } else {
            setQuote(null);
            setQuoteError(null);
            fetchQuote.cancel();
        }
        return () => fetchQuote.cancel();
    }, [amountInput, inputToken.decimals, fetchQuote]);

    // Signing logic
    const handleSignMessage = async () => {
        if (!quote || !walletAddress) return;

        setSignError(null);
        setIsSigning(true);
        setMessageDomainCV(null);
        setMessageCV(null);

        try {
            const currentUuid = uuidv4();
            setUuid(currentUuid);

            const amountBigInt = parseUnits(amountInput, inputToken.decimals);
            if (!amountBigInt || amountBigInt <= 0n) {
                throw new Error("Invalid amount");
            }

            // Determine which token contract to use based on direction
            const tokenContract = swapDirection === 'a-to-b' ?
                principalCV(poolInfo.tokenA.contractId) :
                principalCV(poolInfo.tokenB.contractId);

            const domain = tupleCV({
                name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                "chain-id": uintCV(network.chainId),
            });

            const message = tupleCV({
                contract: tokenContract,
                intent: stringAsciiCV("TRANSFER_TOKENS"),
                opcode: noneCV(),
                amount: optionalCVOf(uintCV(amountBigInt)),
                target: optionalCVOf(principalCV(contractId)),
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

    // Execution logic
    const handleExecute = async () => {
        if (!signature || !uuid || !quote) return;

        setIsExecuting(true);
        setExecResult(null);
        setSignError(null);

        try {
            const amountBigInt = parseUnits(amountInput, inputToken.decimals);
            if (amountBigInt === null || amountBigInt <= BigInt(0)) {
                throw new Error("Invalid amount for execution.");
            }

            // Call the API endpoint
            const result = await executePoolSwap({
                poolContractId: contractId,
                signature: signature,
                amount: amountBigInt,
                uuid: uuid,
                recipient: walletAddress!,
                direction: swapDirection,
            });

            setExecResult(result);

            // Check for broadcast error
            if ('error' in result) {
                const reasonData = 'reason_data' in result ? result.reason_data : undefined;
                console.warn("Transaction Broadcast Failed:", result.reason, reasonData);
            } else {
                console.log("Transaction Broadcast Success TXID:", result.txid);
                // Refresh token balances after successful swap
                setTimeout(() => fetchTokenBalances(), 2000);
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

    // Disabled state if user has insufficient balance
    const hasInsufficientBalance =
        Boolean(amountInput) && parseUnits(amountInput, inputToken.decimals)! > currentInputBalance;


    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium mb-2">1. Select Swap Direction & Amount</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Choose the tokens to swap and specify the amount.
                </p>

                {/* Swap Direction Selector */}
                <div className="mb-4">
                    <Label htmlFor="swapDirection" className="block mb-1">Swap Direction</Label>
                    <Select
                        value={swapDirection}
                        onValueChange={(value) => setSwapDirection(value as 'a-to-b' | 'b-to-a')}
                        disabled={isSigning || isExecuting}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Swap Direction" />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                            <SelectItem value="a-to-b">Swap {poolInfo.tokenA.symbol} to {poolInfo.tokenB.symbol}</SelectItem>
                            <SelectItem value="b-to-a">Swap {poolInfo.tokenB.symbol} to {poolInfo.tokenA.symbol}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Amount Input */}
                <div className="mb-4">
                    <Label htmlFor="swapAmount" className="block mb-1">
                        {inputToken.symbol} Amount
                    </Label>
                    <Input
                        id="swapAmount"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
                        disabled={isSigning || isExecuting}
                        placeholder={`Amount of ${inputToken.symbol} to swap`}
                    />

                    <div className="flex justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                            Available: {formatUnits(currentInputBalance, inputToken.decimals)} {inputToken.symbol}
                            {isLoadingBalances && <span className="ml-1">(loading...)</span>}
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (currentInputBalance > 0n) {
                                    setAmountInput(formatUnits(currentInputBalance, inputToken.decimals));
                                }
                            }}
                            disabled={!currentInputBalance || currentInputBalance === BigInt(0) || isSigning || isExecuting || isLoadingBalances}
                            className="px-2 py-0 h-6"
                        >
                            Max
                        </Button>
                    </div>
                </div>

                {/* Arrow and Output Amount (Quote) */}
                {(isLoadingQuote || quote || quoteError) && (
                    <div className="space-y-2 mt-6">
                        <div className="flex justify-center">
                            <ArrowDown className="text-muted-foreground" />
                        </div>

                        <div className="p-4 border rounded-md bg-muted/50">
                            <h4 className="text-sm font-medium mb-2">You Receive</h4>
                            {isLoadingQuote && <p className="text-sm text-muted-foreground">Loading quote...</p>}
                            {quoteError && <Alert variant="destructive"><AlertDescription>{quoteError}</AlertDescription></Alert>}
                            {quote && (
                                <div className="text-lg font-medium">
                                    {formatUnits(quote.dy, outputToken.decimals)} {outputToken.symbol}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {quote && !quoteError && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-medium mb-2">2. Sign Message</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Sign a message to authorize the transfer of {inputToken.symbol}.
                        </p>

                        {/* Accordion for Signing Data */}
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
                            disabled={isSigning || !!signature || isExecuting || !walletAddress || hasInsufficientBalance}
                            className="w-full"
                        >
                            {isSigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {signature ? "✓ Signed" : "Sign to Swap"}
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
                            <h3 className="text-lg font-medium mb-2">3. Execute Swap</h3>
                            <Button
                                onClick={handleExecute}
                                disabled={isExecuting || !walletAddress}
                                className="w-full"
                            >
                                {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Swap {inputToken.symbol} to {outputToken.symbol}
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