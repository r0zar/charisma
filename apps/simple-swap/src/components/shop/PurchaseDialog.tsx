import React from 'react';
import { ShopItem, isPurchasableItem, PurchasableItem } from '@/types/shop';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Coins, ShoppingCart, DollarSign, ArrowRightLeft } from 'lucide-react';
import { getTypeConfig } from '@/utils/shop-table-utils';
import { TokenDef } from '@/types/otc';
import { useWallet } from '@/contexts/wallet-context';
import { getTokenPrice } from '@/utils/shop-table-utils';

interface PurchaseDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedItem: ShopItem | null;
    subnetTokens: TokenDef[];
    onPurchase: (item: ShopItem) => Promise<void>;
}

const PurchaseDialog: React.FC<PurchaseDialogProps> = ({
    isOpen,
    onClose,
    selectedItem,
    subnetTokens,
    onPurchase
}) => {
    const { prices } = useWallet();

    if (!selectedItem || !isPurchasableItem(selectedItem)) return null;

    const purchasableItem = selectedItem as PurchasableItem;

    // Calculate USD value
    const getUsdValue = () => {
        if (!purchasableItem.price || !purchasableItem.payToken) return 0;

        const tokenPrice = getTokenPrice(purchasableItem.payToken.contractId, prices || {});
        return purchasableItem.price * tokenPrice;
    };

    const usdValue = getUsdValue();

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
                                    <Coins className="h-6 w-6 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold">{selectedItem.title}</h3>
                            <p className="text-sm text-muted-foreground font-normal">
                                {getTypeConfig(selectedItem.type).label}
                            </p>
                        </div>
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {selectedItem.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Trade Summary */}
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-primary mb-3">
                            <ArrowRightLeft className="h-4 w-4" />
                            <span className="font-medium">Purchase Summary</span>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">You pay:</span>
                                <div className="text-right">
                                    <div className="flex items-center gap-2 font-medium">
                                        {purchasableItem.payToken?.image && (
                                            <Image
                                                src={purchasableItem.payToken.image}
                                                alt={purchasableItem.payToken.symbol || ''}
                                                width={20}
                                                height={20}
                                                className="rounded-full"
                                            />
                                        )}
                                        <span>{purchasableItem.price} {purchasableItem.payToken?.symbol || 'STX'}</span>
                                    </div>
                                    {usdValue > 0 && (
                                        <div className="text-xs text-muted-foreground">
                                            ~${usdValue.toFixed(2)} USD
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
                                    <div className="font-medium">{selectedItem.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {getTypeConfig(selectedItem.type).label}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Price breakdown */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex items-center justify-between text-lg font-semibold mb-2">
                            <span>Total Price:</span>
                            <div className="flex items-center gap-2">
                                {purchasableItem.payToken?.image && (
                                    <Image
                                        src={purchasableItem.payToken.image}
                                        alt={purchasableItem.payToken.symbol || ''}
                                        width={24}
                                        height={24}
                                        className="rounded-full"
                                    />
                                )}
                                <span>{purchasableItem.price} {purchasableItem.payToken?.symbol || 'STX'}</span>
                            </div>
                        </div>
                        {usdValue > 0 && (
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>USD Value:</span>
                                <div className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    <span>~${usdValue.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Additional details */}
                    {purchasableItem.metadata?.maxQuantity && (
                        <div className="text-sm text-muted-foreground border-t pt-4">
                            <div className="flex items-center justify-between">
                                <span>Max quantity per purchase:</span>
                                <span className="font-medium">{purchasableItem.metadata.maxQuantity}</span>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        disabled={true}
                        onClick={() => onPurchase(selectedItem)}
                        className="button-primary"
                    >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Confirm Purchase
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default React.memo(PurchaseDialog); 