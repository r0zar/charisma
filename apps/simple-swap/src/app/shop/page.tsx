"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { Header } from '@/components/header';
import ShopItem from '@/components/shop/ShopItem';
import ShopFilters from '@/components/shop/ShopFilters';
import { ShoppingCart, Package, AlertCircle, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

// Import types
import { ShopItemType, ShopItem as ShopItemInterface } from '@/types/shop';
import { useRouter } from 'next/navigation';
import { listTokens, TokenCacheData } from '@repo/tokens'; // Import the token-cache functions
import { getAccountBalances } from '@repo/polyglot';

export default function ShopPage() {
    const { address, connected } = useWallet();
    const [items, setItems] = useState<ShopItemInterface[]>([]);
    const [filteredItems, setFilteredItems] = useState<ShopItemInterface[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
    const router = useRouter();

    // Fetch all offers and tokens
    useEffect(() => {
        const fetchMarketplaceItems = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // 1. Fetch offers from KV
                const keys = await getAllOfferKeys();
                let shopItems: ShopItemInterface[] = [];

                // 2. Fetch tokens from API
                const tokenList = await listTokens();
                // convert to key value pair
                const tokenMap = Object.fromEntries(tokenList.map(token => [token.contract_principal, token]));

                if (keys && keys.length > 0) {
                    // Fetch offers in parallel
                    const fetchPromises = keys.map(uuid =>
                        fetch(`/api/v1/otc?intentUuid=${uuid}`).then(res => res.json())
                    );

                    const results = await Promise.all(fetchPromises);

                    // Filter valid offers and transform them to shop items
                    shopItems = results
                        .filter(result => result.success && result.offer && result.offer.status === 'open')
                        .map(result => {
                            return {
                                ...result.offer,
                                id: result.offer.intentUuid,
                                type: 'offer',
                                image: tokenMap[result.offer.offerAssets[0].token].image,
                                title: tokenMap[result.offer.offerAssets[0].token].symbol,
                                price: 1,
                                description: `Make a bid for ${tokenMap[result.offer.offerAssets[0].token].symbol}`,
                            }
                        });
                }

                // 3. Add HOOT token item as a special featured token
                const hootTokenItem: ShopItemInterface = {
                    id: 'hooter-farm',
                    type: 'token',
                    title: 'HOOT Tokens',
                    description: 'Spend up to 1000 energy to collect HOOT token rewards.',
                    price: 100,
                    currency: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
                    payToken: tokenMap['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy']!,
                    image: tokenMap["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl"].image,
                    vault: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-farm-x10',
                    metadata: {
                        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
                        tokenSymbol: 'HOOT',
                        amount: '100',
                        maxQuantity: 10,
                        offerAssets: [
                            tokenMap["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl"]
                        ]
                    }
                };

                // Combine all items
                const allItems = [hootTokenItem, ...shopItems];

                setItems(allItems);
                setFilteredItems(allItems);
            } catch (err) {
                console.error('Error fetching marketplace items:', err);
                setError('Failed to load marketplace items.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMarketplaceItems();
    }, []);

    // Helper function to get all offer keys
    const getAllOfferKeys = async (): Promise<string[]> => {
        try {
            // Mock implementation - in production, you might have an API endpoint to list all UUIDs
            const response = await fetch('/api/v1/otc/keys');
            if (!response.ok) {
                throw new Error('Failed to fetch offer keys');
            }
            const data = await response.json();
            return data.keys || [];
        } catch (error) {
            console.error('Error fetching offer keys:', error);
            return [];
        }
    };

    // Handle price range changes
    const handlePriceRangeChange = (range: [number, number]) => {
        setPriceRange(range);
    };

    // Filter items based on selected category, currency and price range
    useEffect(() => {
        let filtered = [...items];

        if (selectedCategory !== 'all') {
            filtered = filtered.filter(item => item.type === selectedCategory);
        }

        if (selectedCurrency !== 'all') {
            filtered = filtered.filter(item => item.currency === selectedCurrency);
        }

        // Apply price range filter
        filtered = filtered.filter(item => {
            return item.price ? item.price >= priceRange[0] && item.price <= priceRange[1] : false;
        });

        setFilteredItems(filtered);
    }, [selectedCategory, selectedCurrency, priceRange, items]);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1 container py-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Marketplace</h1>
                        <p className="text-muted-foreground mt-2">
                            Browse and trade OTC offers and digital assets
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="default"
                            className="flex items-center gap-2"
                            onClick={() => router.push('/shop/new')}
                        >
                            <Plus className="h-4 w-4" />
                            <span>Create Listing</span>
                        </Button>
                    </div>
                </div>

                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {error}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                    {/* Sidebar Filters */}
                    <div className="lg:col-span-1">
                        <ShopFilters
                            onCategoryChange={setSelectedCategory}
                            selectedCategory={selectedCategory}
                            priceRange={priceRange}
                            onPriceRangeChange={handlePriceRangeChange}
                        />
                    </div>

                    {/* Main content */}
                    <div className="lg:col-span-3">
                        <div className="mb-6">
                            <Tabs defaultValue={selectedCategory} value={selectedCategory} onValueChange={setSelectedCategory}>
                                <TabsList>
                                    <TabsTrigger value="all">All Items</TabsTrigger>
                                    <TabsTrigger value="offer">OTC Offers</TabsTrigger>
                                    <TabsTrigger value="nft">NFTs</TabsTrigger>
                                    <TabsTrigger value="token">Tokens</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {isLoading ? (
                            // Loading state
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="border border-border/50 rounded-lg overflow-hidden">
                                        <Skeleton className="h-32 w-full" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredItems.length === 0 ? (
                            // Empty state
                            <div className="text-center py-16 bg-muted/20 rounded-xl">
                                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-xl font-medium mb-2">No items found</h3>
                                <p className="text-muted-foreground mb-6">
                                    {items.length === 0 ?
                                        "No items are currently available in the marketplace." :
                                        "Try changing your filters to see more items."}
                                </p>

                                <Button
                                    variant="default"
                                    onClick={() => router.push('/shop/new')}
                                    className="flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create New Offer
                                </Button>
                            </div>
                        ) : (
                            // Items grid
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {filteredItems.map(item => (
                                    <ShopItem key={item.id} item={item} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}