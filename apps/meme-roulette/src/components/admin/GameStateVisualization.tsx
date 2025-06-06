import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Timer, TrendingUp, Users } from 'lucide-react';

interface GameStateVisualizationProps {
    status: any;
}

export function GameStateVisualization({ status }: GameStateVisualizationProps) {
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    const getTimeRemaining = () => {
        if (!status?.spinStatus?.spinScheduledAt) return 'N/A';

        const now = Date.now();
        const endTime = status.spinStatus.spinScheduledAt;
        const diff = endTime - now;

        if (diff <= 0) return 'ENDED';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        return `${minutes}m ${seconds}s`;
    };

    const formatCHA = (atomicAmount: number) => {
        const decimalAmount = atomicAmount / 1_000_000;
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6
        }).format(decimalAmount);
    };

    const getTotalBets = () => {
        if (!status?.tokenBets) return 0;
        return Object.values(status.tokenBets).reduce((sum: number, val: any) => sum + Number(val), 0);
    };

    const getActiveTokenCount = () => {
        if (!status?.tokenBets) return 0;
        return Object.keys(status.tokenBets).filter(tokenId => status.tokenBets[tokenId] > 0).length;
    };

    const getUserCount = () => {
        if (!status?.userVotes?.votes) return 0;
        return Object.keys(status.userVotes.votes).length;
    };

    const getGamePhase = () => {
        if (!status?.spinStatus?.spinScheduledAt) return 'unknown';

        const now = Date.now();
        const endTime = status.spinStatus.spinScheduledAt;
        const timeLeft = endTime - now;

        if (status?.spinStatus?.winningTokenId) return 'complete';
        if (timeLeft <= 0) return 'spinning';
        if (timeLeft <= (status?.lockDuration?.duration || 300000)) return 'locked';
        return 'voting';
    };

    const getPhaseDisplay = () => {
        const phase = getGamePhase();
        switch (phase) {
            case 'voting':
                return { label: '🗳️ Voting Open', color: 'text-success', bg: 'bg-success/10' };
            case 'locked':
                return { label: '🔒 Voting Locked', color: 'text-warning', bg: 'bg-warning/10' };
            case 'spinning':
                return { label: '🎰 Spinning', color: 'text-primary', bg: 'bg-primary/10' };
            case 'complete':
                return { label: '✅ Complete', color: 'text-muted-foreground', bg: 'bg-muted/10' };
            default:
                return { label: '❓ Unknown', color: 'text-muted-foreground', bg: 'bg-muted/10' };
        }
    };

    const phaseDisplay = getPhaseDisplay();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Game State Visualization
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Current Phase */}
                    <div className={`border border-border rounded-lg p-4 ${phaseDisplay.bg}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">Current Phase</h3>
                                <p className={`text-lg font-bold ${phaseDisplay.color}`}>
                                    {phaseDisplay.label}
                                </p>
                            </div>
                            <Timer className={`h-8 w-8 ${phaseDisplay.color}`} />
                        </div>
                    </div>

                    {/* Timing Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-border p-4 rounded-lg bg-card">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Time Remaining
                            </h4>
                            <p className="text-2xl font-mono numeric font-bold text-primary">
                                {getTimeRemaining()}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Until spin execution
                            </p>
                        </div>

                        <div className="border border-border p-4 rounded-lg bg-card">
                            <h4 className="font-semibold mb-2">Spin End Time</h4>
                            <p className="text-sm font-mono">
                                {status?.spinStatus?.spinScheduledAt
                                    ? formatTime(status.spinStatus.spinScheduledAt)
                                    : 'Not scheduled'
                                }
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Scheduled completion
                            </p>
                        </div>
                    </div>

                    {/* Round Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-border p-4 rounded-lg bg-card text-center">
                            <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
                            <h4 className="font-semibold mb-1">Total CHA</h4>
                            <p className="text-xl font-bold numeric text-primary">
                                {formatCHA(getTotalBets())}
                            </p>
                            <p className="text-xs text-muted-foreground">committed this round</p>
                        </div>

                        <div className="border border-border p-4 rounded-lg bg-card text-center">
                            <Users className="h-6 w-6 text-secondary mx-auto mb-2" />
                            <h4 className="font-semibold mb-1">Active Users</h4>
                            <p className="text-xl font-bold text-secondary">
                                {getUserCount()}
                            </p>
                            <p className="text-xs text-muted-foreground">have placed votes</p>
                        </div>

                        <div className="border border-border p-4 rounded-lg bg-card text-center">
                            <TrendingUp className="h-6 w-6 text-accent mx-auto mb-2" />
                            <h4 className="font-semibold mb-1">Active Tokens</h4>
                            <p className="text-xl font-bold text-accent">
                                {getActiveTokenCount()}
                            </p>
                            <p className="text-xs text-muted-foreground">have received votes</p>
                        </div>
                    </div>

                    {/* Duration Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-border p-4 rounded-lg bg-card">
                            <h4 className="font-semibold mb-2">Round Duration</h4>
                            <p className="text-lg font-bold text-primary">
                                {status?.roundDuration?.duration
                                    ? `${Math.round(status.roundDuration.duration / 60000)} minutes`
                                    : 'Not set'
                                }
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Length of each voting round
                            </p>
                        </div>

                        <div className="border border-border p-4 rounded-lg bg-card">
                            <h4 className="font-semibold mb-2">Lock Duration</h4>
                            <p className="text-lg font-bold text-warning">
                                {status?.lockDuration?.duration
                                    ? `${Math.round(status.lockDuration.duration / 60000)} minutes`
                                    : 'Not set'
                                }
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Time before spin when voting locks
                            </p>
                        </div>
                    </div>

                    {/* Winner Information */}
                    {status?.spinStatus?.winningTokenId && (
                        <div className="border border-success/20 bg-success/5 p-4 rounded-lg">
                            <h4 className="font-semibold mb-2 text-success flex items-center gap-2">
                                🏆 Round Winner
                            </h4>
                            <p className="text-lg font-bold">
                                {status.spinStatus.winningTokenId}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                This token was selected for the group pump
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
} 