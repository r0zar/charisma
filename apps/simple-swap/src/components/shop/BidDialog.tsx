import React, { useState, useEffect } from 'react';
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
    DollarSign,
    Wallet,
    AlertTriangle,
    CheckCircle
} from 'lucide-react';
import { useWallet } from '@/contexts/wallet-context';
import { getTokenPrice, formatTokenAmount, calculateOfferValue, formatOfferAssetAmount } from '@/utils/shop-table-utils';
import { getTokenBalance } from '@/app/actions';

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
    isSigning?: boolean;
    isSubmitting?: boolean;
    onBidSuccess?: (data: {
        hasInsufficientBalance: boolean;
        tokenSymbol: string;
        currentBalance: number;
        bidAmount: number;
    }) => void;
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
    onViewDetails,
    isSigning,
    isSubmitting,
    onBidSuccess
}) => {
    const { prices, address } = useWallet();

    // Balance tracking state
    const [userBalance, setUserBalance] = useState<number>(0);
    const [balanceLoading, setBalanceLoading] = useState<boolean>(false);
    const [showDepositPrompt, setShowDepositPrompt] = useState<boolean>(false);

    // Fetch user's balance for the selected token
    const fetchUserBalance = async (tokenSymbol: string) => {
        if (!address || !tokenSymbol) {
            setUserBalance(0);
            return;
        }

        const selectedToken = subnetTokens.find(t => t.symbol === tokenSymbol);
        if (!selectedToken) {
            setUserBalance(0);
            return;
        }

        setBalanceLoading(true);
        try {
            const balance = await getTokenBalance(selectedToken.id, address);
            const humanReadableBalance = balance / Math.pow(10, selectedToken.decimals);
            setUserBalance(humanReadableBalance);
        } catch (error) {
            console.error('Error fetching user balance:', error);
            setUserBalance(0);
        } finally {
            setBalanceLoading(false);
        }
    };

    // Fetch balance when token selection changes
    useEffect(() => {
        if (bidToken) {
            fetchUserBalance(bidToken);
        }
    }, [bidToken, address]);

    // Reset balance when dialog opens/closes
    useEffect(() => {
        if (!isOpen) {
            setUserBalance(0);
            setBalanceLoading(false);
        }
    }, [isOpen]);

    // Check if user has sufficient balance
    const bidAmountNum = parseFloat(bidAmount) || 0;
    const hasSufficientBalance = userBalance >= bidAmountNum;
    const balanceStatus = bidAmountNum > 0 ? (hasSufficientBalance ? 'sufficient' : 'insufficient') : 'unknown';

    // Early return after all hooks
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
        const bidAmountNumber = parseFloat(bidAmount);
        return isNaN(bidAmountNumber) ? 0 : bidAmountNumber * tokenPrice;
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

    // Handle successful bid submission
    const handleBidSubmit = async () => {
        // Store the current balance status before submission
        const shouldShowPrompt = balanceStatus === 'insufficient' && bidAmountNum > 0;

        // Call the parent's submit function
        await onSubmitBid();

        // If the dialog is still open after submission, it means there was an error
        // If it closes successfully, the deposit prompt will be handled by the useEffect below
        if (shouldShowPrompt) {
            // Set a timeout to show the prompt after the dialog closes
            setTimeout(() => {
                setShowDepositPrompt(true);
            }, 500);
        }

        if (onBidSuccess) {
            onBidSuccess({
                hasInsufficientBalance: balanceStatus === 'insufficient',
                tokenSymbol: bidToken,
                currentBalance: userBalance,
                bidAmount: bidAmountNum
            });
        }
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
                                <div key={index} className="flex items-center justify-between p-2 bg-background rounded border px-4">
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
                                    type="number"
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

                                {/* User Balance Display */}
                                {bidToken && (
                                    <div className="text-xs">
                                        <div className="flex items-center gap-1 mb-1">
                                            <Wallet className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-muted-foreground">Your Balance:</span>
                                        </div>
                                        {balanceLoading ? (
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <div className="animate-pulse">Loading...</div>
                                            </div>
                                        ) : (
                                            <div className={`flex items-center gap-1 ${balanceStatus === 'sufficient' ? 'text-green-600 dark:text-green-400' :
                                                balanceStatus === 'insufficient' ? 'text-red-600 dark:text-red-400' :
                                                    'text-muted-foreground'
                                                }`}>
                                                {balanceStatus === 'sufficient' && <CheckCircle className="h-3 w-3" />}
                                                {balanceStatus === 'insufficient' && <AlertTriangle className="h-3 w-3" />}
                                                <span>
                                                    {userBalance.toLocaleString(undefined, {
                                                        maximumFractionDigits: 6,
                                                        minimumFractionDigits: 0,
                                                    })} {bidToken}
                                                </span>
                                                {bidAmountNum > 0 && (
                                                    <span className="text-xs">
                                                        {balanceStatus === 'sufficient' ? '✓' : balanceStatus === 'insufficient' ? '(Insufficient)' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Warning for insufficient balance */}
                                        {balanceStatus === 'insufficient' && (
                                            <div className="mt-1 p-2 bg-red-50 dark:bg-red-950/20 rounded text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                                                <div className="flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    <span className="font-medium">Insufficient Balance</span>
                                                </div>
                                                <p className="mt-1">
                                                    You need {(bidAmountNum - userBalance).toLocaleString()} more {bidToken} for this bid.
                                                    Consider depositing tokens to the subnet after placing your bid.
                                                </p>
                                            </div>
                                        )}
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
                                    Only subnet tokens can be used for bidding
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
                        onClick={handleBidSubmit}
                        disabled={!bidAmount || !bidToken || subnetTokens.length === 0 || isSigning || isSubmitting}
                        className="button-primary"
                    >
                        {isSigning && (
                            <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        )}
                        {isSubmitting && !isSigning && (
                            <div className="animate-pulse -ml-1 mr-2 h-4 w-4 bg-white rounded-full"></div>
                        )}
                        {!isSigning && !isSubmitting && (
                            <>
                                {balanceStatus === 'insufficient' && bidAmountNum > 0 && (
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                )}
                                {(balanceStatus !== 'insufficient' || bidAmountNum === 0) && <Gavel className="h-4 w-4 mr-2" />}
                            </>
                        )}
                        {isSigning ? 'Signing...' :
                            isSubmitting ? 'Submitting...' :
                                subnetTokens.length === 0 ? 'No Tokens Available' :
                                    balanceStatus === 'insufficient' && bidAmountNum > 0 ? 'Place Bid (Deposit Required)' :
                                        'Place Bid'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default React.memo(BidDialog); 