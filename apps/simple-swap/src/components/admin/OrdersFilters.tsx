'use client';

import React, { useState } from 'react';
import { Search, Filter, Calendar, Download, SlidersHorizontal, X, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FilterState {
    search: string;
    status: string;
    orderType: string;
    dateRange: string;
    tokenPair: string;
    priceRange: { min: string; max: string };
    volumeRange: { min: string; max: string };
    priority: string;
    owner: string;
}

export function OrdersFilters() {
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        status: 'all',
        orderType: 'all',
        dateRange: 'all',
        tokenPair: 'all',
        priceRange: { min: '', max: '' },
        volumeRange: { min: '', max: '' },
        priority: 'all',
        owner: ''
    });

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [activeFilterCount, setActiveFilterCount] = useState(0);

    const handleFilterChange = (key: keyof FilterState, value: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));

        // Update active filter count
        const newFilters = { ...filters, [key]: value };
        const count = Object.entries(newFilters).filter(([k, v]) => {
            if (k === 'search' || k === 'owner') return v !== '';
            if (k === 'priceRange' || k === 'volumeRange') {
                return (v as { min: string; max: string }).min !== '' || (v as { min: string; max: string }).max !== '';
            }
            return v !== 'all' && v !== '';
        }).length;
        setActiveFilterCount(count);
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            status: 'all',
            orderType: 'all',
            dateRange: 'all',
            tokenPair: 'all',
            priceRange: { min: '', max: '' },
            volumeRange: { min: '', max: '' },
            priority: 'all',
            owner: ''
        });
        setActiveFilterCount(0);
    };

    const presetFilters = [
        {
            label: 'Active Orders',
            icon: Clock,
            action: () => handleFilterChange('status', 'open'),
            color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
        },
        {
            label: 'Recent Fills',
            icon: Zap,
            action: () => handleFilterChange('status', 'filled'),
            color: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
        },
        {
            label: 'Failed Orders',
            icon: X,
            action: () => handleFilterChange('status', 'failed'),
            color: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
        },
        {
            label: 'High Volume',
            icon: Filter,
            action: () => handleFilterChange('volumeRange', { min: '10000', max: '' }),
            color: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'
        },
        {
            label: 'High Priority',
            icon: Zap,
            action: () => handleFilterChange('priority', 'high'),
            color: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
        },
    ];

    return (
        <div className="bg-card rounded-lg border border-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Filter className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Order Filters</h3>
                    {activeFilterCount > 0 && (
                        <span className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium border border-primary/20">
                            {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="gap-2"
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Advanced
                        {showAdvanced && <span className="text-xs bg-primary/10 text-primary px-1 rounded">ON</span>}
                    </Button>
                    {activeFilterCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                        >
                            <X className="w-4 h-4" />
                            Clear All
                        </Button>
                    )}
                </div>
            </div>

            {/* Quick Filter Presets */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Quick Filters:</span>
                    <span className="text-xs text-muted-foreground">Click to apply common filter combinations</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {presetFilters.map((preset, index) => {
                        const Icon = preset.icon;
                        return (
                            <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={preset.action}
                                className={`gap-2 transition-all ${preset.color}`}
                            >
                                <Icon className="w-3 h-3" />
                                {preset.label}
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Primary Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="Search orders, addresses, tokens..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <option value="all">All Statuses</option>
                    <option value="open">🟢 Open Orders</option>
                    <option value="filled">✅ Filled Orders</option>
                    <option value="cancelled">⚪ Cancelled Orders</option>
                    <option value="failed">🔴 Failed Orders</option>
                    <option value="pending">🟡 Pending Orders</option>
                </select>

                {/* Order Type Filter */}
                <select
                    value={filters.orderType}
                    onChange={(e) => handleFilterChange('orderType', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <option value="all">All Order Types</option>
                    <option value="limit">📊 Limit Orders</option>
                    <option value="dca">🔄 DCA Orders</option>
                    <option value="perpetual">⚡ Perpetual Positions</option>
                    <option value="sandwich">🥪 Sandwich Orders</option>
                </select>

                {/* Date Range Filter */}
                <select
                    value={filters.dateRange}
                    onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <option value="all">All Time</option>
                    <option value="today">📅 Today</option>
                    <option value="week">📆 This Week</option>
                    <option value="month">🗓️ This Month</option>
                    <option value="quarter">📋 This Quarter</option>
                    <option value="custom">⚙️ Custom Range</option>
                </select>
            </div>

            {/* Advanced Filters */}
            {showAdvanced && (
                <div className="border-t border-border pt-6 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <SlidersHorizontal className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Advanced Filtering Options</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Token Pair Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Trading Pair</label>
                            <select
                                value={filters.tokenPair}
                                onChange={(e) => handleFilterChange('tokenPair', e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <option value="all">All Trading Pairs</option>
                                <option value="STX/USDT">STX/USDT</option>
                                <option value="BTC/USDT">BTC/USDT</option>
                                <option value="CHA/STX">CHA/STX</option>
                                <option value="ALEX/STX">ALEX/STX</option>
                                <option value="WELSH/STX">WELSH/STX</option>
                                <option value="HOOT/STX">HOOT/STX</option>
                            </select>
                            <p className="text-xs text-muted-foreground">Filter by specific token trading pairs</p>
                        </div>

                        {/* Priority Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Order Priority</label>
                            <select
                                value={filters.priority}
                                onChange={(e) => handleFilterChange('priority', e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <option value="all">All Priorities</option>
                                <option value="high">🔴 High Priority</option>
                                <option value="medium">🟡 Medium Priority</option>
                                <option value="low">⚪ Low Priority</option>
                            </select>
                            <p className="text-xs text-muted-foreground">Filter by execution priority level</p>
                        </div>

                        {/* Owner Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Order Owner</label>
                            <Input
                                placeholder="SP2ZNG... or wallet address"
                                value={filters.owner}
                                onChange={(e) => handleFilterChange('owner', e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Filter by specific wallet address</p>
                        </div>

                        {/* Price Range */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Target Price Range ($)</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Min price"
                                    value={filters.priceRange.min}
                                    onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, min: e.target.value })}
                                    type="number"
                                    step="0.01"
                                />
                                <Input
                                    placeholder="Max price"
                                    value={filters.priceRange.max}
                                    onChange={(e) => handleFilterChange('priceRange', { ...filters.priceRange, max: e.target.value })}
                                    type="number"
                                    step="0.01"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Filter by target price range</p>
                        </div>

                        {/* Volume Range */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Order Volume Range ($)</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Min volume"
                                    value={filters.volumeRange.min}
                                    onChange={(e) => handleFilterChange('volumeRange', { ...filters.volumeRange, min: e.target.value })}
                                    type="number"
                                    step="100"
                                />
                                <Input
                                    placeholder="Max volume"
                                    value={filters.volumeRange.max}
                                    onChange={(e) => handleFilterChange('volumeRange', { ...filters.volumeRange, max: e.target.value })}
                                    type="number"
                                    step="100"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Filter by total order volume</p>
                        </div>
                    </div>

                    {/* Advanced Options Checkboxes */}
                    <div className="bg-muted/20 rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-medium text-foreground">Additional Options</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                                <input type="checkbox" className="rounded border-border" />
                                <span className="text-muted-foreground">Include expired orders</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                                <input type="checkbox" className="rounded border-border" />
                                <span className="text-muted-foreground">Show system orders</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                                <input type="checkbox" className="rounded border-border" />
                                <span className="text-muted-foreground">Include test orders</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                                <input type="checkbox" className="rounded border-border" />
                                <span className="text-muted-foreground">Show partial fills only</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                                <input type="checkbox" className="rounded border-border" />
                                <span className="text-muted-foreground">Hide dust orders (&lt;$1)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                                <input type="checkbox" className="rounded border-border" />
                                <span className="text-muted-foreground">Real-time updates</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Export and Action Options */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                        {activeFilterCount > 0 ? (
                            <span className="flex items-center gap-2">
                                <Filter className="w-3 h-3" />
                                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied • Results will be filtered
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                📊 Showing all orders • No filters applied
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                        Auto-refresh: ON
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" />
                        Export Filtered
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Calendar className="w-4 h-4" />
                        Schedule Report
                    </Button>
                    <Button size="sm" className="gap-2">
                        <Filter className="w-4 h-4" />
                        Apply Filters
                    </Button>
                </div>
            </div>
        </div>
    );
}