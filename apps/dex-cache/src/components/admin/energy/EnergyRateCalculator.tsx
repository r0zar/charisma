'use client';

import { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { EnergyRateBreakdown } from '../EnergyRateBreakdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EnergyWalletActions } from './EnergyWalletActions';
import { EnergizeVaultHeader } from './EnergizeVaultHeader';
import type { TokenCacheData } from '@repo/tokens';

interface RateCalculatorData {
    tokenRates: Array<{
        contractId: string;
        tokenSymbol: string;
        tokenName: string;
        energyPerBlock: number;
    }>;
    rateHistories: Array<{
        contractId: string;
        tokenSymbol: string;
        tokenName: string;
    }>;
    energyTokenMetadata: TokenCacheData | null;
}

export default function EnergyRateCalculator() {
    const [data, setData] = useState<RateCalculatorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchCalculatorData();
    }, []);

    const fetchCalculatorData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch('/api/v1/admin/energy-rate-analytics?timeframe=30d');
            if (!response.ok) {
                throw new Error('Failed to fetch calculator data');
            }
            
            const calculatorData = await response.json();
            setData(calculatorData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Energy Rate Calculator
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Energy Rate Calculator
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6">
            {/* Vault Header */}
            <EnergizeVaultHeader />
            
            {/* Rate Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Energy Rate Calculator & Simulation  
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <EnergyRateBreakdown 
                        tokenData={data.rateHistories.map(history => ({
                            type: "token",
                            contractId: history.contractId,
                            name: history.tokenName,
                            symbol: history.tokenSymbol,
                            decimals: 6, // Default, can be refined with actual metadata
                            total_supply: "1000000000000", // Default, can be refined
                            image: "",
                            description: "",
                            identifier: history.contractId
                        }))}
                        energyTokenMetadata={data.energyTokenMetadata || undefined}
                        historicRates={Object.fromEntries(
                            data.tokenRates.map(rate => [
                                rate.contractId,
                                rate.energyPerBlock / 600 // Convert per-block to per-second (10 min blocks)
                            ])
                        )}
                    />
                </CardContent>
            </Card>
            
            {/* Wallet-Aware Contract Interaction */}
            <EnergyWalletActions />
        </div>
    );
}