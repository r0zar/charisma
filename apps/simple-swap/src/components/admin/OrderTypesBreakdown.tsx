'use client';

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '@/components/ui/tooltip';
import { BarChart3 } from 'lucide-react';

interface OrderTypeStats {
    single: number;
    dca: number;
    sandwich: number;
    total: number;
}


interface OrderTypesBreakdownProps {
    stats: {
        totalOrders: number;
        orderTypes: {
            single: number;
            dca: number;
            sandwich: number;
        };
    };
}

export function OrderTypesBreakdown({ stats: adminStats }: OrderTypesBreakdownProps) {
    const stats = {
        single: adminStats.orderTypes.single,
        dca: adminStats.orderTypes.dca,
        sandwich: adminStats.orderTypes.sandwich,
        total: adminStats.totalOrders
    };
    
    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Order Types</h3>
                <InfoTooltip content="Distribution of different order types in the system. Helps understand trading patterns and feature usage." />
            </div>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                        <span className="text-muted-foreground">Limit Orders:</span>
                    </div>
                    <span className="font-mono text-foreground">{stats.single}</span>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                        <span className="text-muted-foreground">DCA Orders:</span>
                    </div>
                    <span className="font-mono text-foreground">{stats.dca}</span>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                        <span className="text-muted-foreground">Sandwich Orders:</span>
                    </div>
                    <span className="font-mono text-foreground">{stats.sandwich}</span>
                </div>
                
                <div className="pt-2 mt-4 border-t border-border">
                    <div className="flex justify-between items-center font-medium">
                        <span className="text-foreground">Total Orders:</span>
                        <span className="font-mono text-foreground">{stats.total}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}