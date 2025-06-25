'use client';

import { NFTBonusDisplay } from '@/components/admin/energy/NFTBonusDisplay';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Crown, Info, Cpu, Battery, Zap, TrendingUp, Calculator } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';
import { Badge } from '@/components/ui/badge';

export function NFTBonusesTab() {
    const { walletState } = useApp();

    // Not logged in state
    if (!walletState.connected || !walletState.address) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Crown className="h-16 w-16 text-muted-foreground" />
                <h3 className="text-xl font-semibold">Connect Your Wallet</h3>
                <p className="text-muted-foreground text-center max-w-md">
                    Connect your wallet to view your NFT bonuses and explore available collections.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Current Bonuses */}
            <div className="xl:col-span-1 space-y-6">
                {/* Your Current NFT Bonuses */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Crown className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Your NFT Bonuses</h3>
                            <p className="text-sm text-muted-foreground">Active bonuses from your collection</p>
                        </div>
                    </div>
                    <NFTBonusDisplay userAddress={walletState.address} />
                </div>

                {/* Optimization Tip */}
                <div className="glass-card p-6">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                            <h5 className="font-medium text-primary mb-2">Balanced Approach</h5>
                            <p className="text-sm text-muted-foreground">
                                The most effective strategy combines all three NFT types: Welsh NFTs boost generation, 
                                Memobots provide storage capacity, and Ravens reduce transaction costs.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column - Available Collections & Strategies */}
            <div className="xl:col-span-2 space-y-6">
                {/* NFT Collections Overview */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Available NFT Collections</h3>
                            <p className="text-sm text-muted-foreground">Explore NFTs that boost your energy system</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Welsh NFTs */}
                        <div className="token-card p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <Zap className="h-4 w-4 text-green-500" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-green-500">Welsh NFTs</h4>
                                    <p className="text-xs text-muted-foreground">Energy Generation</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>Happy Welsh</span>
                                    <Badge variant="outline" className="text-green-500 border-green-500/30">+25%</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Weird Welsh</span>
                                    <Badge variant="outline" className="text-green-500 border-green-500/30">+15%</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Welsh Punk</span>
                                    <Badge variant="outline" className="text-green-500 border-green-500/30">+10%</Badge>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-border/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Max Bonus</span>
                                    <span className="text-sm font-semibold text-green-500">100%</span>
                                </div>
                            </div>
                        </div>

                        {/* Memobot NFTs */}
                        <div className="token-card p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Battery className="h-4 w-4 text-blue-500" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-blue-500">Memobot NFTs</h4>
                                    <p className="text-xs text-muted-foreground">Storage Capacity</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>Per Memobot</span>
                                    <Badge variant="outline" className="text-blue-500 border-blue-500/30">+10 energy</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Base Capacity</span>
                                    <span className="text-muted-foreground">100 energy</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Example (5 bots)</span>
                                    <span className="text-blue-500">150 total</span>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-border/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Max Limit</span>
                                    <span className="text-sm font-semibold text-blue-500">Unlimited</span>
                                </div>
                            </div>
                        </div>

                        {/* Raven NFTs */}
                        <div className="token-card p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Info className="h-4 w-4 text-purple-500" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-purple-500">Raven NFTs</h4>
                                    <p className="text-xs text-muted-foreground">Fee Reduction</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>Base Reduction</span>
                                    <Badge variant="outline" className="text-purple-500 border-purple-500/30">-25%</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Variable Bonus</span>
                                    <Badge variant="outline" className="text-purple-500 border-purple-500/30">Up to -25%</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Formula</span>
                                    <span className="text-xs text-muted-foreground">Highest ID</span>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-border/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Max Discount</span>
                                    <span className="text-sm font-semibold text-purple-500">50%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Optimization Strategies */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Calculator className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Optimization Strategies</h3>
                            <p className="text-sm text-muted-foreground">Build the most effective NFT collection for your goals</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Generation Strategy */}
                        <div className="token-card p-4">
                            <h4 className="font-semibold text-green-500 mb-3 flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                Maximum Generation
                            </h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div>• Start with Happy Welsh NFTs for highest generation bonus</div>
                                <div>• Mix different Welsh types to reach 100% generation cap</div>
                                <div>• Consider cost-effectiveness of each NFT type</div>
                                <div>• Focus on this strategy if you harvest frequently</div>
                            </div>
                        </div>

                        {/* Efficiency Strategy */}
                        <div className="token-card p-4">
                            <h4 className="font-semibold text-blue-500 mb-3 flex items-center gap-2">
                                <Battery className="h-4 w-4" />
                                Long-term Efficiency
                            </h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div>• Begin with Memobots to increase storage capacity</div>
                                <div>• Add Ravens to reduce transaction costs</div>
                                <div>• Higher capacity means less frequent harvesting</div>
                                <div>• Perfect for passive energy accumulation</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}