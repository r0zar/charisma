import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, HelpCircle, Search, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { TokenCacheData } from "@repo/tokens";

interface TokenSelectionStepProps {
    onSelectToken: (token: TokenCacheData) => void;
    isLoadingTokens: boolean;
    predefinedTokens: TokenCacheData[];
    onCustomSubmit: (contractId: string) => void;
}

const TokenSelectionStep = ({
    onSelectToken,
    isLoadingTokens,
    predefinedTokens,
    onCustomSubmit
}: TokenSelectionStepProps) => {
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customAddress, setCustomAddress] = useState("");
    const [customError, setCustomError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filteredTokens, setFilteredTokens] = useState<TokenCacheData[]>(predefinedTokens);
    const [isFetchingToken, setIsFetchingToken] = useState(false);
    const [fetchedToken, setFetchedToken] = useState<TokenCacheData | null>(null);

    useEffect(() => {
        if (!searchQuery) {
            setFilteredTokens(predefinedTokens);
            return;
        }
        const query = searchQuery.toLowerCase();
        const filtered = predefinedTokens.filter(
            token =>
                token.symbol.toLowerCase().includes(query) ||
                token.name.toLowerCase().includes(query) ||
                token.contractId.toLowerCase().includes(query)
        );
        setFilteredTokens(filtered);
    }, [searchQuery, predefinedTokens]);

    const fetchTokenMetadata = async (contractId: string) => {
        if (!contractId.trim()) {
            setCustomError("Contract address is required");
            return;
        }
        if (!/^[A-Z0-9]+\.[a-zA-Z0-9-]+$/.test(contractId)) {
            setCustomError("Invalid contract address format. Should be like: SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token");
            return;
        }
        setCustomError(null);
        setIsFetchingToken(true);
        try {
            // This fetchSingleTokenMetadataDirectly must be passed in or imported as needed in your app
            const result = await (window as any).fetchSingleTokenMetadataDirectly(contractId);
            if (result.error) {
                throw new Error(result.error);
            }
            if (result.meta) {
                setFetchedToken(result.meta);
            } else {
                throw new Error("Token metadata not found");
            }
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            setCustomError(error instanceof Error ? error.message : 'Failed to fetch token data');
            setFetchedToken(null);
        } finally {
            setIsFetchingToken(false);
        }
    };

    const handleCustomSubmit = () => {
        if (!fetchedToken) {
            setCustomError("Please fetch a valid token first");
            return;
        }
        setCustomError(null);
        onCustomSubmit(fetchedToken.contractId || customAddress);
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

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Select Subnet Token</h2>
                <p className="text-muted-foreground">Choose the subnet token you want to create a sublink for</p>
                <div className="mt-2 text-sm text-muted-foreground/80">
                    The base token will be automatically detected from the subnet token
                </div>
            </div>
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
                                placeholder="e.g. SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.token-name"
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
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-3 overflow-hidden">
                                        {fetchedToken.image ? (
                                            <img
                                                src={fetchedToken.image}
                                                alt={fetchedToken.symbol}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="text-sm font-bold text-primary/60">${fetchedToken.symbol?.charAt(0)}</div>`;
                                                }}
                                            />
                                        ) : (
                                            <div className="text-sm font-bold text-primary/60">{fetchedToken.symbol?.charAt(0)}</div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-medium">{fetchedToken.symbol}</h4>
                                        <p className="text-sm text-muted-foreground">{fetchedToken.name}</p>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    <span className="block mb-1">Contract ID:</span>
                                    <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">{fetchedToken.contractId}</span>
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
                    ) : filteredTokens.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No tokens found. Try a different search.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {filteredTokens.map((token) => (
                                <Card
                                    key={token.contractId}
                                    className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative"
                                    onClick={() => onSelectToken(token)}
                                >
                                    {token.type === 'SUBNET' ? (
                                        <span className="absolute top-2 right-2 bg-primary/20 text-primary border border-primary/30 text-[10px] font-medium px-1.5 py-0.5 rounded-full z-20">
                                            Subnet
                                        </span>
                                    ) : null}
                                    <div className="p-6 flex flex-col items-center">
                                        <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-4 overflow-hidden relative">
                                            {token.image ? (
                                                <img
                                                    src={token.image}
                                                    alt={token.symbol}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-full h-full font-bold text-primary/60 flex items-center justify-center text-xl">${token.symbol.charAt(0)}</div>`;
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full font-bold text-primary/60 flex items-center justify-center text-xl">
                                                    {token.symbol.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="font-medium">{token.symbol}</h3>
                                        <p className="text-sm text-muted-foreground truncate max-w-full">{token.name}</p>
                                        {token.type === 'SUBNET' && (
                                            <p className="text-xs text-primary/70 mt-1">Direct subnet token</p>
                                        )}
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
                                    <p className="text-sm text-muted-foreground">Use another subnet token</p>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TokenSelectionStep; 