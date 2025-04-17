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
    name?: string; // Allow overlapping name from contract
    description?: string;
    image?: string; // URL to the image
    // Add other relevant metadata fields as needed
}

interface TokenData {
    name: string | null
    symbol: string | null
    decimals: number | null
    totalSupply: string | null
    tokenUri: string | null
    metadata?: TokenMetadata | null // Add metadata field
}

const styles = {
    cardContent: {
        padding: 'var(--card-padding)',
    },
    loadingContainer: {
        display: 'flex',
        alignItems: 'center',
        color: 'var(--muted)',
    },
    loadingIcon: {
        height: '1rem',
        width: '1rem',
        marginRight: '0.5rem',
    },
    errorText: {
        color: 'var(--destructive)',
    },
    dataContainer: {
        display: 'flex',
        alignItems: 'flex-start',
        // space-x-4 handled by marginRight on image container
    },
    imageContainer: {
        minWidth: '120px', // From previous inline style
        marginRight: '24px', // From previous inline style + space-x-4
        flexShrink: 0,
    },
    image: {
        width: '100%',
        borderRadius: '0.375rem', // rounded-md
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', // shadow-sm
        aspectRatio: '1 / 1', // aspect-square
        objectFit: 'cover' as const, // Cast to literal type
    },
    placeholderImage: {
        width: '100%',
        backgroundColor: 'var(--border)',
        borderRadius: '0.375rem',
        aspectRatio: '1 / 1',
    },
    textContentContainer: {
        flexGrow: 1,
        width: '100%',
        // space-y-3 handled by marginTop on children
        minWidth: 0, // Needed for flex-grow + truncate
    },
    tokenName: {
        fontSize: '1.125rem', // text-lg
        lineHeight: '1.75rem',
        fontWeight: 600, // font-semibold
        overflow: 'hidden', // truncate
        textOverflow: 'ellipsis', // truncate
        whiteSpace: 'nowrap', // truncate
    },
    tokenSymbol: {
        marginLeft: '8px',
        fontSize: '14px',
        fontWeight: 'normal', // font-normal implied
        color: 'var(--muted)', // text-muted
    },
    descriptionText: {
        fontSize: '0.875rem', // text-sm
        color: 'var(--muted)', // text-muted
        // line-clamp-3 properties
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical' as const, // Cast to literal type
        overflow: 'hidden',
    },
    detailsListContainer: {
        paddingTop: '0.75rem', // pt-3
        borderTop: '1px solid var(--border)', // border-t border-border
        marginTop: '0.75rem', // space-y-3
    },
    detailsList: {
        // space-y-1 handled by marginTop on children
        fontSize: '0.75rem', // text-xs
    },
    detailsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', // grid-cols-2
        columnGap: '0.25rem', // gap-x-1
        marginTop: '0.25rem', // space-y-1 (applied to all rows after first)
    },
    detailsTerm: {
        fontWeight: 500, // font-medium
        color: 'var(--muted)', // text-muted
    },
    detailsDefinition: {
        fontFamily: 'monospace', // font-mono
        textAlign: 'right' as const, // Cast to literal type
        wordBreak: 'break-all' as const, // Cast wordBreak as well for safety
    },
    link: { // Base styles for link
        color: 'var(--primary)',
        textDecoration: 'none',
    },
    noDataText: {
        color: 'var(--muted)'
    }
};

