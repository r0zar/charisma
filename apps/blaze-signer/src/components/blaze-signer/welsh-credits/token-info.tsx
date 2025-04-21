"use client"

import React, { useState, useEffect } from "react"
import { StacksNetwork } from "@stacks/network"
import {
    fetchCallReadOnlyFunction,
    cvToString,
    ClarityValue,
    cvToValue
} from "@stacks/transactions"
import { Loader2 } from "@repo/ui/icons"
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/card"
import { cn } from "@repo/ui/utils"
import Link from "next/link"
import {
    WELSH_CREDITS_CONTRACT,
    WELSH_CREDITS_DECIMALS,
    parseContract
} from "../../../constants/contracts"

interface TokenInfoProps {
    network: StacksNetwork
    className?: string
}

interface TokenMetadata {
    name?: string;
    description?: string;
    image?: string;
}

interface TokenData {
    name: string | null
    symbol: string | null
    decimals: number | null
    totalSupply: string | null
    tokenUri: string | null
    metadata?: TokenMetadata | null
}

const FALLBACK_TOKEN_DATA: TokenData = {
    name: "Welsh Credits",
    symbol: "WELSH",
    decimals: 6,
    totalSupply: "1000000000000",
    tokenUri: null,
    metadata: {
        name: "Welsh Credits",
        description: "A fungible token for the Stacks blockchain used for testing the Blaze Protocol contract",
        image: undefined
    }
};

