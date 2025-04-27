'use client';

import React from 'react';

interface BetProgressProps {
    current: number; // Current total CHA bet
    target: number; // Example target goal (optional)
}

const BetProgress = ({ current, target }: BetProgressProps) => {
    const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;

    return (
        <div className="progress-bar" title={`Total Bet: ${current.toLocaleString()} CHA`}>
            <div
                className="progress-bar-fill relative group"
                style={{ width: target > 0 ? `${percentage}%` : '100%' }}
                role="progressbar"
                aria-valuenow={target > 0 ? percentage : current}
                aria-valuemin={0}
                aria-valuemax={target > 0 ? 100 : undefined}
                aria-label="Tokens Allocated for Buy In Progress"
            >
                <div className="absolute top-0 right-0 h-full w-1 bg-white/30 animate-pulse-medium"></div>
                <div className="h-full w-full overflow-hidden relative">
                    <div className="absolute inset-0 w-[200%] animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>0 CHA</span>
                <span className="numeric">{target.toLocaleString()} CHA</span>
            </div>
        </div>
    );
};

export default BetProgress;
