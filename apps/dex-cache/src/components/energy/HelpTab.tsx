'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    HelpCircle,
    Coins,
    Droplets,
    Zap,
    ArrowRight,
    ExternalLink,
    Crown,
    Battery,
    Flame,
    TrendingUp,
    Users,
    Target,
    DollarSign
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function HelpTab() {
    return (
        <div className="space-y-6">
            {/* Getting Started */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Getting Started</h3>
                        <p className="text-sm text-muted-foreground">Start generating energy and earning rewards in 3 simple steps</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Step 1: Get Tokens */}
                    <div className="token-card p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Coins className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                                <Badge variant="outline" className="text-blue-500 border-blue-500/30 mb-1">Step 1</Badge>
                                <h4 className="font-semibold">Get Energy Tokens</h4>
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                            Acquire FLOW, POV, or DEX tokens to start generating energy automatically.
                        </p>

                        <div className="space-y-2">
                            <Button variant="outline" size="sm" className="w-full justify-between" asChild>
                                <a href="/pools" target="_blank" rel="noopener noreferrer">
                                    Add Liquidity to Pools
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" className="w-full justify-between" asChild>
                                <a href="https://swap.charisma.rocks/swap" target="_blank" rel="noopener noreferrer">
                                    Buy on DEX
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Step 2: Generate Energy */}
                    <div className="token-card p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Zap className="h-4 w-4 text-green-500" />
                            </div>
                            <div>
                                <Badge variant="outline" className="text-green-500 border-green-500/30 mb-1">Step 2</Badge>
                                <h4 className="font-semibold">Generate Energy</h4>
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                            Hold tokens in your wallet and watch energy accumulate automatically over time.
                        </p>

                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span>FLOW tokens:</span>
                                <span className="text-green-500">High rate</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>POV tokens:</span>
                                <span className="text-green-500">Medium rate</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>DEX tokens:</span>
                                <span className="text-green-500">Base rate</span>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Claim Rewards */}
                    <div className="token-card p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <Flame className="h-4 w-4 text-orange-500" />
                            </div>
                            <div>
                                <Badge variant="outline" className="text-orange-500 border-orange-500/30 mb-1">Step 3</Badge>
                                <h4 className="font-semibold">Claim Rewards</h4>
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                            Burn accumulated energy to receive HOOT tokens and other exclusive rewards.
                        </p>

                        <div className="space-y-2 text-sm text-muted-foreground">
                            <div>• HOOT token rewards</div>
                            <div>• Governance voting power</div>
                            <div>• Access to premium features</div>
                            <div>• Community benefits</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* How It Works */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <HelpCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">How the Energy System Works</h3>
                        <p className="text-sm text-muted-foreground">Understanding the hold-to-earn mechanics</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Energy Generation */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-primary flex items-center gap-2">
                            <Droplets className="h-4 w-4" />
                            Energy Generation
                        </h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <div>
                                    <strong>Automatic Generation:</strong> Simply hold supported tokens in your wallet and energy accumulates continuously, 24/7.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <div>
                                    <strong>Multiple Engines:</strong> Different token types contribute energy at different rates. The more tokens you hold, the faster you generate energy.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <div>
                                    <strong>Real-time Tracking:</strong> Watch your energy accumulate in real-time on the dashboard with live updates.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <div>
                                    <strong>Capacity Limits:</strong> Your energy tank has a maximum capacity. Harvest regularly to avoid waste.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rewards & Benefits */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-orange-500 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Rewards & Benefits
                        </h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                                <div>
                                    <strong>HOOT Token Rewards:</strong> Burn energy to receive HOOT tokens, which have real utility and value in the ecosystem.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                                <div>
                                    <strong>Governance Power:</strong> Use your energy and HOOT tokens to participate in community governance and vote on proposals.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                                <div>
                                    <strong>Exclusive Access:</strong> Energy holders get early access to new features, airdrops, and special community events.
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                                <div>
                                    <strong>Compound Benefits:</strong> The longer you hold and the more you participate, the greater your rewards become.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Supported Tokens */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Supported Energy Tokens</h3>
                        <p className="text-sm text-muted-foreground">Learn about the tokens that generate energy</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* FLOW Token */}
                    <div className="token-card p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <Droplets className="h-4 w-4 text-orange-500" />
                            </div>
                            <div>
                                <h4 className="font-semibold">FLOW Token</h4>
                                <Badge variant="outline" className="text-orange-500 border-orange-500/30">High Yield</Badge>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Charismatic Flow tokens provide the highest energy generation rate. Best for maximizing rewards.
                        </p>
                        <Button variant="outline" size="sm" className="w-full" asChild>
                            <a href="https://swap.charisma.rocks/swap" target="_blank" rel="noopener noreferrer">
                                Get FLOW Tokens
                                <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    </div>

                    {/* POV Token */}
                    <div className="token-card p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Users className="h-4 w-4 text-purple-500" />
                            </div>
                            <div>
                                <h4 className="font-semibold">POV Token</h4>
                                <Badge variant="outline" className="text-purple-500 border-purple-500/30">Medium Yield</Badge>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Perseverantia tokens offer balanced energy generation. Good for steady, consistent rewards.
                        </p>
                        <Button variant="outline" size="sm" className="w-full" asChild>
                            <a href="https://swap.charisma.rocks/swap" target="_blank" rel="noopener noreferrer">
                                Get POV Tokens
                                <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    </div>

                    {/* DEX Token */}
                    <div className="token-card p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                                <h4 className="font-semibold">DEX Token</h4>
                                <Badge variant="outline" className="text-blue-500 border-blue-500/30">Base Yield</Badge>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Dexterity tokens provide base energy generation. Perfect for getting started in the ecosystem.
                        </p>
                        <Button variant="outline" size="sm" className="w-full" asChild>
                            <a href="https://swap.charisma.rocks/swap" target="_blank" rel="noopener noreferrer">
                                Get DEX Tokens
                                <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                        </Button>
                    </div>
                </div>
            </div>

            {/* NFT Boost Info */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Crown className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Boost with NFTs</h3>
                        <p className="text-sm text-muted-foreground">Supercharge your energy generation with NFT bonuses</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-green-500 flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Generation Boosts
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span>Welsh NFTs:</span>
                                <Badge variant="outline" className="text-green-500 border-green-500/30">Up to +100%</Badge>
                            </div>
                            <p className="text-muted-foreground">
                                Welsh NFTs multiply your energy generation rate. Collect different types to maximize your bonus.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-blue-500 flex items-center gap-2">
                            <Battery className="h-4 w-4" />
                            Capacity & Efficiency
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span>Memobot NFTs:</span>
                                <Badge variant="outline" className="text-blue-500 border-blue-500/30">+10 per NFT</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Raven NFTs:</span>
                                <Badge variant="outline" className="text-purple-500 border-purple-500/30">Up to -50% fees</Badge>
                            </div>
                            <p className="text-muted-foreground">
                                Increase storage capacity and reduce transaction costs for more efficient energy management.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-start gap-3">
                        <Crown className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                            <h5 className="font-medium text-primary mb-1">Pro Tip</h5>
                            <p className="text-sm text-muted-foreground">
                                Check the NFT Bonuses tab to see your current bonuses and learn about optimization strategies.
                                The best approach combines all three NFT types for maximum efficiency.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ArrowRight className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Quick Actions</h3>
                        <p className="text-sm text-muted-foreground">Get started with these helpful links</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Button className="h-auto flex-col gap-2 p-4" asChild>
                        <a href="/pools" target="_blank" rel="noopener noreferrer">
                            <Droplets className="h-5 w-5" />
                            <span>View Pools</span>
                            <span className="text-xs opacity-80">Add liquidity</span>
                        </a>
                    </Button>

                    <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
                        <a href="https://swap.charisma.rocks/swap" target="_blank" rel="noopener noreferrer">
                            <Coins className="h-5 w-5" />
                            <span>Buy Tokens</span>
                            <span className="text-xs opacity-80">Use the DEX</span>
                        </a>
                    </Button>

                    <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
                        <a href="/shop" target="_blank" rel="noopener noreferrer">
                            <Crown className="h-5 w-5" />
                            <span>NFT Market</span>
                            <span className="text-xs opacity-80">Buy bonus NFTs</span>
                        </a>
                    </Button>

                    <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
                        <a href="/prices" target="_blank" rel="noopener noreferrer">
                            <DollarSign className="h-5 w-5" />
                            <span>Prices</span>
                            <span className="text-xs opacity-80">See the latest prices</span>
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}