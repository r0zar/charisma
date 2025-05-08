'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useWallet } from '@/context/wallet-context'; // Import wallet context
import { STACKS_MAINNET, type StacksNetwork } from '@stacks/network'; // Import network
import {
    uintCV,
    principalCV,
    contractPrincipalCV,
    bufferCVFromString,
    stringAsciiCV,
    tupleCV,
    optionalCVOf,
    noneCV,
    ClarityValue,
    TxBroadcastResult,
    TupleCV,
    TupleData,
} from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl'; // Helper for buffer
import { request, SignatureData } from "@stacks/connect"; // use request for contract calls
import { v4 as uuidv4 } from "uuid"; // Import uuid
import { Loader2 } from 'lucide-react'; // For loading state
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // For status/errors
import {
    BLAZE_PROTOCOL_NAME,
    BLAZE_PROTOCOL_VERSION,
    CHARISMA_CREDITS_CONTRACT,
    WELSH_CREDITS_CONTRACT,
} from "@/constants/contracts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Multihop router contract (testing)
const MULTIHOP_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9";
// TODO: Define these based on blaze standards if different

const TOKEN_A_SUBNET = CHARISMA_CREDITS_CONTRACT;
const TOKEN_B_SUBNET = WELSH_CREDITS_CONTRACT;

// Refined types
interface HopInputDetails {
    vault: string;      // Contract ID string (e.g., SP...vault)
}

interface HopState extends HopInputDetails {
    // Internal state, not directly input by user for hop 1
    signature?: string; // Buffer hex string (e.g. 0x...)
    uuid?: string;      // UUID string
    opcode?: string;    // Hex string (e.g., 0x00)
}


