'use client';

import { useState, useEffect } from 'react';
import { EnergySimulation } from './EnergySimulation';
import { getTokenMetadataCached, type TokenCacheData } from '@repo/tokens';

interface CalculationResult {
    tokenAmount: number;
    energyPerSecond: number;
    energyPerHour: number;
    energyPerDay: number;
    estimatedAPY: number;
    timeToMaxCapacity: number;
}

export default function EnergyAPYCalculator() {
    const [tokenAmount, setTokenAmount] = useState<string>('1000');
    const [calculation, setCalculation] = useState<CalculationResult | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [tokenMetadata, setTokenMetadata] = useState<TokenCacheData | null>(null);
    const [energyMetadata, setEnergyMetadata] = useState<TokenCacheData | null>(null);

    // Required token contract ID based on vault configuration
    const requiredTokenId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1';

    // Load token metadata
    useEffect(() => {
        const loadTokenMetadata = async () => {
            try {
                const [tokenMeta, energyMeta] = await Promise.all([
                    getTokenMetadataCached(requiredTokenId),
                    getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy') // Energy token
                ]);
                setTokenMetadata(tokenMeta);
                setEnergyMetadata(energyMeta);
            } catch (error) {
                console.error('Failed to load token metadata:', error);
            }
        };
        loadTokenMetadata();
    }, []);

    // Calculate energy rates when inputs change
    useEffect(() => {
        if (tokenAmount && tokenMetadata) {
            calculateEnergyRates();
        }
    }, [tokenAmount, tokenMetadata]);

    const calculateEnergyRates = async () => {
        if (!tokenAmount || !tokenMetadata) return;

        setIsCalculating(true);
        try {
            const amount = parseFloat(tokenAmount);
            if (isNaN(amount) || amount <= 0) {
                setCalculation(null);
                return;
            }

            // Convert to raw token units
            const decimals = tokenMetadata.decimals || 6;
            const rawAmount = amount * Math.pow(10, decimals);

            // Mock calculation based on energize vault mechanics
            // In real implementation, this would call the energize contract quote function
            const baseEnergyRate = 0.001; // Energy per token per second (mock)
            const energyPerSecond = rawAmount * baseEnergyRate;
            const energyPerHour = energyPerSecond * 3600;
            const energyPerDay = energyPerHour * 24;

            // Calculate APY (simplified estimation)
            // APY = (Energy per year / Token value) * 100
            const energyPerYear = energyPerDay * 365;
            const estimatedAPY = (energyPerYear / amount) * 0.1; // Mock multiplier

            // Time to reach max capacity (100 energy default)
            const maxCapacity = 100 * Math.pow(10, energyMetadata?.decimals || 6);
            const timeToMaxCapacity = energyPerSecond > 0 ? maxCapacity / energyPerSecond : 0;

            setCalculation({
                tokenAmount: amount,
                energyPerSecond,
                energyPerHour,
                energyPerDay,
                estimatedAPY,
                timeToMaxCapacity
            });
        } catch (error) {
            console.error('Calculation failed:', error);
            setCalculation(null);
        } finally {
            setIsCalculating(false);
        }
    };

    const formatEnergy = (value: number): string => {
        if (!energyMetadata) return value.toLocaleString();
        
        const decimals = energyMetadata.decimals || 6;
        const divisor = Math.pow(10, decimals);
        const adjustedValue = value / divisor;
        
        return adjustedValue.toLocaleString(undefined, {
            maximumFractionDigits: 6,
            minimumFractionDigits: 0
        });
    };

    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
        return `${Math.round(seconds / 86400)}d`;
    };

    return (
        <div className="space-y-6">


            {/* Real-time Energy Tracker */}
            <EnergySimulation />
        </div>
    );
}