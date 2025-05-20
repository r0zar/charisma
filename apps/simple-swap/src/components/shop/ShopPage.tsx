"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { Header } from '@/components/header';
import ShopItem from '@/components/shop/ShopItem';
import ShopFilters from '@/components/shop/ShopFilters';
import { Package, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { ShopItem as ShopItemInterface } from '@/types/shop';

interface ShopClientPageProps {
    initialItems: ShopItemInterface[];
}

export default function ShopClientPage({ initialItems }: ShopClientPageProps) {
    const [items, setItems] = useState<ShopItemInterface[]>(initialItems);
    const [filteredItems, setFilteredItems] = useState<ShopItemInterface[]>(initialItems);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
    const [selectedSort, setSelectedSort] = useState<string>('newest');

    const { address, connected } = useWallet();
    const router = useRouter();

    // Handle price range changes
    const handlePriceRangeChange = (range: [number, number]) => {
        setPriceRange(range);
    };

    // Filter and sort items based on selected category, price range, and sort order
    useEffect(() => {
        let tempFilteredItems = [...items];

        // Apply category filter
        if (selectedCategory !== 'all') {
            tempFilteredItems = tempFilteredItems.filter(item => item.type === selectedCategory);
        }

        // Apply price range filter
        tempFilteredItems = tempFilteredItems.filter(item => {
            // Ensure price is a number for comparison, default to 0 if not present or not a number
            const price = typeof item.price === 'number' ? item.price : 0;
            return price >= priceRange[0] && price <= priceRange[1];
        });

        // Apply sorting
        if (selectedSort === 'price-low') {
            tempFilteredItems.sort((a, b) => (a.price || 0) - (b.price || 0));
        } else if (selectedSort === 'price-high') {
            tempFilteredItems.sort((a, b) => (b.price || 0) - (a.price || 0));
        }
        // For 'newest' sorting, we'll rely on the original order from the server

        setFilteredItems(tempFilteredItems);
    }, [selectedCategory, priceRange, selectedSort, items]);

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
                            onSortChange={setSelectedSort}
                            selectedSort={selectedSort}
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