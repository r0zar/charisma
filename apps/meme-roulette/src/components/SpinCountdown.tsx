'use client';

import React, { useMemo } from 'react';
import { Clock, Zap, AlertTriangle, Timer } from 'lucide-react';

interface SpinCountdownProps {
    timeLeft: number; // Milliseconds until spin
    totalTime: number; // Milliseconds for the full duration of the round
    label?: string; // Optional custom label
}

const SpinCountdown = ({ timeLeft, totalTime, label = "Time until next round" }: SpinCountdownProps) => {
    // Calculate progress (0 to 1) - this is elapsed time for the visual progress bar
    const elapsedProgress = totalTime > 0 ? Math.max(0, Math.min(1, (totalTime - timeLeft) / totalTime)) : 0;

    // Calculate remaining time percentage for display
    const remainingPercentage = totalTime > 0 ? Math.max(0, Math.round((timeLeft / totalTime) * 100)) : 0;

    // Convert time to more intuitive display with hours and days support
    const totalSeconds = Math.max(0, Math.floor(timeLeft / 1000));
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);

    const days = totalDays;
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;

    // Determine urgency level and styling
    const urgencyLevel = useMemo(() => {
        const percentageLeft = (timeLeft / totalTime) * 100;
        if (percentageLeft <= 20) return 'critical';
        if (percentageLeft <= 40) return 'warning';
        return 'normal';
    }, [timeLeft, totalTime]);

    // Get colors and styling based on urgency
    const getUrgencyStyles = () => {
        switch (urgencyLevel) {
            case 'critical':
                return {
                    progressColor: '#ef4444', // red-500
                    glowColor: 'rgba(239, 68, 68, 0.2)',
                    textColor: 'text-red-500',
                    bgColor: 'bg-red-500/5',
                    borderColor: 'border-red-500/20',
                    icon: AlertTriangle,
                    pulseClass: 'animate-pulse'
                };
            case 'warning':
                return {
                    progressColor: '#f59e0b', // amber-500
                    glowColor: 'rgba(245, 158, 11, 0.2)',
                    textColor: 'text-amber-500',
                    bgColor: 'bg-amber-500/5',
                    borderColor: 'border-amber-500/20',
                    icon: Clock,
                    pulseClass: 'animate-pulse-medium'
                };
            default:
                return {
                    progressColor: '#10b981', // emerald-500
                    glowColor: 'rgba(16, 185, 129, 0.2)',
                    textColor: 'text-primary',
                    bgColor: 'bg-primary/5',
                    borderColor: 'border-primary/20',
                    icon: Zap,
                    pulseClass: ''
                };
        }
    };

    const { progressColor, glowColor, textColor, bgColor, borderColor, icon: UrgencyIcon, pulseClass } = getUrgencyStyles();

    // Format display text based on time remaining with support for days and hours
    const getDisplayText = () => {
        if (totalSeconds <= 0) return { main: '00:00', sub: 'TIME UP!' };

        // Days + Hours
        if (totalDays > 0) {
            return {
                main: `${days}d ${hours}h`,
                sub: 'DAYS LEFT'
            };
        }

        // Hours + Minutes
        if (totalHours > 0) {
            return {
                main: `${hours}:${minutes.toString().padStart(2, '0')}`,
                sub: 'HOURS LEFT'
            };
        }

        // Minutes + Seconds
        if (totalMinutes > 0) {
            return {
                main: `${minutes}:${seconds.toString().padStart(2, '0')}`,
                sub: 'MINUTES LEFT'
            };
        }

        // Just seconds
        return {
            main: seconds.toString().padStart(2, '0'),
            sub: 'SECONDS LEFT'
        };
    };

    const { main: displayMain, sub: displaySub } = getDisplayText();

    // Get status message
    const getStatusMessage = () => {
        if (totalSeconds <= 0) return 'Voting has ended';
        if (urgencyLevel === 'critical') return 'Voting closes soon!';
        if (urgencyLevel === 'warning') return 'Get your votes in';
        return 'Open for Voting';
    };

    return (
        <div className={`w-full p-4 md:p-6 rounded-xl border transition-all duration-500 ${bgColor} ${borderColor} ${pulseClass}`}>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                {/* Time Display Section */}
                <div className="flex items-center gap-4 md:min-w-0 md:flex-shrink-0">
                    {/* Icon */}
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${bgColor} ${borderColor} border-2`}>
                        <UrgencyIcon className={`h-6 w-6 ${textColor}`} />
                    </div>

                    {/* Time */}
                    <div className="flex flex-col">
                        <div className={`font-mono text-3xl md:text-4xl font-bold ${textColor} leading-none`}>
                            {displayMain}
                        </div>
                        <div className={`text-xs font-medium ${textColor} opacity-80 mt-1 uppercase tracking-wider`}>
                            {displaySub}
                        </div>
                    </div>
                </div>

                {/* Progress Section */}
                <div className="flex-1 space-y-3">
                    {/* Progress Bar Container */}
                    <div className="space-y-2">
                        <div className="w-full h-3 bg-muted/30 rounded-full overflow-hidden relative">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out relative"
                                style={{
                                    width: `${elapsedProgress * 100}%`,
                                    background: `linear-gradient(90deg, ${progressColor}, ${progressColor}cc)`,
                                    boxShadow: `0 0 12px ${glowColor}`
                                }}
                            >
                                {/* Moving shimmer effect */}
                                <div
                                    className="absolute inset-0 rounded-full opacity-40"
                                    style={{
                                        background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)`,
                                        animation: 'shimmer 2s infinite'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Progress percentage - moved below progress bar */}
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground/70">Progress</span>
                            <span className={`font-mono font-bold ${textColor}`}>
                                {remainingPercentage}% remaining
                            </span>
                        </div>
                    </div>

                    {/* Status and Label */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-medium ${textColor} flex items-center gap-2`}>
                            <Timer className="h-4 w-4" />
                            {getStatusMessage()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Urgent Messages */}
            {urgencyLevel === 'critical' && totalSeconds > 0 && (
                <div className="mt-4 flex items-center gap-2 text-red-500 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 animate-bounce" />
                    <span>Final moments to place your votes!</span>
                </div>
            )}
        </div>
    );
};

export default SpinCountdown;
