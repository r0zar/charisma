"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Search, X, HelpCircle } from "lucide-react";
import { TokenCacheData, getTokenMetadataCached } from '@repo/tokens';
import { truncateAddress } from '@/lib/utils/token-utils';

// Token Selection Step Component
export const TokenSelectionStep = ({
    onSelectToken1,
    onSelectToken2,
    token1Symbol,
    excludedToken,
    predefinedTokens,
    isLoadingTokens,
    tokenLoadError
}: {
    onSelectToken1: (token: TokenCacheData) => void;
    onSelectToken2: (token: TokenCacheData) => void;
    token1Symbol: string;
    excludedToken?: string | null;
    predefinedTokens: TokenCacheData[];
    isLoadingTokens: boolean;
    tokenLoadError: string | null;
}) => {
    const [selectingToken2, setSelectingToken2] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customAddress, setCustomAddress] = useState("");
    const [customError, setCustomError] = useState<string | null>(null);

    // Custom token fetch state
    const [isFetchingToken, setIsFetchingToken] = useState(false);
    const [fetchedToken, setFetchedToken] = useState<TokenCacheData | null>(null);

    const [filteredTokens, setFilteredTokens] = useState<TokenCacheData[]>(predefinedTokens);
    const [searchQuery, setSearchQuery] = useState("");

    // State to track image loading errors for the token list
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

    // Function to handle image loading error for token list
    const handleImageError = (contractId: string) => {
        setImageErrors(prev => ({ ...prev, [contractId]: true }));
    };

    // Function to fetch token metadata by contract ID
    const fetchTokenMetadata = async (contractIdInput: string) => {
        const contractId = contractIdInput.trim();
        if (!contractId) {
            setCustomError("Contract ID is required");
            return;
        }
        if (!/^[A-Z0-9]+\.[a-zA-Z0-9\-]+$/.test(contractId)) {
            setCustomError("Invalid contract ID format. Should be like: SP...token-name");
            return;
        }
        setCustomError(null);
        setIsFetchingToken(true);
        try {
            const tokenData = await getTokenMetadataCached(contractId);
            if (!tokenData || !tokenData.contractId) {
                throw new Error('Token not found or invalid data returned.');
            }
            setFetchedToken(tokenData);
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            setCustomError(error instanceof Error ? error.message : 'Failed to fetch token data');
            setFetchedToken(null);
        } finally {
            setIsFetchingToken(false);
        }
    };

    // Update filtered tokens when predefinedTokens change
    useEffect(() => {
        setFilteredTokens(predefinedTokens);
    }, [predefinedTokens]);

    // Filter tokens based on search query
    useEffect(() => {
        if (!searchQuery) {
            setFilteredTokens(predefinedTokens);
            return;
        }
        const query = searchQuery.toLowerCase();
        const currentTokens = selectingToken2
            ? predefinedTokens.filter(token => token.contractId !== excludedToken)
            : predefinedTokens;

        const filtered = currentTokens.filter(
            token =>
                token.symbol?.toLowerCase().includes(query) ||
                token.name?.toLowerCase().includes(query) ||
                token.contractId?.toLowerCase().includes(query)
        );
        setFilteredTokens(filtered);
    }, [searchQuery, predefinedTokens, selectingToken2, excludedToken]);

    const handleCustomSubmit = () => {
        if (!fetchedToken) {
            setCustomError("Please fetch a valid token first");
            return;
        }
        setCustomError(null);
        if (!selectingToken2) {
            onSelectToken1(fetchedToken);
            setSelectingToken2(true);
            setSearchQuery("");
        } else {
            onSelectToken2(fetchedToken);
        }
        setShowCustomInput(false);
        setCustomAddress("");
        setFetchedToken(null);
    };

    const handleCancelCustom = () => {
        setShowCustomInput(false);
        setCustomAddress("");
        setCustomError(null);
        setFetchedToken(null);
    };

    const tokensToDisplay = selectingToken2
        ? filteredTokens.filter(token => token.contractId !== excludedToken)
        : filteredTokens;

    return (
        <div className="space-y-8">
            {!selectingToken2 ? (
                <>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Select First Token</h2>
                        <p className="text-muted-foreground">Choose the first token for your liquidity pool</p>
                    </div>

                    {/* Search Bar */}
                    {!showCustomInput && (
                        <div className="relative mx-auto max-w-md mb-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8 pr-8"
                                    placeholder="Search tokens..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <X
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                                        onClick={() => setSearchQuery("")}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {showCustomInput ? (
                        <Card className="p-6">
                            <h3 className="font-medium mb-4">Enter Custom Token Details</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="customAddress">Token Contract ID</Label>
                                    <Input
                                        id="customAddress"
                                        value={customAddress}
                                        onChange={(e) => {
                                            setCustomAddress(e.target.value);
                                            setCustomError(null);
                                            setFetchedToken(null);
                                        }}
                                        placeholder="e.g. SP...token-name"
                                    />
                                </div>

                                <div>
                                    <Button
                                        onClick={() => fetchTokenMetadata(customAddress)}
                                        disabled={isFetchingToken || !customAddress.trim()}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        {isFetchingToken ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Fetching Token...
                                            </>
                                        ) : (
                                            <>Fetch Token Details</>
                                        )}
                                    </Button>
                                </div>

                                {fetchedToken && (
                                    <div className="border rounded-md p-4 bg-muted/10 space-y-3">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden relative">
                                                {fetchedToken.image ? (
                                                    <Image
                                                        src={fetchedToken.image}
                                                        alt={fetchedToken.symbol || 'token'}
                                                        layout="fill"
                                                        objectFit="cover"
                                                        sizes="40px"
                                                        quality={95}
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div className="text-sm font-bold text-primary/60">{(fetchedToken.symbol || 'T').charAt(0).toUpperCase()}</div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-medium">{fetchedToken.symbol}</h4>
                                                <p className="text-sm text-muted-foreground">{fetchedToken.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            <span className="block mb-1">Contract ID:</span>
                                            <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">{truncateAddress(fetchedToken.contractId)}</span>
                                        </div>
                                    </div>
                                )}

                                {customError && (
                                    <div className="text-destructive text-sm pt-1">{customError}</div>
                                )}

                                <div className="flex justify-end space-x-2 pt-2">
                                    <Button variant="outline" onClick={handleCancelCustom}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCustomSubmit}
                                        disabled={!fetchedToken}
                                    >
                                        Use Custom Token
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div>
                            {isLoadingTokens ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : tokenLoadError ? (
                                <div className="text-center text-destructive mb-4">
                                    {tokenLoadError}
                                </div>
                            ) : tokensToDisplay.length === 0 && !searchQuery ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No tokens available. Try adding a custom token.</p>
                                </div>
                            ) : tokensToDisplay.length === 0 && searchQuery ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No tokens match your search "{searchQuery}".</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {tokensToDisplay.map((token) => (
                                        <Card
                                            key={token.contractId}
                                            className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative"
                                            onClick={() => {
                                                if (!selectingToken2) {
                                                    onSelectToken1(token);
                                                    setSelectingToken2(true);
                                                    setSearchQuery("");
                                                } else {
                                                    onSelectToken2(token);
                                                }
                                            }}
                                        >
                                            {token.tokenAContract && token.tokenBContract && (
                                                <span className="absolute top-2 left-2 bg-gray-800 text-gray-200 border border-gray-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full z-20">
                                                    LP Token
                                                </span>
                                            )}
                                            {token.type === 'SUBNET' && (
                                                <span className="absolute top-2 right-2 bg-gray-800 text-gray-200 border border-gray-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full z-20">
                                                    Subnet
                                                </span>
                                            )}
                                            <div className="p-6 flex flex-col items-center">
                                                <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-4 overflow-hidden relative bg-muted">
                                                    {token.image && !imageErrors[token.contractId] ? (
                                                        <Image
                                                            src={token.image}
                                                            alt={token.symbol || token.name || 'token'}
                                                            layout="fill"
                                                            objectFit="cover"
                                                            sizes="64px"
                                                            quality={95}
                                                            onError={() => handleImageError(token.contractId)}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full font-bold text-primary/60 flex items-center justify-center text-xl">
                                                            {(token.symbol || token.name || 'T').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className="font-medium truncate max-w-full">{token.symbol || 'N/A'}</h3>
                                                <p className="text-sm text-muted-foreground truncate max-w-full">{token.name || 'Unknown Name'}</p>
                                                <p className="text-xs text-muted-foreground font-mono group-hover:text-primary/80 transition-colors">
                                                    {truncateAddress(token.contractId)}
                                                </p>
                                            </div>
                                        </Card>
                                    ))}
                                    <Card className="cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => setShowCustomInput(true)}
                                    >
                                        <div className="p-6 flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                                <HelpCircle className="w-8 h-8 text-primary/60" />
                                            </div>
                                            <h3 className="font-medium">Custom Token</h3>
                                            <p className="text-sm text-muted-foreground">Enter contract ID manually</p>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Select Second Token</h2>
                        <p className="text-muted-foreground">Choose the second token for your {token1Symbol} liquidity pool</p>
                    </div>

                    {/* Search Bar for Second Token */}
                    {!showCustomInput && (
                        <div className="relative mx-auto max-w-md mb-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8 pr-8"
                                    placeholder="Search tokens..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <X
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                                        onClick={() => setSearchQuery("")}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {showCustomInput ? (
                        <Card className="p-6">
                            <h3 className="font-medium mb-4">Enter Custom Token Details</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="customAddress">Token Contract ID</Label>
                                    <Input
                                        id="customAddress"
                                        value={customAddress}
                                        onChange={(e) => {
                                            setCustomAddress(e.target.value);
                                            setCustomError(null);
                                            setFetchedToken(null);
                                        }}
                                        placeholder="e.g. SP...token-name"
                                    />
                                </div>

                                <div>
                                    <Button
                                        onClick={() => fetchTokenMetadata(customAddress)}
                                        disabled={isFetchingToken || !customAddress.trim()}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        {isFetchingToken ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Fetching Token...
                                            </>
                                        ) : (
                                            <>Fetch Token Details</>
                                        )}
                                    </Button>
                                </div>

                                {fetchedToken && (
                                    <div className="border rounded-md p-4 bg-muted/10 space-y-3">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden relative">
                                                {fetchedToken.image ? (
                                                    <Image
                                                        src={fetchedToken.image}
                                                        alt={fetchedToken.symbol || 'token'}
                                                        layout="fill"
                                                        objectFit="cover"
                                                        sizes="40px"
                                                        quality={95}
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div className="text-sm font-bold text-primary/60">{(fetchedToken.symbol || 'T').charAt(0).toUpperCase()}</div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-medium">{fetchedToken.symbol}</h4>
                                                <p className="text-sm text-muted-foreground">{fetchedToken.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            <span className="block mb-1">Contract ID:</span>
                                            <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">{truncateAddress(fetchedToken.contractId)}</span>
                                        </div>
                                    </div>
                                )}

                                {customError && (
                                    <div className="text-destructive text-sm pt-1">{customError}</div>
                                )}

                                <div className="flex justify-end space-x-2 pt-2">
                                    <Button variant="outline" onClick={handleCancelCustom}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCustomSubmit}
                                        disabled={!fetchedToken}
                                    >
                                        Use Custom Token
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div>
                            {isLoadingTokens ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : tokenLoadError ? (
                                <div className="text-center text-destructive mb-4">
                                    {tokenLoadError}
                                </div>
                            ) : tokensToDisplay.length === 0 && !searchQuery ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No tokens available. Try adding a custom token.</p>
                                </div>
                            ) : tokensToDisplay.length === 0 && searchQuery ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No tokens match your search "{searchQuery}".</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {tokensToDisplay.map((token) => (
                                        <Card
                                            key={token.contractId}
                                            className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative"
                                            onClick={() => {
                                                if (!selectingToken2) {
                                                    onSelectToken1(token);
                                                    setSelectingToken2(true);
                                                    setSearchQuery("");
                                                } else {
                                                    onSelectToken2(token);
                                                }
                                            }}
                                        >
                                            {token.tokenAContract && token.tokenBContract && (
                                                <span className="absolute top-2 left-2 bg-gray-800 text-gray-200 border border-gray-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full z-20">
                                                    LP Token
                                                </span>
                                            )}
                                            {token.type === 'SUBNET' && (
                                                <span className="absolute top-2 right-2 bg-gray-800 text-gray-200 border border-gray-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full z-20">
                                                    Subnet
                                                </span>
                                            )}
                                            <div className="p-6 flex flex-col items-center">
                                                <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-4 overflow-hidden relative bg-muted">
                                                    {token.image && !imageErrors[token.contractId] ? (
                                                        <Image
                                                            src={token.image}
                                                            alt={token.symbol || token.name || 'token'}
                                                            layout="fill"
                                                            objectFit="cover"
                                                            sizes="64px"
                                                            quality={95}
                                                            onError={() => handleImageError(token.contractId)}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full font-bold text-primary/60 flex items-center justify-center text-xl">
                                                            {(token.symbol || token.name || 'T').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className="font-medium truncate max-w-full">{token.symbol || 'N/A'}</h3>
                                                <p className="text-sm text-muted-foreground truncate max-w-full">{token.name || 'Unknown Name'}</p>
                                                <p className="text-xs text-muted-foreground font-mono group-hover:text-primary/80 transition-colors">
                                                    {truncateAddress(token.contractId)}
                                                </p>
                                            </div>
                                        </Card>
                                    ))}
                                    <Card className="cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => setShowCustomInput(true)}
                                    >
                                        <div className="p-6 flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                                <HelpCircle className="w-8 h-8 text-primary/60" />
                                            </div>
                                            <h3 className="font-medium">Custom Token</h3>
                                            <p className="text-sm text-muted-foreground">Enter contract ID manually</p>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="text-center">
                        <Button
                            variant="outline"
                            onClick={() => setSelectingToken2(false)}
                        >
                            Change First Token
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}; 