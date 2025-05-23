"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@/contexts/wallet-context';
import { Header } from '@/components/header';
import ShopItem from '@/components/shop/ShopItem';
import ShopFilters from '@/components/shop/ShopFilters';
import { Package, AlertCircle, Plus, TrendingUp, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { ShopItem as ShopItemInterface, isOfferItem, isPurchasableItem } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import { SHOP_CATEGORIES, SORT_OPTIONS, DEFAULT_PRICE_RANGE } from '@/lib/shop/constants';
import { ShopService } from '@/lib/shop/shop-service';
import ShopTable from './ShopTable';
import { Card } from '@/components/ui/card';

interface ShopPageProps {
    initialItems: ShopItemInterface[];
}

export default function ShopPage({ initialItems }: ShopPageProps) {
    const [items, setItems] = useState<ShopItemInterface[]>(initialItems);
    const [subnetTokens, setSubnetTokens] = useState<TokenDef[]>([]);
    const [filteredItems, setFilteredItems] = useState<ShopItemInterface[]>(initialItems);
    const [selectedCategory, setSelectedCategory] = useState<string>(SHOP_CATEGORIES.ALL);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
    const [selectedSort, setSelectedSort] = useState<string>(SORT_OPTIONS.NEWEST);

    const { address, connected } = useWallet();
    const router = useRouter();

    // Fetch subnet tokens on mount
    useEffect(() => {
        const fetchSubnetTokens = async () => {
            try {
                const tokens = await ShopService.getSubnetTokensForOTC();
                setSubnetTokens(tokens);
            } catch (error) {
                console.error('Failed to fetch subnet tokens:', error);
            }
        };

        fetchSubnetTokens();
    }, []);

    // Handle price range changes
    const handlePriceRangeChange = (range: [number, number]) => {
        setPriceRange(range);
    };

    // Filter and sort items based on selected category, price range, and sort order
    useEffect(() => {
        let tempFilteredItems = [...items];

        // Apply category filter
        if (selectedCategory !== SHOP_CATEGORIES.ALL) {
            tempFilteredItems = tempFilteredItems.filter(item => item.type === selectedCategory);
        }

        // Apply price range filter
        tempFilteredItems = tempFilteredItems.filter(item => {
            // Ensure price is a number for comparison, default to 0 if not present or not a number
            const price = typeof item.price === 'number' ? item.price : 0;
            return price >= priceRange[0] && price <= priceRange[1];
        });

        // Apply sorting
        if (selectedSort === SORT_OPTIONS.PRICE_LOW) {
            tempFilteredItems.sort((a, b) => (a.price || 0) - (b.price || 0));
        } else if (selectedSort === SORT_OPTIONS.PRICE_HIGH) {
            tempFilteredItems.sort((a, b) => (b.price || 0) - (a.price || 0));
        }
        // For 'newest' sorting, we'll rely on the original order from the server

        setFilteredItems(tempFilteredItems);
    }, [selectedCategory, priceRange, selectedSort, items]);

    // Calculate stats
    const stats = {
        totalItems: items.length,
        totalOffers: items.filter(item => item.type === 'offer').length,
        totalBids: items.reduce((sum, item) => {
            if (isOfferItem(item)) {
                return sum + (item.bids?.length || 0);
            }
            return sum;
        }, 0),
        activeItems: items.filter(item => {
            if (isOfferItem(item)) {
                return item.status === 'open';
            }
            return true; // PurchasableItems are always available
        }).length,
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <motion.main
                className="flex-1 container py-8 space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
            >
                {/* Header */}
                <motion.div
                    className="text-center space-y-4"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                >
                    <h1 className="text-4xl font-bold tracking-tight">
                        Charisma <span className="text-primary">Marketplace</span>
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                        Trade tokens, place bids on offers, and discover new opportunities in the Charisma ecosystem.
                    </p>
                </motion.div>

                {/* Stats Cards */}
                <motion.div
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                >
                    {[
                        { icon: Package, label: 'Total Items', value: stats.totalItems, color: 'text-primary' },
                        { icon: TrendingUp, label: 'Active Offers', value: stats.totalOffers, color: 'text-secondary' },
                        { icon: Users, label: 'Total Bids', value: stats.totalBids, color: 'text-accent-foreground' },
                        { icon: Clock, label: 'Available Now', value: stats.activeItems, color: 'text-primary' }
                    ].map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                        >
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stat.value}</p>
                                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Main Table */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.6 }}
                >
                    <ShopTable items={items} subnetTokens={subnetTokens} />
                </motion.div>
            </motion.main>
        </div>
    );
}