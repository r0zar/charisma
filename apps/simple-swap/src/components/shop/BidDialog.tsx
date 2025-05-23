import React from 'react';
import { ShopItem, isOfferItem, OfferItem } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    TrendingUp,
    ExternalLink,
    Gavel,
    Info,
    ArrowRightLeft,
    Coins,
    DollarSign
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-context';
import { getTokenPrice, formatTokenAmount, calculateOfferValue, formatOfferAssetAmount } from '@/utils/shop-table-utils';

interface BidDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedItem: ShopItem | null;
    subnetTokens: TokenDef[];
    bidAmount: string;
    setBidAmount: (amount: string) => void;
    bidToken: string;
    setBidToken: (token: string) => void;
    bidMessage: string;
    setBidMessage: (message: string) => void;
    onSubmitBid: () => Promise<void>;
    onViewDetails: (item: ShopItem) => void;
}

const BidDialog: React.FC<BidDialogProps> = ({
    isOpen,
    onClose,
    selectedItem,
    subnetTokens,
    bidAmount,
    setBidAmount,
    bidToken,
    setBidToken,
    bidMessage,
    setBidMessage,
    onSubmitBid,
    onViewDetails
}) => {
    const { prices } = useWallet();

    if (!selectedItem || !isOfferItem(selectedItem)) return null;

    const offerItem = selectedItem as OfferItem;

    // Calculate offer USD value
    const offerUsdValue = calculateOfferValue(offerItem, prices || {});

    // Calculate bid USD value
    const getBidUsdValue = () => {
        if (!bidAmount || !bidToken) return 0;
        const selectedToken = subnetTokens.find(t => t.symbol === bidToken);
        if (!selectedToken) return 0;

        const tokenPrice = getTokenPrice(selectedToken.id, prices || {});
        const bidAmountNum = parseFloat(bidAmount);
        return isNaN(bidAmountNum) ? 0 : bidAmountNum * tokenPrice;
    };

    const bidUsdValue = getBidUsdValue();

    // Get latest bid info
    const getLatestBidInfo = () => {
        if (!offerItem.bids || offerItem.bids.length === 0) return null;

        const latestBid = offerItem.bids[offerItem.bids.length - 1];
        if (!latestBid.bidAssets || latestBid.bidAssets.length === 0) return null;

        const bidAsset = latestBid.bidAssets[0];
        const tokenInfo = subnetTokens.find(t => t.id === bidAsset.token);
        if (!tokenInfo) return null;

        const formattedAmount = formatTokenAmount(bidAsset.amount, tokenInfo.decimals);
        const usdValue = formattedAmount * getTokenPrice(bidAsset.token, prices || {});

        return {
            amount: formattedAmount,
            symbol: tokenInfo.symbol,
            usdValue: usdValue
        };
    };

    const latestBidInfo = getLatestBidInfo();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-muted">
                            {selectedItem.image ? (
                                <Image
                                    src={selectedItem.image}
                                    alt={selectedItem.title}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                    <TrendingUp className="h-6 w-6 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold">{selectedItem.title}</h3>
                            <p className="text-sm text-muted-foreground font-normal">
                                Place your bid on this offer
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                onClose();
                                onViewDetails(selectedItem);
                            }}
                            className="text-xs"
                        >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Details
                        </Button>
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {selectedItem.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Offer Assets Display */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="font-medium">What you'll receive:</span>
                            {offerUsdValue > 0 && (
                                <span className="text-sm text-muted-foreground">
                                    (~${offerUsdValue.toFixed(2)} USD)
                                </span>
                            )}
                        </div>
                        <div className="space-y-2">
                            {offerItem.offerAssets.map((asset, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                                    <div className="flex items-center gap-2">
                                        {asset.tokenData?.image ? (
                                            <Image
                                                src={asset.tokenData.image}
                                                alt={asset.tokenData.symbol || ''}
                                                width={20}
                                                height={20}
                                                className="rounded-full"
                                            />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Coins className="h-3 w-3 text-primary" />
                                            </div>
                                        )}
                                        <span className="font-medium">{asset.tokenData?.name || 'Unknown Token'}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium">
                                            {formatOfferAssetAmount(asset)} {asset.tokenData?.symbol}
                                        </div>
                                        {(() => {
                                            const decimals = asset.tokenData?.decimals || 6;
                                            const formattedAmount = formatTokenAmount(asset.amount, decimals);
                                            const usdValue = formattedAmount * getTokenPrice(asset.token, prices || {});
                                            return usdValue > 0 ? (
                                                <div className="text-xs text-muted-foreground">
                                                    ${usdValue.toFixed(2)}
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Current Bid Status */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Current Status:</span>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-sm">{offerItem.bids?.length || 0} bids</span>
                            </div>
                        </div>
                        {latestBidInfo ? (
                            <div className="text-sm text-muted-foreground">
                                Latest bid: {latestBidInfo.amount.toLocaleString()} {latestBidInfo.symbol}
                                {latestBidInfo.usdValue > 0 && (
                                    <span> (~${latestBidInfo.usdValue.toFixed(2)} USD)</span>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                No bids yet - be the first to bid!
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Bid Form */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                            <ArrowRightLeft className="h-4 w-4 text-primary" />
                            <span className="font-medium">Your Bid:</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="bidAmount">Bid Amount</Label>
                                <Input
                                    id="bidAmount"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Enter amount"
                                    value={bidAmount}
                                    onChange={(e) => setBidAmount(e.target.value)}
                                    className="text-right"
                                    disabled={subnetTokens.length === 0}
                                />
                                {bidUsdValue > 0 && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        ~${bidUsdValue.toFixed(2)} USD
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bidToken">Payment Token</Label>
                                {subnetTokens.length > 0 ? (
                                    <Select value={bidToken} onValueChange={setBidToken}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select payment token" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subnetTokens.map((token) => (
                                                <SelectItem key={token.id} value={token.symbol}>
                                                    <div className="flex items-center gap-2">
                                                        {token.logo && (
                                                            <Image
                                                                src={token.logo}
                                                                alt={token.symbol}
                                                                width={16}
                                                                height={16}
                                                                className="rounded-full"
                                                            />
                                                        )}
                                                        <span>{token.symbol}</span>
                                                        <span className="text-xs text-muted-foreground">({token.name})</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="p-2 border border-border rounded-md bg-muted/30 text-center text-sm text-muted-foreground">
                                        No eligible tokens available
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Only eligible subnet tokens can be used for bidding
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bidMessage">Message (Optional)</Label>
                            <Input
                                id="bidMessage"
                                placeholder="Add a message to your bid..."
                                value={bidMessage}
                                onChange={(e) => setBidMessage(e.target.value)}
                            />
                        </div>

                        {/* Trade Summary */}
                        {bidAmount && bidToken && (
                            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-primary mb-3">
                                    <Info className="h-4 w-4" />
                                    <span className="font-medium">Trade Summary</span>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">You send:</span>
                                        <div className="text-right">
                                            <div className="font-medium">{bidAmount} {bidToken}</div>
                                            {bidUsdValue > 0 && (
                                                <div className="text-xs text-muted-foreground">
                                                    ~${bidUsdValue.toFixed(2)} USD
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">You receive:</span>
                                        <div className="text-right">
                                            <div className="font-medium">
                                                {offerItem.offerAssets.length === 1
                                                    ? `${formatOfferAssetAmount(offerItem.offerAssets[0])} ${offerItem.offerAssets[0].tokenData?.symbol}`
                                                    : `${offerItem.offerAssets.length} tokens`
                                                }
                                            </div>
                                            {offerUsdValue > 0 && (
                                                <div className="text-xs text-muted-foreground">
                                                    ~${offerUsdValue.toFixed(2)} USD
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-primary/20">
                                    <div className="text-xs text-muted-foreground">
                                        Trade will execute automatically if your bid is accepted
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={onSubmitBid}
                        disabled={!bidAmount || !bidToken || subnetTokens.length === 0}
                        className="button-primary"
                    >
                        <Gavel className="h-4 w-4 mr-2" />
                        {subnetTokens.length === 0 ? 'No Tokens Available' : 'Place Bid'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default React.memo(BidDialog); 