'use client';

import React from 'react';

interface SpinCountdownProps {
    timeLeft: number; // Milliseconds until spin
    totalTime: number; // Milliseconds for the full duration (for potential visual)
    label?: string; // Optional custom label
}

const SpinCountdown = ({ timeLeft, totalTime, label = "Time until next round" }: SpinCountdownProps) => {
    // Display time values
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    // Calculate percentage for the circular progress
    const percentage = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    const strokeDashoffset = 264 - (264 * percentage) / 100;

    // Determine color based on time left
    const getTimeColor = () => {
        if (percentage < 20) return 'text-secondary';
        if (percentage < 50) return 'text-warning';
        return 'text-primary';
    };

    return (
        <div className="flex flex-col items-center justify-center">
            <div className="relative w-32 h-32">
                {/* Background ring */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="currentColor"
                        className="text-muted"
                        strokeWidth="8"
                    />

                    {/* Progress ring */}
                    <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="currentColor"
                        className={getTimeColor()}
                        strokeWidth="8"
                        strokeDasharray="264"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                    />
                </svg>

                {/* Inner blur glow */}
                <div
                    className="absolute inset-0 rounded-full opacity-20 blur-md"
                    style={{
                        background: `radial-gradient(circle, var(--color-primary) 0%, transparent 70%)`,
                        opacity: percentage / 200 + 0.1
                    }}
                />

                {/* Time display */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div
                        className={`font-mono text-3xl font-bold numeric ${getTimeColor()}`}
                        aria-live="polite"
                        aria-label={`Time left: ${minutes} minutes ${seconds} seconds`}
                    >
                        {minutes}:{seconds.toString().padStart(2, '0')}
                    </div>
                </div>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
                {label}
            </div>
        </div>
    );
};

export default SpinCountdown;
