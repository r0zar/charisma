import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShopItem as ShopItemInterface } from '@/types/shop';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, ExternalLink, Info, ArrowRight, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { request } from '@stacks/connect';
import { bufferCV, optionalCVOf, Pc, stringAsciiCV, uintCV } from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { useWallet } from '@/contexts/wallet-context';


interface ShopItemProps {
    item: ShopItemInterface;
}

const ShopItem: React.FC<ShopItemProps> = ({ item }) => {
    // Add state for dialog open/close
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    // Add state for client-side rendering check
    const [isMounted, setIsMounted] = useState(false);

    const router = useRouter();
    const { address, balances, prices } = useWallet();

    // Get a clean title without the symbol in parentheses if present
    const cleanTitle = item.title.replace(/\s*\([^)]*\)\s*/, '');

    // Format the price with currency - assuming this is the "energy price"
    const formattedPrice = `${item.price} ${item.payToken?.symbol}`;

    // Use useEffect to safely set isMounted after component mounts
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const energyBalance = balances.fungible_tokens['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy::energy']?.balance;

    const handlePurchase = async () => {
        // Simulate purchase logic
        console.log("Purchasing item:", item.title, "for", formattedPrice);

        try {
            const result = await request('stx_callContract', {
                contract: item.vault as any,
                functionName: 'claim',
                functionArgs: [uintCV(energyBalance)],
                postConditions: [
                    Pc.principal(address).willSendLte(energyBalance).ft('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy', 'energy'),
                    Pc.principal('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-farm').willSendLte(energyBalance).ft('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl', 'hooter')
                ],
                network: 'mainnet'
            });
            console.log("Result:", result);
            // Close dialog after successful purchase
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Purchase failed:", error);
        }
    };

    const handleItemClick = () => {
        if (!isMounted) return;

        // Check if item is an offer type
        if (item.type === 'offer') {
            // Redirect to offers/bid page with the item id
            router.push(`/shop/${item.id}`);
        } else {
            // Open the purchase dialog for regular items
            setIsDialogOpen(true);
        }
    };

    return (
        <div suppressHydrationWarning>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <div
                    className="relative w-full aspect-square rounded-lg group cursor-pointer transition-all duration-300 hover:shadow-lg"
                    onClick={handleItemClick}
                >
                    <Image
                        src={item.image}
                        alt={cleanTitle}
                        fill
                        className="object-cover rounded-lg"
                    />

                    {/* Overlay with item name and Buy/Bid button on hover */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex flex-col items-center justify-end p-4 opacity-0 group-hover:opacity-100 rounded-lg">
                        <div className="w-full flex flex-col items-center justify-center gap-2">
                            <h3 className="text-white text-lg font-semibold mb-2 text-center line-clamp-2 cursor-pointer">
                                {cleanTitle}
                            </h3>
                            <div className="w-full flex items-center justify-center gap-1 p-0">
                                <CreditCard className="h-4 w-4" aria-hidden="true" />
                                <span>{item.type === 'offer' ? 'Bid' : 'Buy'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Only render DialogContent if the component is mounted and it's not an offer type */}
                {isMounted && item.type !== 'offer' && (
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Confirm Purchase</DialogTitle>
                            <DialogDescription>
                                You are about to purchase "{cleanTitle}".
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border">
                                    <Image
                                        src={item.image}
                                        alt={cleanTitle}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <div>
                                    <h4 className="font-semibold">{cleanTitle}</h4>
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    await handlePurchase();
                                }}
                            >
                                Confirm Purchase
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};

export default ShopItem;