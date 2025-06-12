"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LineChart,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Clock,
    User,
    Wallet,
    Shield,
    AlertCircle,
    CheckCircle,
    Calendar,
    ArrowRight,
    Target,
    Percent,
    Info
} from 'lucide-react';
import { PerpFundingRequest, FundingOffer } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import { useWallet } from '@/contexts/wallet-context';

// Simple time formatting utility
const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
};

interface FundingRequestDialogProps {
    isOpen: boolean;
    onClose: () => void;
    fundingRequest: PerpFundingRequest | null;
    subnetTokens: TokenDef[];
    mode: 'view' | 'fund' | 'accept';
    onCreateFundingOffer?: (requestId: string, offer: Omit<FundingOffer, 'fundingOfferId' | 'createdAt' | 'status'>) => Promise<void>;
    onAcceptFundingOffer?: (requestId: string, offerId: string) => Promise<void>;
    isSubmitting?: boolean;
}

const FundingRequestDialog: React.FC<FundingRequestDialogProps> = ({
    isOpen,
    onClose,
    fundingRequest,
    subnetTokens,
    mode,
    onCreateFundingOffer,
    onAcceptFundingOffer,
    isSubmitting = false
}) => {
    const { address } = useWallet();

    // Funding offer form state
    const [collateralAmount, setCollateralAmount] = useState('');
    const [requestedFeeRate, setRequestedFeeRate] = useState('');
    const [message, setMessage] = useState('');

    // Tab state for multi-tab view
    const [activeTab, setActiveTab] = useState('details');

    const handleSubmitFundingOffer = useCallback(async () => {
        if (!fundingRequest || !onCreateFundingOffer || !address) return;

        if (!collateralAmount || !requestedFeeRate) {
            alert('Please fill in all required fields');
            return;
        }

        const offer: Omit<FundingOffer, 'fundingOfferId' | 'createdAt' | 'status'> = {
            funderId: address,
            funderCollateralIntent: '', // This would be set by the backend after signing
            maxCollateralOffered: collateralAmount,
            requestedFeeRate,
            message: message || undefined
        };

        await onCreateFundingOffer(fundingRequest.id, offer);

        // Reset form
        setCollateralAmount('');
        setRequestedFeeRate('');
        setMessage('');
    }, [fundingRequest, onCreateFundingOffer, address, collateralAmount, requestedFeeRate, message]);

    const handleAcceptOffer = useCallback(async (offerId: string) => {
        if (!fundingRequest || !onAcceptFundingOffer) return;
        await onAcceptFundingOffer(fundingRequest.id, offerId);
    }, [fundingRequest, onAcceptFundingOffer]);

    if (!fundingRequest) {
        return null;
    }

    // Get token info for display
    const baseTokenInfo = subnetTokens.find(t => t.id === fundingRequest.baseToken) || {
        symbol: fundingRequest.baseToken.split('.')[1] || 'TOKEN',
        decimals: 6
    };
    const quoteTokenInfo = subnetTokens.find(t => t.id === fundingRequest.quoteToken) || {
        symbol: fundingRequest.quoteToken.split('.')[1] || 'USDT',
        decimals: 6
    };

    // Calculate time until expiry
    const timeUntilExpiry = formatTimeAgo(fundingRequest.expiresAt);
    const isExpired = Date.now() > fundingRequest.expiresAt;

    // Check if user is the trader
    const isTrader = address === fundingRequest.traderId;

    // Position direction styling
    const directionColor = fundingRequest.direction === 'long'
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';
    const DirectionIcon = fundingRequest.direction === 'long' ? TrendingUp : TrendingDown;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-purple-600" />
                        P2P Perpetual Funding Request
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'view' && 'View funding request details and current offers'}
                        {mode === 'fund' && 'Create a funding offer for this perpetual position'}
                        {mode === 'accept' && 'Review and accept funding offers for your position'}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="details">Position Details</TabsTrigger>
                        <TabsTrigger value="offers">
                            Funding Offers ({fundingRequest.fundingOffers.length})
                        </TabsTrigger>
                        {(mode === 'fund' && !isTrader) && (
                            <TabsTrigger value="create-offer">Create Offer</TabsTrigger>
                        )}
                    </TabsList>

                    {/* Position Details Tab */}
                    <TabsContent value="details" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Position Summary Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <DirectionIcon className={`h-5 w-5 ${directionColor}`} />
                                        {fundingRequest.direction.toUpperCase()} {baseTokenInfo.symbol}
                                        <Badge variant="outline" className={directionColor}>
                                            {fundingRequest.leverage}x
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <Label className="text-muted-foreground">Position Size</Label>
                                            <p className="font-medium">{fundingRequest.positionSize}</p>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground">Entry Price</Label>
                                            <p className="font-medium">{fundingRequest.entryPrice}</p>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground">Liquidation Price</Label>
                                            <p className="font-medium text-red-600 dark:text-red-400">
                                                {fundingRequest.liquidationPrice}
                                            </p>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground">Funding Fee</Label>
                                            <p className="font-medium text-green-600 dark:text-green-400">
                                                {fundingRequest.fundingFeeRate}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Economic Terms Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <DollarSign className="h-5 w-5" />
                                        Economic Terms
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <Label className="text-muted-foreground">Trader Margin</Label>
                                            <span className="font-medium">{fundingRequest.traderMargin} {quoteTokenInfo.symbol}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <Label className="text-muted-foreground">Max Collateral Needed</Label>
                                            <span className="font-medium">{fundingRequest.maxCollateralNeeded} {quoteTokenInfo.symbol}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <Label className="text-muted-foreground">Guaranteed Fee Rate</Label>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                                {fundingRequest.fundingFeeRate}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <Label className="text-muted-foreground">Status</Label>
                                            <Badge variant={isExpired ? "destructive" : "default"}>
                                                {isExpired ? "EXPIRED" : fundingRequest.fundingStatus.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <Label className="text-muted-foreground">Expires</Label>
                                            <span className={`font-medium ${isExpired ? 'text-red-600 dark:text-red-400' : ''}`}>
                                                {timeUntilExpiry}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Risk Warning */}
                        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-amber-800 dark:text-amber-200">Funding Risk</h4>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                            If you fund this position and it goes against the trader, you could lose your collateral.
                                            However, you'll earn the guaranteed funding fee and keep any profits if the position is liquidated.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Funding Offers Tab */}
                    <TabsContent value="offers" className="space-y-4">
                        {fundingRequest.fundingOffers.length === 0 ? (
                            <div className="text-center py-8">
                                <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium mb-2">No Funding Offers Yet</h3>
                                <p className="text-muted-foreground">Be the first to offer funding for this position.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {fundingRequest.fundingOffers.map((offer, index) => (
                                    <Card key={offer.fundingOfferId} className="relative">
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-mono text-sm">
                                                        {offer.funderId.slice(0, 8)}...{offer.funderId.slice(-4)}
                                                    </span>
                                                    <Badge variant={
                                                        offer.status === 'accepted' ? 'default' :
                                                            offer.status === 'rejected' ? 'destructive' : 'secondary'
                                                    }>
                                                        {offer.status}
                                                    </Badge>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatTimeAgo(offer.createdAt)}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                <div>
                                                    <Label className="text-muted-foreground">Collateral Offered</Label>
                                                    <p className="font-medium">{offer.maxCollateralOffered} {quoteTokenInfo.symbol}</p>
                                                </div>
                                                <div>
                                                    <Label className="text-muted-foreground">Requested Fee Rate</Label>
                                                    <p className="font-medium">{offer.requestedFeeRate}</p>
                                                </div>
                                            </div>

                                            {offer.message && (
                                                <div className="mb-4">
                                                    <Label className="text-muted-foreground">Message</Label>
                                                    <p className="text-sm border rounded p-2 bg-muted/50">{offer.message}</p>
                                                </div>
                                            )}

                                            {/* Accept button for trader */}
                                            {isTrader && offer.status === 'pending' && !isExpired && (
                                                <Button
                                                    onClick={() => handleAcceptOffer(offer.fundingOfferId)}
                                                    disabled={isSubmitting}
                                                    size="sm"
                                                    className="w-full"
                                                >
                                                    {isSubmitting ? 'Accepting...' : 'Accept This Offer'}
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Create Offer Tab */}
                    {(mode === 'fund' && !isTrader) && (
                        <TabsContent value="create-offer" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Create Funding Offer</CardTitle>
                                    <CardDescription>
                                        Provide collateral to fund this perpetual position and earn fees.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="collateralAmount">
                                                Collateral Amount ({quoteTokenInfo.symbol})
                                            </Label>
                                            <Input
                                                id="collateralAmount"
                                                type="number"
                                                step="0.000001"
                                                placeholder={`Max: ${fundingRequest.maxCollateralNeeded}`}
                                                value={collateralAmount}
                                                onChange={(e) => setCollateralAmount(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Maximum needed: {fundingRequest.maxCollateralNeeded} {quoteTokenInfo.symbol}
                                            </p>
                                        </div>

                                        <div>
                                            <Label htmlFor="requestedFeeRate">
                                                Requested Fee Rate
                                            </Label>
                                            <Input
                                                id="requestedFeeRate"
                                                placeholder={`e.g., ${fundingRequest.fundingFeeRate}`}
                                                value={requestedFeeRate}
                                                onChange={(e) => setRequestedFeeRate(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Guaranteed rate: {fundingRequest.fundingFeeRate}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="message">
                                            Message (Optional)
                                        </Label>
                                        <Input
                                            id="message"
                                            placeholder="Add a message to the trader..."
                                            value={message}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
                                        />
                                    </div>

                                    <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                            <div>
                                                <h4 className="font-medium text-blue-800 dark:text-blue-200">How P2P Funding Works</h4>
                                                <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1 list-disc list-inside">
                                                    <li>You provide collateral to back the trader's position</li>
                                                    <li>If position wins: You lose collateral but keep funding fees</li>
                                                    <li>If position loses/liquidates: You get trader's margin + your collateral + fees</li>
                                                    <li>You earn the guaranteed funding fee regardless of outcome</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>

                    {(mode === 'fund' && !isTrader && activeTab === 'create-offer') && (
                        <Button
                            onClick={handleSubmitFundingOffer}
                            disabled={isSubmitting || !collateralAmount || !requestedFeeRate}
                        >
                            {isSubmitting ? 'Creating Offer...' : 'Create Funding Offer'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FundingRequestDialog; 