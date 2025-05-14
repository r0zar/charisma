'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Vault } from '@/lib/vaultService';
import { ArrowRightLeft, TrendingDown, TrendingUp, ExternalLinkIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/lib/context/app-context';
import { request } from '@stacks/connect';
import { uintCV, bufferCV, optionalCVOf, Pc, PostCondition } from '@stacks/transactions';
import { toast } from "sonner";

interface SublinkBridgeCardProps {
    sublink: Vault;
}

// Define constants for the operation codes
const OP_DEPOSIT = 0x05; // Opcode for deposit (bridge to subnet)
const OP_WITHDRAW = 0x06; // Opcode for withdraw (bridge from subnet)

export function SublinkBridgeCard({ sublink }: SublinkBridgeCardProps) {
    const { walletState } = useApp();
    const [amountToBridgeTo, setAmountToBridgeTo] = useState<string>('');
    const [amountToBridgeFrom, setAmountToBridgeFrom] = useState<string>('');
    const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
    const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

    const explorerBaseUrl = "https://explorer.stacks.co/txid/";

    // Helper function to parse token contract ID
    const parseTokenContractId = (contractId: string) => {
        // Handle special case for STX
        if (contractId === '.stx') {
            return { isStx: true, address: '', contractName: '', assetName: '' };
        }

        const parts = contractId.split('.');
        // Standard SIP-010 token format: SP123.token-name
        if (parts.length === 2) {
            return {
                isStx: false,
                address: parts[0],
                contractName: parts[1],
                // For SIP-010 tokens, asset name is typically the contract name itself
                assetName: parts[1]
            };
        }

        // Handle edge case for SP123.token-contract.token-name format
        if (parts.length === 3) {
            return {
                isStx: false,
                address: parts[0],
                contractName: parts[1],
                assetName: parts[2]
            };
        }

        // Default fallback
        return {
            isStx: false,
            address: parts[0] || '',
            contractName: parts[1] || '',
            assetName: parts[1] || ''
        };
    };

    // Helper to get subnet token contract ID
    const getSubnetTokenContractId = (sublinkContractId: string) => {
        const [address] = sublinkContractId.split('.');
        return `${address}.charisma-token-subnet-v1`;
    };

    const handleBridgeToSubnetClick = async () => {
        if (!walletState.connected || !walletState.address) {
            toast.error("Please connect your wallet first");
            return;
        }

        const inputAmount = parseFloat(amountToBridgeTo);
        if (isNaN(inputAmount) || inputAmount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsProcessingDeposit(true);
        try {
            // Get token decimals (assume 6 if not specified)
            const tokenDecimals = sublink.tokenA.decimals || 6;
            // Convert to micro units (multiply by 10^decimals)
            const amount = Math.floor(inputAmount * Math.pow(10, tokenDecimals));

            // Parse contract IDs
            const [contractAddress, contractName] = sublink.contractId.split('.');
            const tokenInfo = parseTokenContractId(sublink.tokenA.contractId);

            // Set up post conditions
            const postConditions: PostCondition[] = [];

            // Add post condition for the token being sent
            if (tokenInfo.isStx) {
                // STX post condition
                postConditions.push(
                    Pc.principal(walletState.address).willSendEq(amount).ustx()
                );
            } else {
                // Fungible token post condition
                postConditions.push(
                    Pc.principal(walletState.address).willSendEq(amount).ft(
                        sublink.tokenA.contractId as `${string}.${string}`,
                        sublink.tokenA.identifier || tokenInfo.assetName
                    )
                );
            }

            console.log(`Bridging ${inputAmount} ${sublink.tokenA.symbol} to subnet via ${sublink.contractId}`);

            // Set up contract call parameters
            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: 'execute',
                functionArgs: [
                    uintCV(amount), // Amount in micro units
                    optionalCVOf(bufferCV(new Uint8Array([OP_DEPOSIT]))) // Opcode for deposit
                ],
                postConditions,
            };

            // Execute the transaction
            const result = await request('stx_callContract', params);

            if (result && result.txid) {
                toast.success("Bridge to Subnet transaction submitted!", {
                    description: `TxID: ${result.txid}`
                });
                setAmountToBridgeTo('');
            } else {
                throw new Error("Transaction failed or was rejected.");
            }
        } catch (error) {
            console.error("Bridge to Subnet error:", error);
            const errorMessage = (error instanceof Error && error.message)
                || (typeof error === 'string' ? error : 'An unknown error occurred.');
            toast.error("Failed to initiate transaction.", { description: errorMessage });
        } finally {
            setIsProcessingDeposit(false);
        }
    };

    const handleBridgeFromSubnetClick = async () => {
        if (!walletState.connected || !walletState.address) {
            toast.error("Please connect your wallet first");
            return;
        }

        const inputAmount = parseFloat(amountToBridgeFrom);
        if (isNaN(inputAmount) || inputAmount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsProcessingWithdraw(true);
        try {
            // Get token decimals (assume 6 if not specified)
            const tokenDecimals = sublink.tokenA.decimals || 6;
            // Convert to micro units (multiply by 10^decimals)
            const amount = Math.floor(inputAmount * Math.pow(10, tokenDecimals));

            // Parse contract IDs
            const [contractAddress, contractName] = sublink.contractId.split('.');
            const tokenInfo = parseTokenContractId(sublink.tokenA.contractId);

            // Set up post conditions for withdrawal
            // For withdrawals, we need a post-condition to ensure the subnet contract sends tokens to the user
            const postConditions: PostCondition[] = [];

            // Get the subnet token contract ID (typically at same address as the main contract)
            const subnetContractId = getSubnetTokenContractId(sublink.contractId);

            // Create the contract principal string
            const contractPrincipal = `${subnetContractId}`;

            // Add post condition for the token coming from the subnet contract
            if (tokenInfo.isStx) {
                // STX post condition
                postConditions.push(
                    Pc.principal(contractPrincipal)
                        .willSendEq(amount)
                        .ustx()
                );
            } else {
                // Fungible token post condition
                postConditions.push(
                    Pc.principal(contractPrincipal)
                        .willSendEq(amount)
                        .ft(sublink.tokenA.contractId as `${string}.${string}`,
                            sublink.tokenA.identifier || tokenInfo.assetName)
                );
            }

            console.log(`Bridging ${inputAmount} ${sublink.tokenB.symbol} from subnet via ${sublink.contractId}`);

            // Set up contract call parameters
            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: 'execute',
                functionArgs: [
                    uintCV(amount), // Amount in micro units
                    optionalCVOf(bufferCV(new Uint8Array([OP_WITHDRAW]))) // Opcode for withdraw
                ],
                postConditions,
            };

            // Execute the transaction
            const result = await request('stx_callContract', params);

            if (result && result.txid) {
                toast.success("Bridge from Subnet transaction submitted!", {
                    description: `TxID: ${result.txid}`
                });
                setAmountToBridgeFrom('');
            } else {
                throw new Error("Transaction failed or was rejected.");
            }
        } catch (error) {
            console.error("Bridge from Subnet error:", error);
            const errorMessage = (error instanceof Error && error.message)
                || (typeof error === 'string' ? error : 'An unknown error occurred.');
            toast.error("Failed to initiate transaction.", { description: errorMessage });
        } finally {
            setIsProcessingWithdraw(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center">
                    <ArrowRightLeft className="w-5 h-5 mr-2 text-primary" />
                    Bridge Assets
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor={`bridge-to-${sublink.contractId}`}>Bridge {sublink.tokenA.symbol} to Subnet</Label>
                    <div className="flex space-x-2">
                        <Input
                            id={`bridge-to-${sublink.contractId}`}
                            type="number"
                            placeholder={`Amount of ${sublink.tokenA.symbol} to bridge`}
                            value={amountToBridgeTo}
                            onChange={(e) => setAmountToBridgeTo(e.target.value)}
                            disabled={isProcessingDeposit || !walletState.connected}
                        />
                        <Button
                            onClick={handleBridgeToSubnetClick}
                            className="gap-2 w-full sm:w-auto whitespace-nowrap"
                            disabled={isProcessingDeposit || !walletState.connected || !amountToBridgeTo}
                        >
                            {isProcessingDeposit ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <TrendingUp className="w-4 h-4" />
                            )}
                            {isProcessingDeposit ? 'Processing...' : 'Bridge to Subnet'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Token: <Link href={`${explorerBaseUrl}${sublink.tokenA.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center">{sublink.tokenA.name} ({sublink.tokenA.symbol}) <ExternalLinkIcon className="w-3 h-3 ml-1 opacity-70" /></Link>
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor={`bridge-from-${sublink.contractId}`}>Bridge {sublink.tokenB.symbol} from Subnet</Label>
                    <div className="flex space-x-2">
                        <Input
                            id={`bridge-from-${sublink.contractId}`}
                            type="number"
                            placeholder={`Amount of ${sublink.tokenB.symbol} to bridge`}
                            value={amountToBridgeFrom}
                            onChange={(e) => setAmountToBridgeFrom(e.target.value)}
                            disabled={isProcessingWithdraw || !walletState.connected}
                        />
                        <Button
                            onClick={handleBridgeFromSubnetClick}
                            variant="outline"
                            className="gap-2 w-full sm:w-auto whitespace-nowrap"
                            disabled={isProcessingWithdraw || !walletState.connected || !amountToBridgeFrom}
                        >
                            {isProcessingWithdraw ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <TrendingDown className="w-4 h-4" />
                            )}
                            {isProcessingWithdraw ? 'Processing...' : 'Bridge from Subnet'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Token: <Link href={`${explorerBaseUrl}${sublink.tokenB.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center">{sublink.tokenB.name} ({sublink.tokenB.symbol}) <ExternalLinkIcon className="w-3 h-3 ml-1 opacity-70" /></Link>
                    </p>
                </div>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
                Sublink Contract: <Link href={`${explorerBaseUrl}${sublink.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center font-mono">{sublink.contractId.split('.')[0] + '...' + sublink.contractId.split('.')[1].slice(-4)} <ExternalLinkIcon className="w-3 h-3 ml-1 opacity-70" /></Link>
            </CardFooter>
        </Card>
    );
} 