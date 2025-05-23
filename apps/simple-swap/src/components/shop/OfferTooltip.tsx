import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShopItem, OfferItem, isOfferItem } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import Image from 'next/image';
import { TrendingUp, Coins } from 'lucide-react';
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
    // Early return if not an offer
    if (!isOfferItem(item)) {
        return null;
    }

    // Now TypeScript knows item is OfferItem
    const offerItem = item as OfferItem;

    // Memoize the asset details calculation
    const { assetDetails, grandTotal } = useMemo(() => {
        let total = 0;
        const details = offerItem.offerAssets.map((asset, index) => {
            console.log(`Processing asset ${index}:`, asset);

            // We already have tokenData from the OfferAsset structure
            const tokenInfo = asset.tokenData;
            console.log(`Token info found for asset ${index}:`, tokenInfo);

            const decimals = tokenInfo?.decimals || 6;
            const rawAmount = asset.amount || '0';

            console.log(`Raw amount for asset ${index}:`, rawAmount, 'decimals:', decimals);

            // Handle different amount formats
            let formattedAmount = 0;
            if (rawAmount && rawAmount !== '0') {
                // Check if amount is already a decimal number (not atomic units)
                const numericAmount = parseFloat(String(rawAmount));
                if (!isNaN(numericAmount)) {
                    // If the amount is very large, assume it's in atomic units
                    if (numericAmount > 1000000) {
                        formattedAmount = formatTokenAmount(String(rawAmount), decimals);
                    } else {
                        // If it's a smaller number, it might already be formatted
                        formattedAmount = numericAmount;
                    }
                }
            }

            console.log(`Formatted amount for asset ${index}:`, formattedAmount);

            // Get price using the token identifier
            const pricePerToken = getTokenPrice(asset.token, prices);
            const totalValue = formattedAmount * pricePerToken;

            total += totalValue;

            return {
                ...asset,
                tokenInfo,
                formattedAmount,
                pricePerToken,
                totalValue,
                index,
                // Add fallback values for display
                displayName: tokenInfo?.name || tokenInfo?.symbol || 'Unknown Token',
                displaySymbol: tokenInfo?.symbol || 'UNK',
            };
        });

        console.log('Processed asset details:', details);
        return { assetDetails: details, grandTotal: total };
    }, [offerItem.offerAssets, prices]);

    if (assetDetails.length === 0) {
        return (
            <motion.div
                className="w-80 p-4 space-y-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
            >
                <div className="flex items-center gap-2 border-b border-border pb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Offer Contents</span>
                </div>
                <div className="text-center py-4 text-sm text-muted-foreground">
                    No assets found in this offer
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            className="w-96 p-4 space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
        >
            <motion.div
                className="flex items-center gap-2 border-b border-border pb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
            >
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-semibold">Offer Contents</span>
            </motion.div>

            <motion.div
                className="space-y-2 max-h-60 overflow-y-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
            >
                {assetDetails.map((asset, index) => (
                    <motion.div
                        key={asset.index}
                        className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors duration-150"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                            delay: 0.2 + index * 0.03,
                            duration: 0.2,
                            ease: "easeOut"
                        }}
                    >
                        <div className="relative h-8 w-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                            {asset.tokenInfo?.image ? (
                                <Image
                                    src={asset.tokenInfo.image}
                                    alt={asset.displaySymbol}
                                    fill
                                    className="object-cover"
                                    onError={(e) => {
                                        console.log('Token image failed to load:', asset.tokenInfo?.image);
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
                                        {asset.formattedAmount > 0
                                            ? `${asset.formattedAmount < 0.001
                                                ? asset.formattedAmount.toExponential(3)
                                                : asset.formattedAmount.toLocaleString(undefined, {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: asset.formattedAmount < 1 ? 6 : 2
                                                })
                                            } ${asset.displaySymbol}`
                                            : `0 ${asset.displaySymbol} (amount not available)`
                                        }
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
                    </motion.div>
                ))}
            </motion.div>

            {grandTotal > 0 && (
                <motion.div
                    className="border-t border-border pt-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + assetDetails.length * 0.03, duration: 0.2 }}
                >
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">Estimated Total:</span>
                        <span className="font-bold text-lg text-primary">
                            ${grandTotal.toFixed(2)}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Based on current market prices
                    </p>
                </motion.div>
            )}

            {offerItem.bids && offerItem.bids.length > 0 && (
                <motion.div
                    className="bg-primary/5 border border-primary/20 rounded-lg p-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + assetDetails.length * 0.03, duration: 0.2 }}
                >
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            {offerItem.bids.length} active bid{offerItem.bids.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </motion.div>
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
                            rawAssets: offerItem.offerAssets
                        }, null, 2)}
                    </pre>
                </details>
            )}
        </motion.div>
    );
};

export default React.memo(OfferTooltip); 