'use client';

import React from 'react';

interface SpinCountdownProps {
    timeLeft: number; // Milliseconds until spin
    totalTime: number; // Milliseconds for the full duration of the round
    label?: string; // Optional custom label
}

const SpinCountdown = ({ timeLeft, totalTime, label = "Time until next round" }: SpinCountdownProps) => {
    // Display time values
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    // Calculate percentage of time ELAPSED for the circular progress
    // The bar will now fill up as time progresses.
    const timeElapsed = totalTime - timeLeft;
    const percentageElapsed = totalTime > 0 ? (timeElapsed / totalTime) * 100 : 0;

    // strokeDashoffset should be calculated based on elapsed percentage
    // A full bar is offset 0, an empty bar is offset 264 (circumference)
    const circumference = 264; // This value is based on r=42 (2 * PI * r) and strokeDasharray
    const strokeDashoffset = circumference - (circumference * percentageElapsed) / 100;

    // Determine color based on time left (or percentage elapsed - adjust if needed)
    // This logic might need to be inverted if colors are meant to change as bar fills
    const getProgressColor = () => {
        if (percentageElapsed > 80) return 'text-secondary'; // e.g., red when nearing end
        if (percentageElapsed > 50) return 'text-warning'; // e.g., orange in middle
        return 'text-primary'; // e.g., green at the start
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
                        className={getProgressColor()}
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
                        opacity: percentageElapsed / 200 + 0.1
                    }}
                />

                {/* Time display */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div
                        className={`font-mono text-3xl font-bold numeric ${getProgressColor()}`}
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
