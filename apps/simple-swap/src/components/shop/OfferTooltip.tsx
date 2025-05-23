import React, { useMemo } from 'react';
import { ShopItem } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import Image from 'next/image';
import { TrendingUp, Coins } from 'lucide-react';
import { SHOP_CATEGORIES } from '@/lib/shop/constants';
import { getTokenPrice, formatTokenAmount } from '@/utils/shop-table-utils';

interface OfferTooltipProps {
    item: ShopItem;
    subnetTokens: TokenDef[];
    prices: Record<string, any>;
}

// Helper function to truncate long contract IDs
const truncateContractId = (contractId: string, startChars: number = 6, endChars: number = 4): string => {
    if (!contractId || contractId.length <= startChars + endChars + 3) {
        return contractId;
    }
    return `${contractId.slice(0, startChars)}...${contractId.slice(-endChars)}`;
};

const OfferTooltip: React.FC<OfferTooltipProps> = ({ item, subnetTokens, prices }) => {
    // Memoize the asset details calculation
    const { assetDetails, grandTotal } = useMemo(() => {
        if (item.type !== SHOP_CATEGORIES.OFFER || !item.metadata?.offerAssets) {
            return { assetDetails: [], grandTotal: 0 };
        }

        console.log('OfferTooltip - item.metadata.offerAssets:', item.metadata.offerAssets);
        console.log('OfferTooltip - available subnetTokens:', subnetTokens);

        let total = 0;
        const details = item.metadata.offerAssets.map((asset: any, index: number) => {
            console.log(`Processing asset ${index}:`, asset);

            // Try multiple ways to find the token info
            let tokenInfo = null;

            // Method 1: Try by contractId/token field
            if (asset.contractId) {
                tokenInfo = subnetTokens.find(t => t.id === asset.contractId);
            }
            if (!tokenInfo && asset.token) {
                tokenInfo = subnetTokens.find(t => t.id === asset.token);
            }

            // Method 2: Try by symbol
            if (!tokenInfo && asset.symbol) {
                tokenInfo = subnetTokens.find(t => t.symbol === asset.symbol);
            }

            // Method 3: Try by name matching
            if (!tokenInfo && asset.name) {
                tokenInfo = subnetTokens.find(t => t.name === asset.name);
            }

            console.log(`Token info found for asset ${index}:`, tokenInfo);

            const decimals = tokenInfo?.decimals || 6;
            const amount = asset.amount || '0';
            const formattedAmount = formatTokenAmount(String(amount), decimals);

            // Get price using the token identifier (prefer contractId, then token, then symbol)
            const tokenIdentifier = asset.contractId || asset.token || asset.symbol || '';
            const pricePerToken = getTokenPrice(tokenIdentifier, prices);
            const totalValue = formattedAmount * pricePerToken;

            total += totalValue;

            const fullTokenId = asset.contractId || asset.token || asset.symbol || '';

            return {
                ...asset,
                tokenInfo,
                formattedAmount,
                pricePerToken,
                totalValue,
                index,
                // Add fallback values for display
                displayName: tokenInfo?.name || asset.name || asset.symbol || 'Unknown Token',
                displaySymbol: tokenInfo?.symbol || asset.symbol || 'UNK',
                tokenId: fullTokenId,
                truncatedTokenId: truncateContractId(fullTokenId),
            };
        });

        console.log('Processed asset details:', details);
        return { assetDetails: details, grandTotal: total };
    }, [item, subnetTokens, prices]);

    if (item.type !== SHOP_CATEGORIES.OFFER || !item.metadata?.offerAssets) {
        return null;
    }

    if (assetDetails.length === 0) {
        return (
            <div className="w-80 p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Offer Contents</span>
                </div>
                <div className="text-center py-4 text-sm text-muted-foreground">
                    No assets found in this offer
                </div>
            </div>
        );
    }

    return (
        <div className="w-80 p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-semibold">Offer Contents</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
                {assetDetails.map((asset) => (
                    <div key={asset.index} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                        <div className="relative h-8 w-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                            {(asset.image || asset.tokenInfo?.logo) ? (
                                <Image
                                    src={asset.image || asset.tokenInfo?.logo}
                                    alt={asset.displaySymbol}
                                    fill
                                    className="object-cover"
                                    onError={(e) => {
                                        console.log('Token image failed to load:', asset.image || asset.tokenInfo?.logo);
                                        // Hide the image on error
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                    <Coins className="h-4 w-4 text-muted-foreground" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-sm truncate" title={asset.displayName}>
                                        {asset.displayName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {asset.formattedAmount.toLocaleString()} {asset.displaySymbol}
                                    </p>
                                </div>
                                <div className="text-right">
                                    {asset.pricePerToken > 0 ? (
                                        <>
                                            <p className="text-sm font-medium">
                                                ${asset.totalValue.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                ${asset.pricePerToken.toFixed(4)} each
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Price unavailable
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {grandTotal > 0 && (
                <div className="border-t border-border pt-2">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">Estimated Total:</span>
                        <span className="font-bold text-lg text-primary">
                            ${grandTotal.toFixed(2)}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Based on current market prices
                    </p>
                </div>
            )}

            {item.metadata?.bids && item.metadata.bids.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            {item.metadata.bids.length} active bid{item.metadata.bids.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
            )}

            {/* Debug info - remove in production */}
            {process.env.NODE_ENV === 'development' && (
                <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Debug Info</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify({
                            totalAssets: assetDetails.length,
                            hasSubnetTokens: subnetTokens.length,
                            hasPrices: Object.keys(prices).length,
                            rawAssets: item.metadata?.offerAssets
                        }, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
};

export default React.memo(OfferTooltip); 