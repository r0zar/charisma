'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { Trophy, TrendingUp, Target, Zap, Crown, Star } from 'lucide-react';

interface BetProgressProps {
    current: number; // Current total CHA bet (in atomic units)
    athAmount?: number; // All-Time High amount (in atomic units) 
    previousRoundAmount?: number; // Previous round amount for comparison
    decimals?: number; // Token decimals for formatting
}

const BetProgress = ({
    current,
    athAmount = 0, // Start from 0 for new systems
    previousRoundAmount = 0,
    decimals = 6
}: BetProgressProps) => {
    const [showCelebration, setShowCelebration] = useState(false);
    const [newRecord, setNewRecord] = useState(false);

    // Handle edge case where ATH is 0 (new system)
    const effectiveATH = athAmount > 0 ? athAmount : Math.max(current, 2000 * (10 ** decimals)); // Use 2K CHA as realistic first target if no ATH exists
    const isNewSystem = athAmount === 0;
    const isEmptyRound = current === 0 && isNewSystem;

    // Format amounts for display
    const formatAmount = (amount: number) => {
        const wholeAmount = amount / (10 ** decimals);
        if (wholeAmount >= 1000000) {
            return `${(wholeAmount / 1000000).toFixed(1)}M`;
        } else if (wholeAmount >= 1000) {
            return `${(wholeAmount / 1000).toFixed(1)}K`;
        }
        return wholeAmount.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    };

    // Calculate progress and milestones
    const {
        athProgress,
        previousProgress,
        target,
        isNewRecord,
        milestone,
        urgencyLevel
    } = useMemo(() => {
        // Use ATH + 20% as aspirational target, minimum of ATH
        const target = Math.max(effectiveATH, effectiveATH * 1.2);
        const athProgress = Math.min(100, (current / effectiveATH) * 100);
        const previousProgress = previousRoundAmount > 0 ? Math.min(100, (current / previousRoundAmount) * 100) : 0;
        const isNewRecord = current > effectiveATH;

        // Determine milestone
        let milestone = '';
        if (isEmptyRound) {
            milestone = 'Ready to Start!';
        } else if (isNewRecord) {
            milestone = isNewSystem ? 'FIRST RECORD!' : 'NEW RECORD!';
        } else if (athProgress >= 90) {
            milestone = isNewSystem ? 'Almost There!' : 'Record Breaking!';
        } else if (athProgress >= 75) {
            milestone = isNewSystem ? 'Making Progress!' : 'ATH Challenge!';
        } else if (previousProgress >= 100) {
            milestone = 'Beat Last Round!';
        } else if (athProgress >= 50) {
            milestone = isNewSystem ? 'Halfway!' : 'Halfway to ATH';
        } else if (athProgress > 0 && isNewSystem) {
            milestone = 'Getting Started!';
        }

        // Determine urgency for styling
        let urgencyLevel = 'normal';
        if (isNewRecord || athProgress >= 90) {
            urgencyLevel = 'record';
        } else if (athProgress >= 75) {
            urgencyLevel = 'challenge';
        } else if (athProgress >= 50) {
            urgencyLevel = 'progress';
        }

        return {
            athProgress,
            previousProgress,
            target,
            isNewRecord,
            milestone,
            urgencyLevel
        };
    }, [current, effectiveATH, previousRoundAmount, isEmptyRound, isNewSystem]);

    // Trigger celebration effect for new records
    useEffect(() => {
        if (isNewRecord && !newRecord) {
            setNewRecord(true);
            setShowCelebration(true);
            const timer = setTimeout(() => setShowCelebration(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isNewRecord, newRecord]);

    // Get styling based on progress
    const getProgressStyling = () => {
        switch (urgencyLevel) {
            case 'record':
                return {
                    barColor: 'from-yellow-400 via-yellow-500 to-yellow-600',
                    glowColor: 'rgba(252, 211, 77, 0.4)',
                    textColor: 'text-yellow-500',
                    bgColor: 'bg-yellow-500/10',
                    icon: Crown,
                    pulseClass: 'animate-pulse'
                };
            case 'challenge':
                return {
                    barColor: 'from-orange-400 via-orange-500 to-orange-600',
                    glowColor: 'rgba(251, 146, 60, 0.4)',
                    textColor: 'text-orange-500',
                    bgColor: 'bg-orange-500/10',
                    icon: Trophy,
                    pulseClass: 'animate-pulse-medium'
                };
            case 'progress':
                return {
                    barColor: 'from-blue-400 via-blue-500 to-blue-600',
                    glowColor: 'rgba(96, 165, 250, 0.4)',
                    textColor: 'text-blue-500',
                    bgColor: 'bg-blue-500/10',
                    icon: TrendingUp,
                    pulseClass: ''
                };
            default:
                return {
                    barColor: 'from-emerald-400 via-emerald-500 to-emerald-600',
                    glowColor: 'rgba(16, 185, 129, 0.4)',
                    textColor: 'text-primary',
                    bgColor: 'bg-primary/10',
                    icon: Target,
                    pulseClass: ''
                };
        }
    };

    const { barColor, glowColor, textColor, bgColor, icon: ProgressIcon, pulseClass } = getProgressStyling();

    return (
        <div className="space-y-4">
            {/* Milestone Badge */}
            {milestone && (
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${bgColor} ${textColor} ${pulseClass}`}>
                    <ProgressIcon className="h-3 w-3" />
                    {milestone}
                    {showCelebration && <Star className="h-3 w-3 animate-spin" />}
                </div>
            )}

            {/* Progress Bar Container */}
            <div className="relative">
                {/* Background bar */}
                <div className="w-full h-4 bg-muted/30 rounded-full overflow-hidden relative">
                    {/* Previous round marker (if applicable) */}
                    {previousRoundAmount > 0 && previousRoundAmount < effectiveATH && (
                        <div
                            className="absolute top-0 h-full w-0.5 bg-muted-foreground/40 z-10"
                            style={{ left: `${Math.min(100, (previousRoundAmount / effectiveATH) * 100)}%` }}
                            title={`Previous Round: ${formatAmount(previousRoundAmount)} CHA`}
                        />
                    )}

                    {/* ATH marker */}
                    <div
                        className="absolute top-0 h-full w-0.5 bg-yellow-500 z-10 opacity-80"
                        style={{ left: '100%' }}
                        title={`ATH: ${formatAmount(effectiveATH)} CHA`}
                    />

                    {/* Progress fill */}
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${barColor} relative overflow-hidden`}
                        style={{
                            width: `${Math.min(100, athProgress)}%`,
                            boxShadow: `0 0 20px ${glowColor}`
                        }}
                    >
                        {/* Animated shimmer */}
                        <div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                            style={{
                                animation: 'shimmer 2s infinite',
                                width: '100%'
                            }}
                        />

                        {/* Record breaking extension */}
                        {isNewRecord && (
                            <div
                                className="absolute top-0 left-full h-full bg-gradient-to-r from-yellow-400 to-yellow-600 animate-pulse"
                                style={{
                                    width: `${Math.min(20, (current - effectiveATH) / effectiveATH * 100)}%`,
                                    boxShadow: '0 0 25px rgba(252, 211, 77, 0.6)'
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Progress indicator */}
                <div
                    className={`absolute -top-1 h-6 flex items-center transition-all duration-1000 ease-out`}
                    style={{ left: `${Math.max(0, Math.min(95, athProgress))}%` }}
                >
                    <div className={`ml-2 text-xs font-mono font-bold ${textColor} whitespace-nowrap bg-background/80 px-2 py-1 rounded-md border`}>
                        {isEmptyRound ? 'Ready!' : `${Math.round(athProgress)}%`}
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                        Current: <span className={`font-mono font-bold ${textColor}`}>{formatAmount(current)} CHA</span>
                    </span>
                    {previousRoundAmount > 0 && (
                        <span className="text-muted-foreground">
                            vs Last: <span className={`font-mono ${previousProgress >= 100 ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {Math.round(previousProgress)}%
                            </span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    <span>ATH: <span className="font-mono font-bold">{formatAmount(effectiveATH)} CHA</span></span>
                </div>
            </div>

            {/* Record breaking celebration */}
            {showCelebration && (
                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-3 text-center animate-pulse">
                    <div className="flex items-center justify-center gap-2 text-yellow-500 font-bold">
                        <Crown className="h-5 w-5" />
                        <span>🎉 NEW ROUND RECORD! 🎉</span>
                        <Crown className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Congratulations! This round has set a new all-time high!
                    </p>
                </div>
            )}
        </div>
    );
};

export default BetProgress;
