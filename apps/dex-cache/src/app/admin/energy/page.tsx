import { Suspense } from 'react';
import { Zap, Calculator, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EnergyAPYCalculator from '@/components/admin/energy/EnergyAPYCalculator';
import EnergySystemStatus from '@/components/admin/energy/EnergySystemStatus';

export const metadata = {
    title: 'Energy Rate Calculator | Charisma Admin',
    description: 'Calculate energy generation rates and APY for token holdings in the energize vault',
};

function LoadingSkeleton() {
    return (
        <div className="glass-card p-6">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="bg-muted/30 rounded-lg p-4">
                            <div className="animate-pulse">
                                <div className="flex items-center">
                                    <div className="w-8 h-8 bg-muted rounded-md"></div>
                                    <div className="ml-4 flex-1">
                                        <div className="h-4 bg-muted rounded w-20 mb-2"></div>
                                        <div className="h-6 bg-muted rounded w-12"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function EnergyRateCalculatorPage() {
    return (
        <div>
            <div className="container">
                {/* Header Section */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold tracking-tight mb-4 flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Zap className="h-6 w-6 text-primary" />
                        </div>
                        Energy Rate Calculator
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-3xl">
                        Calculate energy generation rates and APY for holding tokens in the energize vault.
                        Compare different token amounts to optimize your energy farming strategy.
                    </p>

                    {/* Token Requirement Highlight */}
                    <div className="mt-6 glass-card p-4 border-l-4 border-l-primary">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Zap className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground mb-1">Required Token for Energy Generation</h3>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Users must hold <strong>SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1</strong> tokens to generate energy rewards.
                                </p>
                                <div className="text-xs text-muted-foreground">
                                    Active Vault: SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <Tabs defaultValue="calculator" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="calculator" className="flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            Rate Calculator
                        </TabsTrigger>
                        <TabsTrigger value="status" className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            System Status
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="calculator" className="space-y-6">
                        <Suspense fallback={<LoadingSkeleton />}>
                            <EnergyAPYCalculator />
                        </Suspense>
                    </TabsContent>

                    <TabsContent value="status" className="space-y-6">
                        <Suspense fallback={<LoadingSkeleton />}>
                            <EnergySystemStatus />
                        </Suspense>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}