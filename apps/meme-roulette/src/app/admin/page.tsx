'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    getSystemStatus,
    getUserVotes,
    getRoundDuration,
    getLockDuration,
    resetSpin,
    setWinner,
    setSpinTime,
    updateTokenBet
} from '@/lib/admin-api';
import { RoundDurationControl } from '@/components/admin/RoundDurationControl';
import { LockDurationControl } from '@/components/admin/LockDurationControl';
import { BalanceValidationPanel } from '@/components/admin/BalanceValidationPanel';
import { GameStateVisualization } from '@/components/admin/GameStateVisualization';
import { CurrentTokenBetsTable } from '@/components/admin/CurrentTokenBetsTable';
import { UserVotesTable } from '@/components/admin/UserVotesTable';
import { AchievementAdminPanel } from '@/components/admin/AchievementAdminPanel';
import { ReferralAdminPanel } from '@/components/admin/ReferralAdminPanel';

export default function AdminPage() {
    const router = useRouter();
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [winnerTokenId, setWinnerTokenId] = useState('');
    const [spinTimeMinutes, setSpinTimeMinutes] = useState(5);
    const [newBetTokenId, setNewBetTokenId] = useState('');
    const [newBetAmount, setNewBetAmount] = useState(100);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        async function fetchStatus() {
            setLoading(true);
            const [statusData, userVotesData, roundDurationData, lockDurationData] = await Promise.all([
                getSystemStatus(),
                getUserVotes(),
                getRoundDuration(),
                getLockDuration()
            ]);

            setStatus({
                ...statusData,
                userVotes: userVotesData,
                roundDuration: roundDurationData,
                lockDuration: lockDurationData
            });
            setLoading(false);
        }
        fetchStatus();
    }, [refreshKey]);

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const handleReset = async () => {
        setLoading(true);
        const result = await resetSpin();
        if (result.error) {
            toast.error(`Failed to reset: ${result.error}`);
        } else {
            toast.success('Spin reset successfully');
            handleRefresh();
        }
        setLoading(false);
    };

    const handleSetWinner = async () => {
        if (!winnerTokenId) {
            toast.error('Please enter a token ID');
            return;
        }
        setLoading(true);
        const result = await setWinner(winnerTokenId);
        if (result.error) {
            toast.error(`Failed to set winner: ${result.error}`);
        } else {
            toast.success(`Winner set to: ${winnerTokenId}`);
            handleRefresh();
        }
        setLoading(false);
    };

    const handleSetSpinTime = async () => {
        const minutesFromNow = spinTimeMinutes;
        const timestamp = Date.now() + (minutesFromNow * 60 * 1000);
        setLoading(true);
        const result = await setSpinTime(timestamp);
        if (result.error) {
            toast.error(`Failed to set spin time: ${result.error}`);
        } else {
            toast.success(`Spin time set to ${new Date(timestamp).toLocaleString()}`);
            handleRefresh();
        }
        setLoading(false);
    };

    const handleExtendSpinOneHour = async () => {
        const current = status?.spinStatus?.spinScheduledAt;
        if (!current) {
            toast.error('No spin scheduled to extend');
            return;
        }
        const newTime = current + 60 * 60 * 1000;
        setLoading(true);
        const result = await setSpinTime(newTime);
        if (result.error) {
            toast.error(`Failed to extend spin: ${result.error}`);
        } else {
            toast.success(`Spin pushed to ${new Date(newTime).toLocaleString()}`);
            handleRefresh();
        }
        setLoading(false);
    };

    const handleUpdateBet = async () => {
        if (!newBetTokenId) {
            toast.error('Please enter a token ID');
            return;
        }
        setLoading(true);
        const result = await updateTokenBet(newBetTokenId, newBetAmount);
        if (result.error) {
            toast.error(`Failed to update bet: ${result.error}`);
        } else {
            toast.success(`Bet updated for ${newBetTokenId}: ${newBetAmount} CHA`);
            handleRefresh();
        }
        setLoading(false);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    const calculateTimeLeft = (endTime: number) => {
        const now = Date.now();
        const diff = endTime - now;
        if (diff <= 0) return 'Spin completed';
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    return (
        <div className="container mx-auto px-4 py-4 md:py-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Meme Roulette Admin</h1>
                    <p className="text-sm text-muted-foreground mt-1 sm:hidden">Administrative controls and monitoring</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleRefresh} variant="outline" size="sm" className="w-full sm:w-auto">
                        Refresh
                    </Button>
                    <Button onClick={() => router.push('/')} variant="outline" size="sm" className="w-full sm:w-auto">
                        To Main App
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="status" className="w-full">
                <div className="mb-4 overflow-x-auto">
                    <TabsList className="inline-flex w-auto min-w-full">
                        <TabsTrigger value="status" className="text-xs sm:text-sm">Status</TabsTrigger>
                        <TabsTrigger value="controls" className="text-xs sm:text-sm">Controls</TabsTrigger>
                        <TabsTrigger value="validation" className="text-xs sm:text-sm">Validation</TabsTrigger>
                        <TabsTrigger value="bets" className="text-xs sm:text-sm">Bets</TabsTrigger>
                        <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
                        <TabsTrigger value="achievements" className="text-xs sm:text-sm">Achievements</TabsTrigger>
                        <TabsTrigger value="referrals" className="text-xs sm:text-sm">Referrals</TabsTrigger>
                        <TabsTrigger value="raw" className="text-xs sm:text-sm">Raw Data</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="status">
                    <div className="space-y-6">
                        {loading ? (
                            <Card>
                                <CardContent className="p-8">
                                    <p className="text-center text-muted-foreground">Loading status...</p>
                                </CardContent>
                            </Card>
                        ) : status?.error ? (
                            <Card>
                                <CardContent className="p-8">
                                    <p className="text-center text-destructive">Error: {status.error}</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <GameStateVisualization status={status} />

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Quick Overview</CardTitle>
                                        <CardDescription>Summary of key system metrics</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="border p-4 rounded-md">
                                                <h3 className="font-semibold mb-2">Spin Status</h3>
                                                <p><span className="font-medium">Spin end time:</span> {formatDate(status?.spinStatus?.spinScheduledAt)}</p>
                                                <p><span className="font-medium">Time left:</span> {calculateTimeLeft(status?.spinStatus?.spinScheduledAt)}</p>
                                                <p><span className="font-medium">Winning token:</span> {status?.spinStatus?.winningTokenId || 'Not determined'}</p>
                                            </div>

                                            <div className="border p-4 rounded-md">
                                                <h3 className="font-semibold mb-2">Token Stats</h3>
                                                <p><span className="font-medium">Total tokens:</span> {status?.tokens?.length}</p>
                                                <p><span className="font-medium">Tokens with bets:</span> {Object.keys(status?.tokenBets || {}).length}</p>
                                                <p><span className="font-medium">Total bet amount:</span> {Object.values(status?.tokenBets || {}).reduce((sum: number, val: any) => sum + Number(val), 0)} CHA</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="controls">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <RoundDurationControl status={status} onRefresh={handleRefresh} />
                        <LockDurationControl status={status} onRefresh={handleRefresh} />

                        <Card>
                            <CardHeader>
                                <CardTitle>Reset Spin</CardTitle>
                                <CardDescription>Clear bets and start a new spin</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-amber-500 mb-4">Warning: This will clear all current bets and set a new spin time.</p>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleReset} disabled={loading} variant="destructive">
                                    Reset Spin
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Force Winner</CardTitle>
                                <CardDescription>Manually set a winning token</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid w-full items-center gap-1.5">
                                        <Label htmlFor="winnerTokenId">Token ID</Label>
                                        <Input
                                            id="winnerTokenId"
                                            value={winnerTokenId}
                                            onChange={(e) => setWinnerTokenId(e.target.value)}
                                            placeholder="Enter token ID"
                                        />
                                    </div>

                                    {status?.tokens && (
                                        <div className="grid w-full items-center gap-1.5">
                                            <Label htmlFor="tokenSelect">Or select from available tokens</Label>
                                            <Select onValueChange={(value) => setWinnerTokenId(value)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select token" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {status.tokens.map((token: any) => (
                                                        <SelectItem key={token.contractId} value={token.contractId}>
                                                            {token.symbol} - {token.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSetWinner} disabled={loading}>
                                    Set Winner
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Set Spin Time</CardTitle>
                                <CardDescription>Adjust when the spin will happen</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid w-full items-center gap-1.5">
                                        <Label htmlFor="spinTimeMinutes">Minutes from now</Label>
                                        <Input
                                            id="spinTimeMinutes"
                                            type="number"
                                            value={spinTimeMinutes}
                                            onChange={(e) => setSpinTimeMinutes(parseInt(e.target.value) || 5)}
                                            min="1"
                                        />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Spin will be scheduled for: {new Date(Date.now() + (spinTimeMinutes * 60 * 1000)).toLocaleString()}
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSetSpinTime} disabled={loading}>
                                    Set Spin Time
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Extend Spin Time</CardTitle>
                                <CardDescription>Extend the current round by 1 hour.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Current spin end time: {status?.spinStatus?.spinScheduledAt ? formatDate(status.spinStatus.spinScheduledAt) : 'N/A'}
                                </p>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleExtendSpinOneHour} disabled={loading || !status?.spinStatus?.spinScheduledAt}>
                                    Extend by 1 Hour
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="validation">
                    <BalanceValidationPanel status={status} />
                </TabsContent>

                <TabsContent value="bets">
                    <div className="space-y-6">
                        <CurrentTokenBetsTable status={status} />

                        <Card>
                            <CardHeader>
                                <CardTitle>Manage Token Bets</CardTitle>
                                <CardDescription>Add or modify token bets manually (for testing)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="border p-4 rounded-md">
                                        <h3 className="font-semibold mb-4">Add/Update Bet</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="newBetTokenId">Token ID</Label>
                                                <Input
                                                    id="newBetTokenId"
                                                    value={newBetTokenId}
                                                    onChange={(e) => setNewBetTokenId(e.target.value)}
                                                    placeholder="Enter token ID"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="newBetAmount">Bet Amount (CHA)</Label>
                                                <Input
                                                    id="newBetAmount"
                                                    type="number"
                                                    value={newBetAmount}
                                                    onChange={(e) => setNewBetAmount(parseInt(e.target.value) || 0)}
                                                    min="0"
                                                />
                                                <Button onClick={handleUpdateBet} disabled={loading} className="mt-4 w-full">
                                                    Update Bet
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="users">
                    <UserVotesTable status={status} />
                </TabsContent>

                <TabsContent value="achievements">
                    <AchievementAdminPanel />
                </TabsContent>

                <TabsContent value="referrals">
                    <ReferralAdminPanel />
                </TabsContent>

                <TabsContent value="raw">
                    <Card>
                        <CardHeader>
                            <CardTitle>Raw Data</CardTitle>
                            <CardDescription>Raw system data for debugging</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <pre className="p-4 bg-muted rounded-md overflow-auto max-h-[600px]">
                                {loading ? 'Loading...' : JSON.stringify(status, null, 2)}
                            </pre>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleRefresh} variant="outline">
                                Refresh Data
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
} 