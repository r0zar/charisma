import { kv } from '@vercel/kv';
import { EnergyAnalyticsData } from './analytics';
import { getUserEnergyStatsV2 } from './analytics-v2';
import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV } from '@stacks/transactions';

const ENERGY_CONTRACT_ID = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';

export interface RealTimeEnergyData {
    currentEnergyBalance: number;
    accumulatedSinceLastHarvest: number; // Deprecated - use engineAccumulations instead
    engineAccumulations: Record<string, number>; // Per-engine untapped energy by contract ID
    totalHarvestableEnergy: number;
    energyRatePerSecond: number;
    lastHarvestTimestamp: number;
    timeSinceLastHarvest: number;
    maxCapacity: number;
    capacityPercentage: number;
    capacityStatus: 'safe' | 'warning' | 'critical' | 'overflow';
    lastUpdated: number;
    dataQuality: 'excellent' | 'good' | 'limited' | 'insufficient';
    // Additional metadata for UI
    isHarvestNeeded: boolean;
    energyWasteRate: number; // Energy being wasted per second if at overflow
    timeToCapacity: number; // Seconds until capacity is full
}

/**
 * Calculate comprehensive real-time energy status for a user
 */
export async function calculateRealTimeEnergyStatus(userAddress: string): Promise<RealTimeEnergyData> {
    const now = Date.now();
    
    try {
        // Get analytics data from KV cache
        const analyticsKey = `energy:analytics:${ENERGY_CONTRACT_ID}`;
        const analyticsData = await kv.get<EnergyAnalyticsData>(analyticsKey);
        
        if (!analyticsData || !analyticsData.logs) {
            throw new Error('No analytics data available');
        }

        // Get user's V2 analytics with corrected rate calculations
        const userStatsV2 = getUserEnergyStatsV2(analyticsData.logs, userAddress);
        
        if (!userStatsV2) {
            throw new Error('No user statistics available');
        }

        // Get user's current energy balance from blockchain
        let currentEnergyBalance = 0;
        try {
            const energyBalance = await callReadOnlyFunction(
                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
                'energy',
                'get-balance',
                [principalCV(userAddress)]
            );
            // Handle both direct numbers and Clarity response objects
            if (typeof energyBalance === 'object' && energyBalance !== null && 'value' in energyBalance) {
                currentEnergyBalance = Number(energyBalance.value) || 0;
            } else {
                currentEnergyBalance = Number(energyBalance) || 0;
            }
        } catch (error) {
            console.warn('Failed to get current energy balance, using 0:', error);
        }

        // Get user's max capacity from power-cells contract
        let maxCapacity = 100000000; // Default 100 energy in micro-units
        try {
            const capacity = await callReadOnlyFunction(
                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
                'power-cells',
                'get-max-capacity',
                [principalCV(userAddress)]
            );
            // Handle both direct numbers and Clarity response objects
            if (typeof capacity === 'object' && capacity !== null && 'value' in capacity) {
                maxCapacity = Number(capacity.value) || maxCapacity;
            } else {
                maxCapacity = Number(capacity) || maxCapacity;
            }
        } catch (error) {
            console.warn('Failed to get max capacity, using default:', error);
        }

        // Calculate accumulated energy since last harvest
        const lastHarvestTimestamp = userStatsV2.historical.lastHarvestTimestamp;
        const timeSinceLastHarvest = Math.max(0, (now - lastHarvestTimestamp) / 1000); // seconds
        const energyRatePerSecond = userStatsV2.currentRate.energyPerSecond;
        const accumulatedSinceLastHarvest = timeSinceLastHarvest * energyRatePerSecond;

        // Calculate total harvestable energy (capped by capacity)
        const totalHarvestableEnergy = Math.min(
            currentEnergyBalance + accumulatedSinceLastHarvest,
            maxCapacity
        );

        // Calculate capacity status
        const capacityPercentage = (totalHarvestableEnergy / maxCapacity) * 100;
        let capacityStatus: 'safe' | 'warning' | 'critical' | 'overflow';
        
        if (capacityPercentage >= 100) {
            capacityStatus = 'overflow';
        } else if (capacityPercentage >= 85) {
            capacityStatus = 'critical';
        } else if (capacityPercentage >= 60) {
            capacityStatus = 'warning';
        } else {
            capacityStatus = 'safe';
        }

        // Calculate additional metadata
        const isHarvestNeeded = capacityPercentage >= 85; // Recommend harvest at 85%+
        const energyWasteRate = capacityStatus === 'overflow' ? energyRatePerSecond : 0;
        const timeToCapacity = energyRatePerSecond > 0 
            ? Math.max(0, (maxCapacity - totalHarvestableEnergy) / energyRatePerSecond)
            : Infinity;

        return {
            currentEnergyBalance,
            accumulatedSinceLastHarvest,
            totalHarvestableEnergy,
            energyRatePerSecond,
            lastHarvestTimestamp,
            timeSinceLastHarvest,
            maxCapacity,
            capacityPercentage,
            capacityStatus,
            lastUpdated: now,
            dataQuality: userStatsV2.dataQuality,
            isHarvestNeeded,
            energyWasteRate,
            timeToCapacity
        };

    } catch (error) {
        console.error('Error calculating real-time energy status:', error);
        
        // Return safe fallback data
        return {
            currentEnergyBalance: 0,
            accumulatedSinceLastHarvest: 0,
            totalHarvestableEnergy: 0,
            energyRatePerSecond: 0,
            lastHarvestTimestamp: now,
            timeSinceLastHarvest: 0,
            maxCapacity: 100000000,
            capacityPercentage: 0,
            capacityStatus: 'safe',
            lastUpdated: now,
            dataQuality: 'insufficient',
            isHarvestNeeded: false,
            energyWasteRate: 0,
            timeToCapacity: Infinity
        };
    }
}

/**
 * Format energy values for display
 */
export function formatEnergyValue(rawValue: number, decimals = 6): string {
    const divisor = Math.pow(10, decimals);
    const adjustedValue = rawValue / divisor;

    return adjustedValue.toLocaleString(undefined, {
        maximumFractionDigits: 6,
        minimumFractionDigits: 0
    });
}

/**
 * Format time duration for display
 */
export function formatTimeDuration(seconds: number): string {
    if (seconds === Infinity || seconds < 0) return 'Never';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
}

/**
 * Get capacity zone styling information
 */
export function getCapacityZoneStyles(zone: string) {
    switch (zone) {
        case 'overflow':
            return {
                progressColor: 'bg-red-500',
                glowColor: 'rgba(239, 68, 68, 0.4)',
                borderColor: 'border-red-500/50',
                animation: 'animate-pulse',
                textColor: 'text-red-400'
            };
        case 'critical':
            return {
                progressColor: 'bg-red-400',
                glowColor: 'rgba(248, 113, 113, 0.3)',
                borderColor: 'border-red-400/40',
                animation: 'animate-pulse',
                textColor: 'text-red-300'
            };
        case 'warning':
            return {
                progressColor: 'bg-yellow-400',
                glowColor: 'rgba(251, 191, 36, 0.3)',
                borderColor: 'border-yellow-400/40',
                animation: 'animate-bounce',
                textColor: 'text-yellow-300'
            };
        default:
            return {
                progressColor: 'bg-gradient-to-r from-primary to-primary/80',
                glowColor: 'hsl(var(--primary) / 0.2)',
                borderColor: 'border-primary/30',
                animation: '',
                textColor: 'text-primary'
            };
    }
}