export const MultihopTester: React.FC = () => {
    const { address: walletAddress, connected: isWalletConnected } = useWallet();
    const network: StacksNetwork = STACKS_MAINNET; // Or get from context/config

    const [numHops, setNumHops] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [amountInput, setAmountInput] = useState<string>(''); // Use string for input
    const [recipient, setRecipient] = useState<string>('');
    const [hops, setHops] = useState<HopState[]>([{ vault: '', opcode: '00' }]);
    const [swapDirections, setSwapDirections] = useState<Array<'a-to-b' | 'b-to-a'>>(['a-to-b']);
    const [status, setStatus] = useState<string>('');
    const [txResult, setTxResult] = useState<TxBroadcastResult | { txid: string } | null>(null); // Allow simple txid object
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false); // Combined loading state
    const [isSigning, setIsSigning] = useState(false); // Specific loading state for signing
    const [isExecuting, setIsExecuting] = useState(false); // Specific loading state for API call

    // State to hold signature details needed for API call
    const [signatureForApi, setSignatureForApi] = useState<string | null>(null);
    const [uuidForApi, setUuidForApi] = useState<string | null>(null);

    const handleNumHopsChange = (value: string) => {
        const n = parseInt(value, 10) as 1 | 2 | 3 | 4 | 5;
        setNumHops(n);
        setHops(prevHops => {
            const newHops = [...prevHops];
            while (newHops.length < n) {
                newHops.push({ vault: '', opcode: '00' });
            }
            const finalHops = newHops.slice(0, n);
            // Clear signature/uuid if hop 1 is removed and re-added
            if (finalHops.length > 0) {
                finalHops[0] = { ...finalHops[0], vault: finalHops[0]?.vault || '' };
            }
            return finalHops;
        });
        // Adjust swap directions array
        setSwapDirections(prevDirections => {
            const newDirections = [...prevDirections];
            while (newDirections.length < n) {
                newDirections.push('a-to-b'); // Default direction
            }
            return newDirections.slice(0, n);
        });
        // Reset status on structural change
        setStatus('');
        setError(null);
        setTxResult(null);
    };

    const handleHopInputChange = (index: number, field: keyof Pick<HopInputDetails, 'vault'>, value: string) => {
        setHops(prevHops => {
            const newHops = [...prevHops];
            // Only update input fields, preserve generated signature/uuid if they exist
            newHops[index] = { ...newHops[index], [field]: value };
            // If it's hop 1 and vault/opcode changes, clear potentially stale sig/uuid
            if (index === 0) {
                delete newHops[0].signature;
                delete newHops[0].uuid;
            }
            return newHops;
        });
        // Reset status on input change
        setStatus('');
        setError(null);
        setTxResult(null);
    };

    const handleSwapDirectionChange = (index: number, value: 'a-to-b' | 'b-to-a') => {
        setSwapDirections(prevDirections => {
            const newDirections = [...prevDirections];
            newDirections[index] = value;
            // Update the corresponding opcode in the hops state
            const newOpcode = value === 'a-to-b' ? '00' : '01';
            setHops(prevHops => {
                const newHops = [...prevHops];
                if (newHops[index]) {
                    newHops[index] = { ...newHops[index], opcode: newOpcode };
                }
                return newHops;
            });
            // Clear signature/uuid for hop 1 if direction changes
            if (index === 0) {
                setSignatureForApi(null);
                setUuidForApi(null);
                setHops(prev => {
                    const hopStates = [...prev];
                    if (hopStates[0]) {
                        // Reconstruct hop 1 without signature/uuid
                        hopStates[0] = { vault: hopStates[0].vault, opcode: hopStates[0].opcode };
                    }
                    return hopStates;
                });
            }
            return newDirections;
        });
        // Reset status on input change
        setStatus('');
        setError(null);
        setTxResult(null);
    };

    // Step 1: Sign the first hop details
    const handleSignFirstHop = async () => {
        if (!isWalletConnected || !walletAddress) {
            setError("Please connect your wallet first.");
            return;
        }
        // Reset API state before starting
        setSignatureForApi(null);
        setUuidForApi(null);
        setIsSigning(true); // Use signing loading state
        setIsLoading(false); // Ensure general loading is off
        setIsExecuting(false); // Ensure executing loading is off
        setStatus('Preparing signature...');
        setError(null);
        setTxResult(null);

        try {
            // --- Validate Inputs ---
            const amount = BigInt(amountInput || '0');
            if (amount <= 0n) throw new Error("Amount must be positive for signing.");
            // Recipient not needed for signing hop 1 message

            // --- Step 1: Sign message for Hop 1 (using stx_signStructuredMessage) ---
            if (numHops > 0) {
                let generatedUuid = ''; // Local scope for generation
                let signResponse: SignatureData | undefined; // Local scope for signing result

                setStatus('Generating signature for Hop 1...');
                const hop1Vault = hops[0].vault;
                // Determine opcode CV based on selected direction for Hop 1
                const hop1Direction = swapDirections[0];

                if (!hop1Vault) throw new Error("Vault contract for Hop 1 is required for signing.");

                generatedUuid = uuidv4();
                const uuidClarityValue = stringAsciiCV(generatedUuid);

                // Define structured data domain (using constants)
                const domain = tupleCV({
                    name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                    version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                    "chain-id": uintCV(network.chainId),
                    // Note: Pool forms don't include contract-address in domain, following that pattern.
                });

                // Determine subnet token for signing (matches first hop input)
                const signingSubnetToken = hop1Direction === 'a-to-b' ? TOKEN_A_SUBNET : TOKEN_B_SUBNET;

                // Define structured data message payload matching x-execute verification needs
                // The recipient for the signed message is the multihop contract itself.
                const message = tupleCV({
                    contract: principalCV(signingSubnetToken),
                    intent: stringAsciiCV('TRANSFER_TOKENS'),
                    opcode: noneCV(),
                    amount: optionalCVOf(uintCV(amount)),
                    target: optionalCVOf(principalCV(MULTIHOP_CONTRACT_ID)),
                    uuid: uuidClarityValue,
                });

                setStatus('Requesting signature from wallet...');
                // Use request("stx_signStructuredMessage", ...) as seen in pool forms
                signResponse = await request("stx_signStructuredMessage", {
                    domain: domain as TupleCV<TupleData<ClarityValue>>,
                    message: message as TupleCV<TupleData<ClarityValue>>,
                });

                // Explicit check to ensure signResponse is defined
                if (!signResponse) {
                    throw new Error("Wallet did not return a response.");
                }

                // Check response structure for signature (redundant due to explicit check? Keep for safety)
                if (!signResponse || !signResponse.signature) {
                    throw new Error("Signature was not obtained from the wallet response.");
                }

                // Store the necessary details for the API call in state
                setSignatureForApi(signResponse.signature); // Store raw hex signature
                setUuidForApi(generatedUuid); // Store generated UUID

                // Update state for display (optional, but helpful for debugging)
                setHops(prev => {
                    const newHops = [...prev];
                    if (newHops[0]) {
                        // Display signature with 0x prefix
                        newHops[0] = { ...newHops[0], signature: `0x${signResponse.signature}`, uuid: generatedUuid };
                    }
                    return newHops;
                });
            }

            setIsSigning(false); // Use signing loading state
        } catch (err) {
            console.error('Multi-hop swap failed:', err);
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(`Error: ${errorMsg}`);
            setStatus(`Failed: ${errorMsg}`);
            setIsSigning(false); // Ensure signing state is reset
        }
    };

    // --- Helper: Build preview of API payload ---
    const buildPreviewPayload = () => {
        if (!amountInput) return null;
        const inputToken = swapDirections[0] === 'a-to-b' ? TOKEN_A_SUBNET : TOKEN_B_SUBNET;
        const outputToken = swapDirections[numHops - 1] === 'a-to-b' ? TOKEN_B_SUBNET : TOKEN_A_SUBNET;
        return {
            amount: amountInput || '0',
            recipient: recipient || '<recipient>',
            signature: signatureForApi ?? '<signature>',
            uuid: uuidForApi ?? '<uuid>',
            inputToken,
            outputToken,
            hops: hops.map(({ vault, opcode }) => ({ vault, opcode })),
        };
    };

    // Step 2: Call the backend API with signed data
    const handleExecuteApiCall = async () => {
        if (!isWalletConnected) {
            setError("Please connect your wallet first.");
            return;
        }
        // Validate required inputs for API call
        if (numHops > 0 && (!signatureForApi || !uuidForApi)) {
            setError("Please generate a signature for Hop 1 first.");
            return;
        }
        if (!recipient) {
            setError("Recipient address is required.");
            return;
        }
        if (!amountInput || BigInt(amountInput) <= 0n) {
            setError("Valid amount is required.");
            return;
        }

        setIsExecuting(true); // Use executing loading state
        setIsLoading(false);
        setIsSigning(false);
        setStatus('Sending request to backend API...');
        setError(null);
        setTxResult(null);

        try {
            // Determine input/output tokens based on swap directions
            const inputToken = swapDirections[0] === 'a-to-b' ? TOKEN_A_SUBNET : TOKEN_B_SUBNET;
            const outputToken = swapDirections[numHops - 1] === 'a-to-b' ? TOKEN_B_SUBNET : TOKEN_A_SUBNET;

            const apiPayload = {
                amount: amountInput,
                recipient,
                signature: signatureForApi ?? (() => { throw new Error('Missing signature') })(),
                uuid: uuidForApi ?? (() => { throw new Error('Missing uuid') })(),
                inputToken,
                outputToken,
                hops: hops.map((hop) => ({
                    vault: hop.vault,
                    opcode: hop.opcode,
                })),
            };

            console.log("Sending payload to /api/multihop/execute:", apiPayload);

            const response = await fetch('/api/multihop/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(apiPayload),
            });

            const result: TxBroadcastResult = await response.json();

            if (!response.ok) {
                const errorMsg = ('error' in result && result.error) ? result.error : `API Error: ${response.statusText}`;
                console.error("API Execution Error:", errorMsg, result);
                throw new Error(errorMsg as string);
            }

            // Handle successful broadcast from API
            setTxResult(result); // Store the result from the API
            if ('txid' in result && result.txid) {
                setStatus(`Transaction submitted via API! TXID: ${result.txid}`);
            } else if ('error' in result) {
                // Handle potential broadcast errors reported by the API
                setError(`API reported broadcast error: ${result.error}`);
                setStatus(`API Error: ${result.error}`);
            } else {
                setStatus("API response received, but structure unknown.");
            }

            setIsExecuting(false); // Ensure executing state is reset
        } catch (apiErr) {
            console.error('API call failed:', apiErr);
            const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
            setError(`API Error: ${errorMsg}`);
            setStatus(`API Call Failed: ${errorMsg}`);
            setIsExecuting(false); // Ensure executing state is reset
        }
    };

    // Helper to open a contract call using stacks-connect request()
    const openCall = async (functionName: string, functionArgs: ClarityValue[]) => {
        console.log("Opening contract call:", MULTIHOP_CONTRACT_ID, functionName, functionArgs);
        const result = await request("stx_callContract", {
            contract: MULTIHOP_CONTRACT_ID,
            functionName,
            functionArgs,
        })
        console.log("Contract call result:", result);
    };

    const handleTestXDeposit = async () => {
        if (!signatureForApi || !uuidForApi) {
            alert('Generate signature first');
            return;
        }
        const inputToken = swapDirections[0] === 'a-to-b' ? TOKEN_A_SUBNET : TOKEN_B_SUBNET;
        const [inAddr, inName] = inputToken.split('.') as [string, string];
        const tuple = tupleCV({
            token: contractPrincipalCV(inAddr, inName),
            amount: uintCV(BigInt(amountInput || '0')),
            signature: bufferFromHex(signatureForApi),
            uuid: stringAsciiCV(uuidForApi!),
        });
        await openCall('test-x-deposit', [tuple]);
    };

    const handleTestExecute = async () => {
        const firstHop = hops[0];
        if (!firstHop?.vault) {
            alert('Vault required');
            return;
        }
        const [vAddr, vName] = firstHop.vault.split('.') as [string, string];
        const opTuple = tupleCV({
            vault: contractPrincipalCV(vAddr, vName),
            opcode: bufferFromHex(firstHop.opcode || '00'),
        });
        await openCall('test-execute', [opTuple, uintCV(BigInt(amountInput || '0'))]);
    };

    const handleTestWithdraw = async () => {
        const outputToken = swapDirections[numHops - 1] === 'a-to-b' ? TOKEN_B_SUBNET : TOKEN_A_SUBNET;
        const outTuple = tupleCV({
            token: principalCV(outputToken),
            to: principalCV(recipient || walletAddress || 'SP...'),
        });
        await openCall('test-withdraw', [outTuple, uintCV(BigInt(amountInput || '0'))]);
    };

    return (
        <div className="space-y-6">
            {!isWalletConnected && (
                <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800">
                    <AlertTitle>Wallet Not Connected</AlertTitle>
                    <AlertDescription>Please connect your wallet to use the swap tester.</AlertDescription>
                </Alert>
            )}
            <div>
                <Label>Number of Hops</Label>
                <RadioGroup defaultValue="1" onValueChange={handleNumHopsChange} className="flex space-x-4 mt-2 flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} className="flex items-center space-x-2">
                            <RadioGroupItem value={String(n)} id={`r${n}`} disabled={!isWalletConnected || isLoading} />
                            <Label htmlFor={`r${n}`}>{n} Hop{n > 1 ? 's' : ''}</Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            <div>
                <Label htmlFor="amount">Amount (uToken)</Label> {/* Generic unit */}
                <Input
                    id="amount"
                    type="number"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g., 1000000"
                    disabled={!isWalletConnected || isLoading}
                />
            </div>

            <div>
                <Label htmlFor="recipient">Recipient Principal</Label>
                <Input
                    id="recipient"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="e.g., SP..."
                    disabled={!isWalletConnected || isLoading}
                />
            </div>

            {hops.map((hop, index) => (
                <div key={index} className="border p-4 rounded space-y-4 bg-muted/20">
                    <h3 className="font-semibold">Hop {index + 1} Details</h3>
                    <div>
                        <Label htmlFor={`vault-${index}`}>Vault Contract ID</Label>
                        <Input
                            id={`vault-${index}`}
                            value={hop.vault ?? ''}
                            onChange={(e) => handleHopInputChange(index, 'vault', e.target.value)}
                            placeholder="Contract ID (e.g., SP...vault-name)"
                            disabled={!isWalletConnected || isLoading}
                        />
                    </div>
                    <div>
                        <Label htmlFor={`direction-${index}`}>Swap Direction</Label>
                        <Select
                            value={swapDirections[index]}
                            onValueChange={(value) => handleSwapDirectionChange(index, value as 'a-to-b' | 'b-to-a')}
                            disabled={!isWalletConnected || isLoading || isSigning || isExecuting}
                        >
                            <SelectTrigger id={`direction-${index}`} className="w-full">
                                <SelectValue placeholder="Select direction" />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                                {/* Use generic labels as vault tokens are unknown */}
                                <SelectItem value="a-to-b">Token A =&gt; Token B</SelectItem>
                                <SelectItem value="b-to-a">Token B =&gt; Token A</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {index === 0 && numHops > 0 && hop.signature && hop.uuid && (
                        <div className="mt-2 space-y-1 text-xs bg-background p-2 rounded border">
                            <p className="text-muted-foreground">Generated Signature:</p>
                            <code className="break-all block">{hop.signature}</code>
                            <p className="text-muted-foreground mt-1">Generated UUID:</p>
                            <code className="break-all block">{hop.uuid}</code>
                        </div>
                    )}
                </div>
            ))}

            {/* JSON Preview */}
            <div className="border rounded p-4 bg-muted/10">
                <h4 className="font-medium mb-2">Route Preview (JSON)</h4>
                <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-60">
                    {JSON.stringify(buildPreviewPayload(), null, 2)}
                </pre>
            </div>

            {/* Test Functions */}
            <div className="flex flex-wrap gap-2 my-4">
                <Button variant="secondary" onClick={handleTestXDeposit} disabled={!signatureForApi || !uuidForApi || !amountInput}>test-x-deposit</Button>
                <Button variant="secondary" onClick={handleTestExecute} disabled={!amountInput || !hops[0]?.vault}>test-execute</Button>
                <Button variant="secondary" onClick={handleTestWithdraw} disabled={!amountInput || !recipient}>test-withdraw</Button>
            </div>

            {/* Button Container */}
            <div className="flex flex-col sm:flex-row gap-4">
                {numHops > 0 && (
                    <Button
                        onClick={handleSignFirstHop}
                        disabled={!isWalletConnected || isSigning || isExecuting || !amountInput || !hops[0]?.vault}
                        variant="outline"
                    >
                        {isSigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {signatureForApi ? "Regenerate Hop 1 Signature" : "Generate Hop 1 Signature"}
                    </Button>
                )}

                <Button
                    onClick={handleExecuteApiCall}
                    disabled={
                        !isWalletConnected ||
                        isSigning ||
                        isExecuting ||
                        (numHops > 0 && (!signatureForApi || !uuidForApi)) || // Sig required if hop 1 exists
                        !recipient ||
                        !amountInput
                    }
                >
                    {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isExecuting ? status || 'Executing...' : `Execute ${numHops}-Hop Swap`}
                </Button>
            </div>

            {/* Status and Result Display */}
            {!isLoading && error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {!isLoading && !error && status && !txResult && (
                <Alert variant="info">
                    <AlertTitle>Status</AlertTitle>
                    <AlertDescription>{status}</AlertDescription>
                </Alert>
            )}
            {txResult && 'txid' in txResult && txResult.txid && (
                <Alert variant="success">
                    <AlertTitle>Transaction Submitted</AlertTitle>
                    <AlertDescription>
                        TXID: <a
                            href={`https://explorer.stacks.co/txid/${txResult.txid}?chain=${network.chainId === 1 ? 'mainnet' : 'testnet'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-primary"
                        >
                            {txResult.txid}
                        </a>
                    </AlertDescription>
                </Alert>
            )}
            {txResult && 'error' in txResult && txResult.error && (
                <Alert variant="warning">
                    <AlertTitle>Submission Error</AlertTitle>
                    <AlertDescription>{txResult.error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}; 