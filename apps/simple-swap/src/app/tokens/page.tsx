import React from 'react';
import { listTokens } from "../actions";
import { Header } from "../../components/header";
import { ArrowUpDown, Search } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
    title: 'Token List | SimpleSwap',
    description: 'View all available tokens on the SimpleSwap platform'
};

export default async function TokensPage() {
    // Fetch tokens on the server
    const { success, tokens = [] } = await listTokens();

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <div className="flex-1 container max-w-5xl mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight mb-3">Tokens</h1>
                    <p className="text-muted-foreground">
                        Browse all available tokens supported on SimpleSwap
                    </p>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="relative w-full sm:w-auto sm:min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by name or address"
                            className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Sort by:</span>
                        <select className="h-10 rounded-md border border-input bg-background pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                            <option value="name">Name</option>
                            <option value="price">Price</option>
                            <option value="volume">Volume</option>
                        </select>
                    </div>
                </div>

                {/* Token List */}
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="grid grid-cols-12 p-4 text-sm font-medium text-muted-foreground bg-muted/50">
                        <div className="col-span-5 flex items-center gap-2">
                            Token <ArrowUpDown className="h-3.5 w-3.5" />
                        </div>
                        <div className="col-span-3 text-right flex items-center justify-end gap-2">
                            Price <ArrowUpDown className="h-3.5 w-3.5" />
                        </div>
                        <div className="col-span-2 text-right flex items-center justify-end gap-2">
                            Supply <ArrowUpDown className="h-3.5 w-3.5" />
                        </div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>

                    <div className="divide-y divide-border">
                        {tokens.map((token) => (
                            <div key={token.contractId} className="grid grid-cols-12 p-4 items-center">
                                <div className="col-span-5 flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden">
                                        {token.image ? (
                                            <Image
                                                src={token.image}
                                                alt={token.symbol}
                                                width={40}
                                                height={40}
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="text-lg font-bold text-primary/50">
                                                {token.symbol.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium">{token.name}</div>
                                        <div className="text-sm text-muted-foreground">{token.symbol}</div>
                                    </div>
                                </div>
                                <div className="col-span-3 text-right">
                                    <div className="font-medium">$0.00</div>
                                    <div className="text-sm text-muted-foreground">-</div>
                                </div>
                                <div className="col-span-2 text-right">
                                    <div className="font-medium">{token.total_supply || "-"}</div>
                                </div>
                                <div className="col-span-2 text-right">
                                    <Link
                                        href={`/swap?from=STX&to=${token.symbol}`}
                                        className="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                        Swap
                                    </Link>
                                </div>
                            </div>
                        ))}

                        {tokens.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground">
                                No tokens found
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 