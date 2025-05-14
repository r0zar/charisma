'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Vault } from '@/lib/vaultService';
import { ArrowRightLeft, TrendingDown, TrendingUp, ExternalLinkIcon, Loader2, RefreshCw, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/lib/context/app-context';
import { request } from '@stacks/connect';
import { uintCV, bufferCV, optionalCVOf, Pc, PostCondition, cvToValue } from '@stacks/transactions';
import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV } from '@stacks/transactions';
import { toast } from "sonner";
import { KraxelPriceData } from '@repo/tokens';

// Define props for SublinkBridgeCard
interface SublinkBridgeCardProps {
    sublink: Vault;
    prices?: KraxelPriceData;
}

// Define constants for the operation codes
const OP_DEPOSIT = 0x05; // Opcode for deposit (bridge to subnet)
const OP_WITHDRAW = 0x06; // Opcode for withdraw (bridge from subnet)

export function SublinkBridgeCard({ sublink, prices = {} }: SublinkBridgeCardProps) {
    const { walletState } = useApp();
    const [amountToBridgeTo, setAmountToBridgeTo] = useState<string>('');
    const [amountToBridgeFrom, setAmountToBridgeFrom] = useState<string>('');
    const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
    const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
    const [mainnetBalance, setMainnetBalance] = useState<number | null>(null);
    const [subnetBalance, setSubnetBalance] = useState<number | null>(null);
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);

    const explorerBaseUrl = "https://explorer.stacks.co/txid/";
    const tokenDecimals = sublink.tokenA.decimals || 6;

    // Get token price from the prices object or default to 0
    const tokenPrice = prices?.[sublink.tokenA.contractId] || 0;

    // Calculate USD values based on input amounts
    const depositUsdValue = parseFloat(amountToBridgeTo) * tokenPrice || 0;
    const withdrawUsdValue = parseFloat(amountToBridgeFrom) * tokenPrice || 0;

    // Format USD value for display
    const formatUsdValue = (value: number): string => {
        if (value === 0) return '$0.00';
        if (value < 0.01) return '< $0.01';
        return value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

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
        // Use the tokenBContract directly from the sublink metadata if available
        if (sublink.tokenBContract) {
            console.log(`Using sublink.tokenBContract: ${sublink.tokenBContract}`);
            return sublink.tokenBContract;
        }

        // Fallback to tokenB.contractId if tokenBContract doesn't exist
        if (sublink.tokenB && sublink.tokenB.contractId) {
            console.log(`Using sublink.tokenB.contractId: ${sublink.tokenB.contractId}`);
            return sublink.tokenB.contractId;
        }

        // Last resort fallback (should not happen with proper data)
        console.warn("No tokenBContract or tokenB.contractId found in sublink metadata, using fallback");
        const [address] = sublinkContractId.split('.');
        const fallback = `${address}.charisma-token-subnet-v1`;
        console.log(`Using fallback subnet contract: ${fallback}`);
        return fallback;
    };

    // Function to fetch token balances (mainnet and subnet)
    const fetchTokenBalances = async (refreshing = false) => {
        if (!walletState.connected || !walletState.address) {
            setMainnetBalance(null);
            setSubnetBalance(null);
            return;
        }

        if (refreshing) {
            setIsRefreshingBalances(true);
        } else {
            setIsLoadingBalances(true);
        }

        try {
            // Parse token info
            const tokenInfo = parseTokenContractId(sublink.tokenA.contractId);
            const subnetContractId = getSubnetTokenContractId(sublink.contractId);

            // Fetch mainnet token balance
            let mainnetTokenBalance = 0;
            if (tokenInfo.isStx) {
                // For STX tokens
                const stxBalanceResponse = await fetch(`https://stacks-node-api.mainnet.stacks.co/extended/v1/address/${walletState.address}/balances`);
                const stxBalanceData = await stxBalanceResponse.json();
                mainnetTokenBalance = parseInt(stxBalanceData.stx.balance);
            } else {
                // For fungible tokens (SIP-010)
                const contractAddress = tokenInfo.address;
                const contractName = tokenInfo.contractName;

                try {
                    const balanceResult = await callReadOnlyFunction(
                        contractAddress,
                        contractName,
                        'get-balance',
                        [principalCV(walletState.address)]
                    );

                    if (balanceResult && typeof balanceResult === 'object' && 'value' in balanceResult) {
                        mainnetTokenBalance = parseInt(balanceResult.value.toString());
                    }
                } catch (error) {
                    console.error("Error fetching mainnet token balance:", error);
                    // Try fallback method if available
                }
            }

            // Fetch subnet token balance - uses the subnet contract's get-balance function
            let subnetTokenBalance = 0;
            try {
                const [subnetContractAddress, subnetContractName] = subnetContractId.split('.');

                const subnetBalanceResult = await callReadOnlyFunction(
                    subnetContractAddress,
                    subnetContractName,
                    'get-balance',
                    [principalCV(walletState.address)]
                );

                if (subnetBalanceResult && typeof subnetBalanceResult === 'object' && 'value' in subnetBalanceResult) {
                    subnetTokenBalance = parseInt(subnetBalanceResult.value.toString());
                }
            } catch (error) {
                console.error("Error fetching subnet token balance:", error);
            }

            // Set the balances in human-readable format
            setMainnetBalance(mainnetTokenBalance / Math.pow(10, tokenDecimals));
            setSubnetBalance(subnetTokenBalance / Math.pow(10, tokenDecimals));
        } catch (error) {
            console.error("Error fetching token balances:", error);
            toast.error("Failed to fetch token balances");
        } finally {
            setIsLoadingBalances(false);
            setIsRefreshingBalances(false);
        }
    };

    // Format balance display
    const formatBalance = (balance: number | null, decimals: number = tokenDecimals) => {
        if (balance === null) return '-';
        if (balance === 0) return '0';

        // Use the token's decimals to determine display precision
        const minDisplayValue = 1 / Math.pow(10, decimals);
        if (balance < minDisplayValue) return `< ${minDisplayValue.toLocaleString()}`;

        // Show exact balance without rounding
        // Convert to string and ensure we display all significant digits
        const balanceStr = balance.toString();

        // If the number has a decimal part
        if (balanceStr.includes('.')) {
            const [intPart, decimalPart] = balanceStr.split('.');
            // Format the integer part with commas
            const formattedIntPart = parseInt(intPart).toLocaleString();
            // Return the formatted integer part with the exact decimal part
            return `${formattedIntPart}.${decimalPart}`;
        }

        // If it's a whole number, just format with commas
        return parseInt(balanceStr).toLocaleString();
    };

    // Fetch balances when component mounts or wallet changes
    useEffect(() => {
        fetchTokenBalances();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletState.connected, walletState.address, sublink.contractId]);

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

        // Check if user has sufficient balance
        if (mainnetBalance !== null && inputAmount > mainnetBalance) {
            toast.error(`Insufficient balance. You have ${formatBalance(mainnetBalance, tokenDecimals)} ${sublink.tokenA.symbol}`);
            return;
        }

        setIsProcessingDeposit(true);
        try {
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
                toast.success("Enter Subnet transaction submitted!", {
                    description: `TxID: ${result.txid}`
                });
                setAmountToBridgeTo('');

                // Wait briefly then refresh balances
                setTimeout(() => fetchTokenBalances(true), 1500);
            } else {
                throw new Error("Transaction failed or was rejected.");
            }
        } catch (error) {
            console.error("Enter Subnet error:", error);
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

        // Check if user has sufficient subnet balance
        if (subnetBalance !== null && inputAmount > subnetBalance) {
            toast.error(`Insufficient subnet balance. You have ${formatBalance(subnetBalance, tokenDecimals)} ${sublink.tokenB.symbol}`);
            return;
        }

        setIsProcessingWithdraw(true);
        try {
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
                toast.success("Exit Subnet transaction submitted!", {
                    description: `TxID: ${result.txid}`
                });
                setAmountToBridgeFrom('');

                // Wait briefly then refresh balances
                setTimeout(() => fetchTokenBalances(true), 1500);
            } else {
                throw new Error("Transaction failed or was rejected.");
            }
        } catch (error) {
            console.error("Exit Subnet error:", error);
            const errorMessage = (error instanceof Error && error.message)
                || (typeof error === 'string' ? error : 'An unknown error occurred.');
            toast.error("Failed to initiate transaction.", { description: errorMessage });
        } finally {
            setIsProcessingWithdraw(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle className="flex items-center">
                        <ArrowRightLeft className="w-5 h-5 mr-2 text-primary" />
                        Bridge Assets
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Vault: <Link href={`${explorerBaseUrl}${sublink.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center font-mono">{sublink.contractId.split('.')[0] + '...' + sublink.contractId.split('.')[1].slice(-4)} <ExternalLinkIcon className="w-3 h-3 ml-1 opacity-70" /></Link>
                    </p>
                </div>
                {walletState.connected && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => fetchTokenBalances(true)}
                        disabled={isRefreshingBalances || isLoadingBalances}
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshingBalances ? 'animate-spin' : ''}`} />
                        <span className="sr-only">Refresh balances</span>
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor={`bridge-to-${sublink.contractId}`}>Enter Subnet</Label>
                        {walletState.connected && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                Mainnet Balance: {isLoadingBalances ? 'Loading...' : `${formatBalance(mainnetBalance, tokenDecimals)} ${sublink.tokenA.symbol}`}
                                {!isLoadingBalances && mainnetBalance !== null && mainnetBalance > 0 && (
                                    <button
                                        type="button"
                                        className="cursor-pointer text-xs text-primary hover:text-primary/80 font-medium"
                                        onClick={() => setAmountToBridgeTo(mainnetBalance?.toString() || '0')}
                                    >
                                        Max
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex space-x-2">
                        <div className="relative flex-grow">
                            <Input
                                id={`bridge-to-${sublink.contractId}`}
                                type="number"
                                placeholder={`Amount to bridge into subnet`}
                                value={amountToBridgeTo}
                                onChange={(e) => setAmountToBridgeTo(e.target.value)}
                                disabled={isProcessingDeposit || !walletState.connected}
                            />
                            {amountToBridgeTo && !isNaN(parseFloat(amountToBridgeTo)) && tokenPrice > 0 && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-xs text-muted-foreground">
                                    <DollarSign className="h-3 w-3 mr-0.5" />
                                    {formatUsdValue(depositUsdValue)}
                                </div>
                            )}
                        </div>
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
                            {isProcessingDeposit ? 'Processing...' : 'Enter Subnet'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Token: <Link href={`${explorerBaseUrl}${sublink.tokenA.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center">{sublink.tokenA.name} ({sublink.tokenA.symbol}) <ExternalLinkIcon className="w-3 h-3 ml-1 opacity-70" /></Link>
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor={`bridge-from-${sublink.contractId}`}>Exit Subnet</Label>
                        {walletState.connected && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                Subnet Balance: {isLoadingBalances ? 'Loading...' : `${formatBalance(subnetBalance, tokenDecimals)} ${sublink.tokenB.symbol}`}
                                {!isLoadingBalances && subnetBalance !== null && subnetBalance > 0 && (
                                    <button
                                        type="button"
                                        className="cursor-pointer text-xs text-primary hover:text-primary/80 font-medium"
                                        onClick={() => setAmountToBridgeFrom(subnetBalance?.toString() || '0')}
                                    >
                                        Max
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex space-x-2">
                        <div className="relative flex-grow">
                            <Input
                                id={`bridge-from-${sublink.contractId}`}
                                type="number"
                                placeholder={`Amount to bridge out of subnet`}
                                value={amountToBridgeFrom}
                                onChange={(e) => setAmountToBridgeFrom(e.target.value)}
                                disabled={isProcessingWithdraw || !walletState.connected}
                            />
                            {amountToBridgeFrom && !isNaN(parseFloat(amountToBridgeFrom)) && tokenPrice > 0 && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-xs text-muted-foreground">
                                    <DollarSign className="h-3 w-3 mr-0.5" />
                                    {formatUsdValue(withdrawUsdValue)}
                                </div>
                            )}
                        </div>
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
                            {isProcessingWithdraw ? 'Processing...' : 'Exit Subnet'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Token: <Link href={`${explorerBaseUrl}${sublink.tokenB.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center">{sublink.tokenB.name} ({sublink.tokenB.symbol}) <ExternalLinkIcon className="w-3 h-3 ml-1 opacity-70" /></Link>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
} 