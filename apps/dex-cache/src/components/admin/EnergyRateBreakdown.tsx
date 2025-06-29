'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator, TrendingUp, Zap, Target, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import type { TokenCacheData } from '@repo/tokens';
import { 
    calculateEnergyRateBreakdown, 
    simulateEnergyAccumulation,
    generateBalanceImpactData,
    validateCalculations,
    ENERGY_CONSTANTS,
    type EnergyRateBreakdown as EnergyRateBreakdownType,
    type EnergyCalculationParams
} from '@/lib/energy/rate-calculations';
import { formatEnergyRate } from '@/lib/format-energy';

interface EnergyRateBreakdownProps {
    tokenData?: TokenCacheData[];
    energyTokenMetadata?: TokenCacheData;
    historicRates?: { [contractId: string]: number }; // Energy per second rates from historic data
}

interface SimulationPoint {
    time: number;
    energy: number;
    energyFormatted: number;
    isCapped: boolean;
}

export function EnergyRateBreakdown({ tokenData = [], energyTokenMetadata, historicRates = {} }: EnergyRateBreakdownProps) {
    // Form state
    const [selectedToken, setSelectedToken] = useState<string>('');
    const [userBalance, setUserBalance] = useState<string>('1000000'); // 1 token in raw units
    const [customTotalSupply, setCustomTotalSupply] = useState<string>('');
    const [customCapacity, setCustomCapacity] = useState<string>('100');
    
    // Calculation results
    const [breakdown, setBreakdown] = useState<EnergyRateBreakdownType | null>(null);
    const [simulation, setSimulation] = useState<SimulationPoint[]>([]);
    const [balanceImpact, setBalanceImpact] = useState<any[]>([]);
    const [validation, setValidation] = useState<any>(null);
    
    // UI state
    const [isCalculating, setIsCalculating] = useState(false);
    const [simulationDuration, setSimulationDuration] = useState<string>('3600'); // 1 hour

    // Auto-select first token if available
    useEffect(() => {
        if (tokenData.length > 0 && !selectedToken) {
            setSelectedToken(tokenData[0].contractId);
        }
    }, [tokenData, selectedToken]);

    // Get selected token metadata
    const selectedTokenMetadata = tokenData.find(t => t.contractId === selectedToken);

    // Perform calculations when inputs change
    useEffect(() => {
        if (!selectedTokenMetadata || !userBalance) return;

        const calculateBreakdown = async () => {
            setIsCalculating(true);
            try {
                const balanceNum = parseFloat(userBalance) || 0;
                const capacityNum = parseFloat(customCapacity) || ENERGY_CONSTANTS.DEFAULT_CAPACITY;
                const durationNum = parseFloat(simulationDuration) || 3600;
                
                // Use historic rate if available, otherwise fall back to smart contract calculation
                const historicRate = historicRates[selectedToken];
                
                let calculatedBreakdown: EnergyRateBreakdownType;
                
                if (historicRate) {
                    // Simple calculation based on historic data
                    const tokenDivisor = Math.pow(10, selectedTokenMetadata.decimals || 6);
                    const energyDivisor = Math.pow(10, energyTokenMetadata?.decimals || 6);
                    const userBalanceFormatted = balanceNum / tokenDivisor;
                    
                    // Estimate: assume energy rate is per token held
                    const baseRatePerToken = historicRate; // Energy per second per token from historic data
                    const finalEnergyRate = balanceNum * baseRatePerToken;
                    const finalEnergyRateFormatted = finalEnergyRate / energyDivisor;
                    
                    calculatedBreakdown = {
                        userBalance: balanceNum,
                        userBalanceFormatted,
                        baseRate: baseRatePerToken,
                        baseRateFormatted: baseRatePerToken / (energyDivisor / tokenDivisor),
                        rawEnergyRate: finalEnergyRate,
                        total_supply: parseFloat(selectedTokenMetadata.total_supply || '0'),
                        supplyDilutionFactor: 1, // Simplified for historic estimation
                        finalEnergyRate,
                        finalEnergyRateFormatted,
                        timeToFillCapacity: finalEnergyRate > 0 ? (capacityNum * energyDivisor) / finalEnergyRate : Infinity,
                        efficiencyRatio: finalEnergyRateFormatted * 3600
                    };
                } else {
                    // Fall back to smart contract calculation
                    const params: EnergyCalculationParams = {
                        userBalance: balanceNum,
                        total_supply: customTotalSupply ? parseFloat(customTotalSupply) : undefined,
                        capacityLimit: capacityNum,
                        tokenDecimals: selectedTokenMetadata.decimals,
                        energyDecimals: energyTokenMetadata?.decimals || 6
                    };

                    calculatedBreakdown = calculateEnergyRateBreakdown(
                        params,
                        selectedTokenMetadata,
                        energyTokenMetadata
                    );
                }
                setBreakdown(calculatedBreakdown);

                // Run simulation
                const simulationData = simulateEnergyAccumulation(
                    calculatedBreakdown.finalEnergyRate,
                    durationNum,
                    capacityNum,
                    energyTokenMetadata?.decimals || 6
                );
                setSimulation(simulationData);

                // Generate balance impact analysis
                const maxBalance = balanceNum * 5; // Show up to 5x current balance
                const impactData = generateBalanceImpactData(
                    maxBalance,
                    20, // 20 data points
                    selectedTokenMetadata,
                    energyTokenMetadata
                );
                setBalanceImpact(impactData);

                // Validate calculations
                const validationResult = validateCalculations(calculatedBreakdown);
                setValidation(validationResult);

            } catch (error) {
                console.error('Error calculating energy breakdown:', error);
            } finally {
                setIsCalculating(false);
            }
        };

        calculateBreakdown();
    }, [selectedToken, userBalance, customTotalSupply, customCapacity, simulationDuration, selectedTokenMetadata, energyTokenMetadata]);

    const formatNumber = (value: number, decimals = 2) => {
        return value.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
    };

    const formatTime = (seconds: number): string => {
        if (seconds === Infinity) return 'Never';
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
        return `${Math.round(seconds / 86400)}d`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Calculator className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">Energy Rate Calculator & Simulation</h3>
                    <p className="text-sm text-muted-foreground">
                        Estimate energy generation rates based on token balances and historic data
                    </p>
                </div>
            </div>

            {/* Input Form */}
            <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="token-select">Token</Label>
                        <select
                            id="token-select"
                            value={selectedToken}
                            onChange={(e) => setSelectedToken(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                        >
                            <option value="">Select token...</option>
                            {tokenData.map((token) => (
                                <option key={token.contractId} value={token.contractId}>
                                    {token.symbol} - {token.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <Label htmlFor="balance">User Balance (raw units)</Label>
                        <Input
                            id="balance"
                            type="number"
                            value={userBalance}
                            onChange={(e) => setUserBalance(e.target.value)}
                            placeholder="1000000"
                        />
                        {selectedTokenMetadata && (
                            <p className="text-xs text-muted-foreground mt-1">
                                ≈ {formatNumber(parseFloat(userBalance || '0') / Math.pow(10, selectedTokenMetadata.decimals || 6))} {selectedTokenMetadata.symbol}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="capacity">Energy Capacity</Label>
                        <Input
                            id="capacity"
                            type="number"
                            value={customCapacity}
                            onChange={(e) => setCustomCapacity(e.target.value)}
                            placeholder="100"
                        />
                    </div>

                    <div>
                        <Label htmlFor="duration">Simulation Duration (seconds)</Label>
                        <Input
                            id="duration"
                            type="number"
                            value={simulationDuration}
                            onChange={(e) => setSimulationDuration(e.target.value)}
                            placeholder="3600"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(parseFloat(simulationDuration || '0'))}
                        </p>
                    </div>
                </div>

                {customTotalSupply && (
                    <div className="mt-4">
                        <Label htmlFor="total-supply">Custom Total Supply (optional)</Label>
                        <Input
                            id="total-supply"
                            type="number"
                            value={customTotalSupply}
                            onChange={(e) => setCustomTotalSupply(e.target.value)}
                            placeholder="Leave empty to use token metadata"
                        />
                    </div>
                )}
            </Card>

            {/* Validation Alert */}
            {validation && (
                <Alert variant={validation.isValid ? "default" : "destructive"}>
                    <div className="flex items-center gap-2">
                        {validation.isValid ? (
                            <CheckCircle className="h-4 w-4" />
                        ) : (
                            <AlertCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>
                            {validation.isValid ? (
                                "Calculations appear valid"
                            ) : (
                                `Validation issues: ${validation.warnings.join(', ')}`
                            )}
                        </AlertDescription>
                    </div>
                </Alert>
            )}

            {/* Results Tabs */}
            {breakdown && (
                <Tabs defaultValue="breakdown" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                        <TabsTrigger value="simulation">Simulation</TabsTrigger>
                        <TabsTrigger value="impact">Balance Impact</TabsTrigger>
                        <TabsTrigger value="constants">Constants</TabsTrigger>
                    </TabsList>

                    {/* Calculation Breakdown */}
                    <TabsContent value="breakdown" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Step-by-step calculation */}
                            <Card className="p-6">
                                <h4 className="font-semibold mb-4 flex items-center gap-2">
                                    <Calculator className="h-4 w-4" />
                                    Calculation Steps
                                </h4>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">User Balance:</span>
                                        <code className="text-sm bg-muted px-2 py-1 rounded">
                                            {formatNumber(breakdown.userBalanceFormatted)} {selectedTokenMetadata?.symbol}
                                        </code>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-sm cursor-help underline decoration-dotted">Base Rate:</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Energy per token per second</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <code className="text-sm bg-muted px-2 py-1 rounded">
                                            {formatEnergyRate(breakdown.baseRateFormatted, energyTokenMetadata)}
                                        </code>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm">Total Supply:</span>
                                        <code className="text-sm bg-muted px-2 py-1 rounded">
                                            {formatNumber(breakdown.total_supply / Math.pow(10, selectedTokenMetadata?.decimals || 6))}
                                        </code>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-sm cursor-help underline decoration-dotted">Supply Dilution:</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>How total supply affects individual rates</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <code className="text-sm bg-muted px-2 py-1 rounded">
                                            {(breakdown.supplyDilutionFactor * 100).toFixed(4)}%
                                        </code>
                                    </div>

                                    <hr className="border-t border-border" />

                                    <div className="flex justify-between items-center font-semibold">
                                        <span className="text-sm">Final Rate:</span>
                                        <code className="text-sm bg-primary/10 px-2 py-1 rounded">
                                            {formatEnergyRate(breakdown.finalEnergyRateFormatted, energyTokenMetadata)}
                                        </code>
                                    </div>
                                </div>
                            </Card>

                            {/* Key Metrics */}
                            <Card className="p-6">
                                <h4 className="font-semibold mb-4 flex items-center gap-2">
                                    <Target className="h-4 w-4" />
                                    Key Metrics
                                </h4>
                                
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm">Time to Fill Capacity</span>
                                            <Badge variant="outline">
                                                {formatTime(breakdown.timeToFillCapacity)}
                                            </Badge>
                                        </div>
                                        <Progress 
                                            value={breakdown.timeToFillCapacity === Infinity ? 0 : Math.min(100, (3600 / breakdown.timeToFillCapacity) * 100)} 
                                            className="h-2"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm">Efficiency (Energy/Hour)</span>
                                            <Badge variant="secondary">
                                                {formatNumber(breakdown.efficiencyRatio)}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm">Energy per Minute</span>
                                            <Badge variant="outline">
                                                {formatNumber(breakdown.finalEnergyRateFormatted * 60)}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm">Energy per Day</span>
                                            <Badge variant="outline">
                                                {formatNumber(breakdown.finalEnergyRateFormatted * 86400)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Real-time Simulation */}
                    <TabsContent value="simulation" className="space-y-4">
                        <Card className="p-6">
                            <h4 className="font-semibold mb-4 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Energy Accumulation Over Time
                            </h4>

                            {simulation.length > 0 && (
                                <div className="space-y-4">
                                    {/* Current Progress */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm">Final Energy Level</span>
                                            <Badge variant={simulation[simulation.length - 1].isCapped ? "destructive" : "secondary"}>
                                                {formatNumber(simulation[simulation.length - 1].energyFormatted)} / {formatNumber(parseFloat(customCapacity))}
                                            </Badge>
                                        </div>
                                        <Progress 
                                            value={(simulation[simulation.length - 1].energyFormatted / parseFloat(customCapacity)) * 100}
                                            className="h-3"
                                        />
                                    </div>

                                    {/* Sample Points */}
                                    <div className="space-y-2">
                                        <h5 className="text-sm font-medium">Sample Points:</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                                            {simulation.filter((_, i) => i % Math.max(1, Math.floor(simulation.length / 12)) === 0).map((point, index) => (
                                                <div key={index} className="flex justify-between p-2 bg-muted/50 rounded">
                                                    <span>{formatTime(point.time)}</span>
                                                    <span className={point.isCapped ? 'text-orange-600' : ''}>
                                                        {formatNumber(point.energyFormatted, 4)}
                                                        {point.isCapped && ' (capped)'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* Balance Impact Analysis */}
                    <TabsContent value="impact" className="space-y-4">
                        <Card className="p-6">
                            <h4 className="font-semibold mb-4 flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                Balance Impact Analysis
                            </h4>

                            {balanceImpact.length > 0 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                                        {balanceImpact.filter((_, i) => i % Math.max(1, Math.floor(balanceImpact.length / 8)) === 0).map((point, index) => (
                                            <div key={index} className="p-3 bg-muted/30 rounded-lg">
                                                <div className="font-medium mb-1">
                                                    {formatNumber(point.balanceFormatted)} {selectedTokenMetadata?.symbol}
                                                </div>
                                                <div className="space-y-1">
                                                    <div>Rate: {formatNumber(point.energyRateFormatted, 6)}/s</div>
                                                    <div>Fill Time: {formatTime(point.timeToFill)}</div>
                                                    <div>Efficiency: {formatNumber(point.efficiency)}/h</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* Smart Contract Constants */}
                    <TabsContent value="constants" className="space-y-4">
                        <Card className="p-6">
                            <h4 className="font-semibold mb-4 flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                Smart Contract Constants
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h5 className="text-sm font-medium mb-3">Energy System</h5>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Default Incentive Score:</span>
                                            <code className="bg-muted px-2 py-1 rounded">
                                                {ENERGY_CONSTANTS.DEFAULT_INCENTIVE_SCORE.toLocaleString()}
                                            </code>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Default Capacity:</span>
                                            <code className="bg-muted px-2 py-1 rounded">
                                                {ENERGY_CONSTANTS.DEFAULT_CAPACITY}
                                            </code>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h5 className="text-sm font-medium mb-3">Blockchain Timing</h5>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Seconds per Block:</span>
                                            <code className="bg-muted px-2 py-1 rounded">
                                                {ENERGY_CONSTANTS.SECONDS_PER_BLOCK}
                                            </code>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Minutes per Block:</span>
                                            <code className="bg-muted px-2 py-1 rounded">
                                                {ENERGY_CONSTANTS.MINUTES_PER_BLOCK}
                                            </code>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Blocks per Year:</span>
                                            <code className="bg-muted px-2 py-1 rounded">
                                                {ENERGY_CONSTANTS.BLOCKS_PER_YEAR.toLocaleString()}
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                                <h5 className="text-sm font-medium mb-2">Estimation Method</h5>
                                <div className="text-xs space-y-2">
                                    <p>This calculator uses <strong>historic energy generation data</strong> to estimate rates, not exact smart contract sampling.</p>
                                    <div className="font-mono space-y-1">
                                        <div>historic_rate_per_second = energy_per_block ÷ 600 seconds</div>
                                        <div>user_energy_rate = user_balance × historic_rate_per_second</div>
                                        <div>time_to_capacity = capacity ÷ user_energy_rate</div>
                                    </div>
                                    <p className="text-muted-foreground">This provides a general estimation for planning purposes.</p>
                                </div>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}

            {isCalculating && (
                <div className="flex items-center justify-center p-8">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span>Calculating...</span>
                    </div>
                </div>
            )}
        </div>
    );
}