export function TokenInfo({ network, className }: TokenInfoProps) {
    const [tokenData, setTokenData] = useState<TokenData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchTokenInfo().catch(e => {
            console.error("Fatal error in fetchTokenInfo:", e);
            setError(`Network error: ${e.message}`);
            // Use fallback data in production if needed
            // setTokenData(FALLBACK_TOKEN_DATA);
            setIsLoading(false);
        });
    }, [network]);

    const fetchTokenInfo = async () => {
        setIsLoading(true)
        setError(null)
        setTokenData(null) // Reset data on new fetch

        try {
            const [contractAddress, contractName] = parseContract(WELSH_CREDITS_CONTRACT)
            console.log(`Fetching token info from contract: ${contractAddress}.${contractName}`)

            const functions = [
                { name: 'get-name', key: 'name' },
                { name: 'get-symbol', key: 'symbol' },
                { name: 'get-decimals', key: 'decimals' },
                { name: 'get-total-supply', key: 'totalSupply' },
                { name: 'get-token-uri', key: 'tokenUri' },
            ]

            const promises = functions.map(fn => {
                console.log(`Calling function: ${fn.name}`)
                return fetchCallReadOnlyFunction({
                    contractAddress,
                    contractName,
                    functionName: fn.name,
                    functionArgs: [],
                    network,
                    senderAddress: contractAddress, // Use contract address for read-only calls
                }).catch(err => {
                    console.error(`Error calling ${fn.name}:`, err)
                    return null; // Return null on error to avoid failing all promises
                })
            });

            const results = await Promise.all(promises);
            console.log('Function call results:', results)

            const basicData: Partial<TokenData> = {};
            results.forEach((result: any, index) => {
                const fn = functions[index];
                const key = fn.key as keyof TokenData;

                if (!result) {
                    console.log(`No result for ${fn.name}`)
                    // Ensure type compatibility when assigning empty strings or nulls
                    if (fn.key === 'name' || fn.key === 'symbol' || fn.key === 'tokenUri') {
                        (basicData[key] as string | null) = '';
                    } else {
                        basicData[key] = null;
                    }
                    return;
                }

                console.log(`Processing result for ${fn.name}:`, result)

                try {
                    // Simplify value extraction from Clarity values
                    if (typeof result === 'object') {
                        // Use safe property access pattern
                        const value = result?.value;

                        if (value && typeof value === 'object') {
                            // Try to extract Clarity value
                            const extractedValue = value.value?.value ?? value.value ?? value;
                            // For string properties, ensure we don't assign null
                            if (fn.key === 'name' || fn.key === 'symbol' || fn.key === 'tokenUri') {
                                basicData[key] = extractedValue ?? '';
                            } else {
                                basicData[key] = extractedValue;
                            }
                        } else {
                            // For string properties, ensure we don't assign null
                            if (fn.key === 'name' || fn.key === 'symbol' || fn.key === 'tokenUri') {
                                basicData[key] = value ?? '';
                            } else {
                                basicData[key] = value ?? null;
                            }
                        }
                    } else {
                        // For string properties, ensure we don't assign null
                        if (fn.key === 'name' || fn.key === 'symbol' || fn.key === 'tokenUri') {
                            basicData[key] = result ?? '';
                        } else {
                            basicData[key] = result ?? null;
                        }
                    }
                } catch (parseErr) {
                    console.error(`Error parsing result for ${fn.name}:`, parseErr);
                    // Ensure type compatibility when assigning empty strings or nulls
                    if (fn.key === 'name' || fn.key === 'symbol' || fn.key === 'tokenUri') {
                        (basicData[key] as string | null) = '';
                    } else {
                        basicData[key] = null;
                    }
                }
            });

            console.log('Basic token data:', basicData)

            let fetchedMetadata: TokenMetadata | null = null;
            if (basicData.tokenUri) {
                try {
                    console.log(`Fetching metadata from ${basicData.tokenUri}`)
                    const response = await fetch(basicData.tokenUri);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    fetchedMetadata = await response.json();
                    console.log('Fetched metadata:', fetchedMetadata)
                } catch (metaError) {
                    console.warn(`Failed to fetch or parse metadata from ${basicData.tokenUri}:`, metaError);
                    // Keep basicData, just won't have metadata
                }
            }

            setTokenData({ ...basicData, metadata: fetchedMetadata } as TokenData);

        } catch (err) {
            console.error("Error fetching token info:", err)
            setError(`Failed to load token information: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Token Information (SIP-010)</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center text-muted">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        <span>Loading token data...</span>
                    </div>
                ) : error ? (
                    <p className="text-destructive">{error}</p>
                ) : tokenData ? (
                    <div className="flex items-start space-x-6">
                        {/* Image Column */}
                        <div className="max-w-[120px] flex-shrink-0">
                            {tokenData.metadata?.image ? (
                                <img
                                    src={tokenData.metadata.image}
                                    alt={tokenData.metadata.name || tokenData.name || 'Token Image'}
                                    className="w-full rounded-md shadow-sm aspect-square object-cover"
                                    width={120}
                                    height={120}
                                    loading="eager"
                                />
                            ) : (
                                <div className="w-full rounded-md bg-border aspect-square"></div>
                            )}
                        </div>

                        {/* Text Content Column */}
                        <div className="flex-grow w-full min-w-0 space-y-3">
                            {/* Name & Symbol */}
                            <h3 className="text-lg leading-7 font-semibold truncate">
                                {tokenData.name || tokenData.metadata?.name || 'Unnamed Token'}
                                {tokenData.symbol && (
                                    <span className="ml-2 text-sm font-normal text-muted">({tokenData.symbol})</span>
                                )}
                            </h3>

                            {/* Description */}
                            {tokenData.metadata?.description && (
                                <p className="text-sm text-muted line-clamp-3">
                                    {tokenData.metadata.description}
                                </p>
                            )}

                            {/* Details List */}
                            <div className="pt-3 border-t border-border">
                                <dl className="text-xs space-y-1">
                                    <div className="grid grid-cols-2 gap-x-1">
                                        <dt className="font-medium text-muted">Decimals:</dt>
                                        <dd className="font-mono text-right break-all">{tokenData.decimals !== null ? tokenData.decimals : 'N/A'}</dd>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-1">
                                        <dt className="font-medium text-muted">Total Supply:</dt>
                                        <dd className="font-mono text-right break-all">{tokenData.totalSupply || 'N/A'}</dd>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-1">
                                        <dt className="font-medium text-muted">Token URI:</dt>
                                        <dd className="font-mono text-right break-all">
                                            {tokenData.tokenUri ? (
                                                <Link
                                                    href={tokenData.tokenUri}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary"
                                                >
                                                    View
                                                </Link>
                                            ) : (
                                                'N/A'
                                            )}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-muted">No token data available.</p>
                )}
            </CardContent>
        </Card>
    )
} 