import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
// Import placeholder forms
import { PoolSwapForm } from './PoolSwapForm';
import { PoolAddLiquidityForm } from './PoolAddLiquidityForm';
import { PoolRemoveLiquidityForm } from './PoolRemoveLiquidityForm';
import { type PoolInfo } from './PoolDetails'; // Import PoolInfo type

interface PoolActionsTabsProps {
    poolInfo: PoolInfo | null; // Pass pool info down
    contractId: string;
    className?: string;
}

export const PoolActionsTabs: React.FC<PoolActionsTabsProps> = ({ poolInfo, contractId, className }) => {
    if (!poolInfo) {
        // Don't render tabs if pool info isn't loaded yet
        return null;
    }

    return (
        <Tabs defaultValue="swap" className={className}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="swap">Swap</TabsTrigger>
                <TabsTrigger value="add">Add Liquidity</TabsTrigger>
                <TabsTrigger value="remove">Remove Liquidity</TabsTrigger>
            </TabsList>
            <TabsContent value="swap">
                <Card className="p-6">
                    <PoolSwapForm poolInfo={poolInfo} contractId={contractId} />
                </Card>
            </TabsContent>
            <TabsContent value="add">
                <Card className="p-6">
                    <PoolAddLiquidityForm poolInfo={poolInfo} contractId={contractId} />
                </Card>
            </TabsContent>
            <TabsContent value="remove">
                <Card className="p-6">
                    <PoolRemoveLiquidityForm poolInfo={poolInfo} contractId={contractId} />
                </Card>
            </TabsContent>
        </Tabs>
    );
}; 