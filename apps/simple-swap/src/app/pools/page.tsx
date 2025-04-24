import React from 'react';
import { Header } from "../../components/header";
import { Layers, Plus, ArrowUpDown } from "lucide-react";
import Link from 'next/link';

export const metadata = {
    title: 'Liquidity Pools | SimpleSwap',
    description: 'View and manage liquidity pools on the SimpleSwap platform'
};

// Mock data for pools
const pools = [
    {
        id: 'pool-1',
        name: 'STX-USDA',
        token1: 'STX',
        token2: 'USDA',
        liquidity: '$1,245,600',
        volume24h: '$340,290',
        fees24h: '$1,020',
        apr: '4.2%'
    },
    {
        id: 'pool-2',
        name: 'STX-BTC',
        token1: 'STX',
        token2: 'BTC',
        liquidity: '$3,567,800',
        volume24h: '$678,400',
        fees24h: '$2,035',
        apr: '5.8%'
    },
    {
        id: 'pool-3',
        name: 'USDA-BTC',
        token1: 'USDA',
        token2: 'BTC',
        liquidity: '$2,890,500',
        volume24h: '$503,700',
        fees24h: '$1,511',
        apr: '4.9%'
    }
];

export default async function PoolsPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <div className="flex-1 container max-w-5xl mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-3">Liquidity Pools</h1>
                        <p className="text-muted-foreground">
                            Provide liquidity to earn fees from trades
                        </p>
                    </div>

                    <a
                        href="/pools/create"
                        className="inline-flex items-center gap-2 h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Create Pool</span>
                    </a>
                </div>

                {/* My Positions Section */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">My Positions</h2>

                    <div className="bg-card border border-border rounded-xl p-10 shadow-sm text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/50 mx-auto flex items-center justify-center mb-4">
                            <Layers className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">No Active Positions</h3>
                        <p className="text-muted-foreground mb-6">
                            You don't have any active liquidity positions
                        </p>

                        <a
                            href="/pools/create"
                            className="inline-flex items-center justify-center h-9 rounded-md px-4 py-2 bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
                        >
                            Add Liquidity
                        </a>
                    </div>
                </div>

                {/* All Pools Section */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">All Pools</h2>

                    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                        <div className="grid grid-cols-12 p-4 text-sm font-medium text-muted-foreground bg-muted/50">
                            <div className="col-span-3 flex items-center gap-2">
                                Pool <ArrowUpDown className="h-3.5 w-3.5" />
                            </div>
                            <div className="col-span-3 text-right flex items-center justify-end gap-2">
                                Liquidity <ArrowUpDown className="h-3.5 w-3.5" />
                            </div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-2">
                                Volume (24h) <ArrowUpDown className="h-3.5 w-3.5" />
                            </div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-2">
                                APR <ArrowUpDown className="h-3.5 w-3.5" />
                            </div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        <div className="divide-y divide-border">
                            {pools.map((pool) => (
                                <div key={pool.id} className="grid grid-cols-12 p-4 items-center">
                                    <div className="col-span-3 flex items-center gap-3">
                                        <div className="flex -space-x-2">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center z-10 border-2 border-background">
                                                <span className="text-xs font-bold text-blue-600">{pool.token1.charAt(0)}</span>
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center border-2 border-background">
                                                <span className="text-xs font-bold text-green-600">{pool.token2.charAt(0)}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="font-medium">{pool.name}</div>
                                            <div className="text-xs text-muted-foreground">Pool</div>
                                        </div>
                                    </div>
                                    <div className="col-span-3 text-right">
                                        <div className="font-medium">{pool.liquidity}</div>
                                        <div className="text-xs text-muted-foreground">Total Liquidity</div>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <div className="font-medium">{pool.volume24h}</div>
                                        <div className="text-xs text-muted-foreground">Fees: {pool.fees24h}</div>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <div className="font-medium text-green-600">{pool.apr}</div>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <div className="flex justify-end gap-2">
                                            <a
                                                href={`/pools/${pool.id}`}
                                                className="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                                            >
                                                Details
                                            </a>
                                            <a
                                                href={`/pools/${pool.id}/add`}
                                                className="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 border border-input bg-background hover:bg-muted"
                                            >
                                                Add
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 