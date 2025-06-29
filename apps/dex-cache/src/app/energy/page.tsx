export const revalidate = 300; // Revalidate this page at most every 5 minutes

import { EnergyDashboardTab } from '@/components/energy/EnergyDashboardTab';
import { NFTBonusesTab } from '@/components/energy/NFTBonusesTab';
import { HelpTab } from '@/components/energy/HelpTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Zap, Crown, HelpCircle } from 'lucide-react';

// https://explorer.hiro.so/txid/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.power-cells?chain=mainnet

export default function EnergyPage() {

    return (
        <div className="container mx-auto py-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Zap className="h-8 w-8 text-primary" />
                        Hold-to-Earn
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Advanced energy management dashboard with real-time tracking, NFT bonuses, and rewards.
                    </p>
                </div>
            </div>

            {/* Tabbed Interface */}
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12 mb-4">
                    <TabsTrigger value="dashboard" className="flex items-center gap-2 text-sm">
                        <Zap className="h-4 w-4" />
                        <span className="hidden sm:inline">Energy Dashboard</span>
                        <span className="sm:hidden">Dashboard</span>
                    </TabsTrigger>
                    <TabsTrigger value="nft-bonuses" className="flex items-center gap-2 text-sm">
                        <Crown className="h-4 w-4" />
                        <span className="hidden sm:inline">NFT Bonuses</span>
                        <span className="sm:hidden">NFTs</span>
                    </TabsTrigger>
                    <TabsTrigger value="help" className="flex items-center gap-2 text-sm">
                        <HelpCircle className="h-4 w-4" />
                        <span className="hidden sm:inline">Help & Info</span>
                        <span className="sm:hidden">Help</span>
                    </TabsTrigger>
                </TabsList>

                {/* Energy Dashboard Tab */}
                <TabsContent value="dashboard" className="space-y-8">
                    {/* Combined Energy Dashboard with Real-time Tracking and Tank Visualization */}
                    <EnergyDashboardTab />
                </TabsContent>

                {/* NFT Bonuses Tab */}
                <TabsContent value="nft-bonuses" className="space-y-8">
                    <NFTBonusesTab />
                </TabsContent>

                {/* Help & Info Tab */}
                <TabsContent value="help" className="space-y-8">
                    <HelpTab />
                </TabsContent>
            </Tabs>

        </div>
    );
} 