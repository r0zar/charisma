import React from 'react';
import { ShopItem } from '@/types/shop';
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
    Info
} from 'lucide-react';
import { formatPrice } from '@/utils/shop-table-utils';

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
    if (!selectedItem) return null;

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
                    {/* Current Bid Info */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Current Status:</span>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-sm">{selectedItem.metadata?.bids?.length || 0} bids</span>
                            </div>
                        </div>
                        {selectedItem.metadata?.bids?.length ? (
                            <div className="text-sm text-muted-foreground">
                                Latest bid: {formatPrice(selectedItem, subnetTokens, (amount, decimals) => {
                                    const amt = typeof amount === 'string' ? amount : String(amount);
                                    return parseInt(amt) / Math.pow(10, decimals);
                                })}
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

                        {/* Bid Summary */}
                        {bidAmount && (
                            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-primary">
                                    <Info className="h-4 w-4" />
                                    <span className="font-medium">Bid Summary</span>
                                </div>
                                <div className="mt-2 text-sm">
                                    You are bidding <span className="font-semibold">{bidAmount} {bidToken}</span> for this offer.
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