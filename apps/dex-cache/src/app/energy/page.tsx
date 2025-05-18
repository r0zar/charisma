export const revalidate = 300; // Revalidate this page at most every 5 minutes

import EnergyVaultList from '@/components/hold-to-earn/EnergyVaultList';
import UserEnergyDashboard from '@/components/hold-to-earn/UserEnergyDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Info, Clock, Shield, HandCoins, Battery } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAllEnergyAnalyticsData } from '@/lib/server/energy';
import type { EnergyAnalyticsData } from '@/lib/energy/analytics';

export default async function EnergyPage() {
    let allAnalyticsData: Array<{ contractId: string; analyticsData: EnergyAnalyticsData | null }> = [];
    if (process.env.NODE_ENV === 'development') {
        allAnalyticsData = await getAllEnergyAnalyticsData();
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Zap className="h-8 w-8 text-primary" />
                        Hold-to-Earn
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        Earn energy by holding tokens in your wallet. The longer you hold, the more energy you accumulate, which can be harvested for rewards.
                    </p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Section */}
                <aside className="w-full lg:w-1/3 xl:w-1/4 space-y-6">
                    <h2 className="text-xl font-semibold text-primary mb-4">How it Works</h2>
                    {/* Info Cards */}
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center">
                                <Clock className="h-5 w-5 mr-2 text-primary" />
                                Hold Tokens
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Energy accumulates based on how long you hold tokens. Keep them in your wallet to start earning. Be aware, energy accumulates very quickly.
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center">
                                <Zap className="h-5 w-5 mr-2 text-primary" />
                                Harvest Energy
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Claim your accumulated energy when you're ready. Your rewards scale with the duration and amount you hold. Energy can be harvested as frequently as you want.
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center">
                                <Battery className="h-5 w-5 mr-2 text-primary" />
                                Manage Capacity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            All accounts start with a max capacity of 100 energy, so you'll want to spend harvested energy on rewards fast. You can increase your maximum energy capacity by 10 for each Memobot NFT you hold.
                        </CardContent>
                    </Card>

                    {/* Optional Informational Alert */}
                    <Alert variant="default" className="bg-primary/5 border-primary/20">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-primary">What is Hold-to-Earn?</AlertTitle>
                        <AlertDescription className="text-sm text-muted-foreground">
                            Hold-to-Earn is a feature that rewards long-term holders of specific tokens. As you hold tokens in your wallet, you accrue energy over time.
                            This energy can be harvested and used within the ecosystem for various benefits. Select a token below to get started.
                        </AlertDescription>
                    </Alert>
                </aside>

                {/* Main Content Section */}
                <main className="w-full lg:w-2/3 xl:w-3/4 space-y-8">
                    {/* User's Energy Dashboard Section - Now using client component */}
                    <UserEnergyDashboard />

                    {/* Main Content - Vault List */}
                    <div className="bg-card rounded-lg border border-border/50 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold">Eligible Tokens to Start Earning</h2>
                            <Badge variant="outline" className="px-3">
                                <Zap className="h-3.5 w-3.5 mr-1.5 text-primary" />
                                Hold-To-Earn
                            </Badge>
                        </div>
                        <EnergyVaultList />
                    </div>
                </main>
            </div>

            {/* Dev Only: Display All Analytics Data */}
            {process.env.NODE_ENV === 'development' && allAnalyticsData.length > 0 && (
                <div className="mt-8 p-4 border rounded-md bg-card">
                    <h2 className="text-xl font-semibold mb-3">Dev Mode: All Energy Analytics Data</h2>
                    <pre className="text-xs bg-muted/50 p-4 rounded overflow-auto max-h-[600px]">
                        {JSON.stringify(allAnalyticsData, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
} 