export function TokenInfo({ network, className }: TokenInfoProps) {
    const [tokenData, setTokenData] = useState<TokenData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchTokenInfo()
    }, [network])

    const fetchTokenInfo = async () => {
        setIsLoading(true)
        setError(null)
        setTokenData(null) // Reset data on new fetch

        try {
            const [contractAddress, contractName] = parseContract(WELSH_CREDITS_CONTRACT)
            const functions = [
                { name: 'get-name', key: 'name' },
                { name: 'get-symbol', key: 'symbol' },
                { name: 'get-decimals', key: 'decimals' },
                { name: 'get-total-supply', key: 'totalSupply' },
                { name: 'get-token-uri', key: 'tokenUri' },
            ]

            const promises = functions.map(fn =>
                fetchCallReadOnlyFunction({
                    contractAddress,
                    contractName,
                    functionName: fn.name,
                    functionArgs: [],
                    network,
                    senderAddress: contractAddress, // Use contract address for read-only calls
                })
            );

            const results = await Promise.all(promises);

            const basicData: Partial<TokenData> = {};
            results.forEach((result: any, index) => {
                const key = functions[index].key as keyof TokenData;
                // Revert to the previous CV parsing logic
                if (result && result.value && result.value.value && result.value.value.value) {
                    basicData[key] = result.value.value.value
                } else if (result && result.value && result.value.value) {
                    basicData[key] = result.value.value
                } else {
                    basicData[key] = null; // Handle cases where the structure might be different or null
                }
            });

            let fetchedMetadata: TokenMetadata | null = null;
            if (basicData.tokenUri) {
                try {
                    const response = await fetch(basicData.tokenUri);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    fetchedMetadata = await response.json();
                } catch (metaError) {
                    console.warn(`Failed to fetch or parse metadata from ${basicData.tokenUri}:`, metaError);
                    // Keep basicData, just won't have metadata
                }
            }

            setTokenData({ ...basicData, metadata: fetchedMetadata } as TokenData);

        } catch (err) {
            console.error("Error fetching token info:", err)
            setError("Failed to load token information.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className={`card ${className || ''}`}> {/* Standard card */}
            <div className="card-header">
                <h2 className="card-title">Token Information (SIP-010)</h2>
            </div>
            <div style={styles.cardContent}> {/* Use style for card-content padding */}
                {isLoading ? (
                    <div style={styles.loadingContainer}>
                        <Loader2 className="animate-spin" style={styles.loadingIcon} />
                        <span>Loading token data...</span>
                    </div>
                ) : error ? (
                    <p style={styles.errorText}>{error}</p>
                ) : tokenData ? (
                    <div style={styles.dataContainer}> {/* Flex container: image | text */}
                        {/* Image Column */}
                        <div style={styles.imageContainer}> {/* Increased min-width */}
                            {tokenData.metadata?.image ? (
                                <img
                                    src={tokenData.metadata.image}
                                    alt={tokenData.metadata.name || tokenData.name || 'Token Image'}
                                    style={styles.image}
                                    width={120}
                                    height={120}
                                />
                            ) : (
                                <div style={styles.placeholderImage}></div>
                            )}
                        </div>

                        {/* Text Content Column */}
                        <div style={styles.textContentContainer}> {/* Takes remaining space, vertical spacing */}
                            {/* Name & Symbol */}
                            <h3 style={styles.tokenName}> {/* Slightly larger name */}
                                {tokenData.name || tokenData.metadata?.name || 'Unnamed Token'}
                                {tokenData.symbol && (
                                    <span style={styles.tokenSymbol}>({tokenData.symbol})</span>
                                )}
                            </h3>

                            {/* Description */}
                            {tokenData.metadata?.description && (
                                <p style={styles.descriptionText}> {/* Limit description lines */}
                                    {tokenData.metadata.description}
                                </p>
                            )}

                            {/* Details List */}
                            <div style={styles.detailsListContainer}>
                                <dl style={styles.detailsList}>
                                    <div style={{ ...styles.detailsRow, marginTop: 0 }}> {/* First row no margin */}
                                        <dt style={styles.detailsTerm}>Decimals:</dt>
                                        <dd style={styles.detailsDefinition}>{tokenData.decimals !== null ? tokenData.decimals : 'N/A'}</dd>
                                    </div>
                                    <div style={styles.detailsRow}>
                                        <dt style={styles.detailsTerm}>Total Supply:</dt>
                                        <dd style={styles.detailsDefinition}>{tokenData.totalSupply || 'N/A'}</dd>
                                    </div>
                                    <div style={styles.detailsRow}>
                                        <dt style={styles.detailsTerm}>Token URI:</dt>
                                        <dd style={styles.detailsDefinition}>
                                            {tokenData.tokenUri ? (
                                                <a href={tokenData.tokenUri} target="_blank" rel="noopener noreferrer" style={styles.link} className="hover:underline">
                                                    View
                                                </a>
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
                    <p style={styles.noDataText}>No token data available.</p>
                )}
            </div>
        </div>
    )
} 