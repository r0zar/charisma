import React from 'react';
import { ShopItem } from '@/types/shop';
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
import { Coins, ShoppingCart } from 'lucide-react';
import { getTypeConfig, formatPrice } from '@/utils/shop-table-utils';
import { TokenDef } from '@/types/otc';

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
    if (!selectedItem) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
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

                <div className="space-y-4">
                    {/* Price breakdown */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex items-center justify-between text-lg font-semibold">
                            <span>Total Price:</span>
                            <div className="flex items-center gap-2">
                                {selectedItem.payToken?.image && (
                                    <Image
                                        src={selectedItem.payToken.image}
                                        alt={selectedItem.payToken.symbol || ''}
                                        width={20}
                                        height={20}
                                        className="rounded-full"
                                    />
                                )}
                                <span>{formatPrice(selectedItem, subnetTokens, (amount, decimals) => {
                                    const amt = typeof amount === 'string' ? amount : String(amount);
                                    return parseInt(amt) / Math.pow(10, decimals);
                                })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Additional details */}
                    {selectedItem.metadata?.maxQuantity && (
                        <div className="text-sm text-muted-foreground">
                            Max quantity per purchase: {selectedItem.metadata.maxQuantity}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
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