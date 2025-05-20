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
import { signedFetch } from '@repo/stacks';

// Admin actions
export async function getSystemStatus() {
    try {
        const res = await fetch('/api/admin/status', {
            method: 'GET',
            cache: 'no-store'
        });
        if (!res.ok) throw new Error('Failed to fetch status');
        return res.json();
    } catch (error) {
        console.error('Error fetching status:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function resetSpin() {
    try {
        const res = await signedFetch('/api/admin/reset', {
            method: 'POST',
            message: 'Reset spin',
            body: JSON.stringify({})
        });
        if (!res.ok) throw new Error('Failed to reset spin');
        return res.json();
    } catch (error) {
        console.error('Error resetting spin:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function setWinner(tokenId: string) {
    try {
        const res = await signedFetch('/api/admin/winner', {
            method: 'POST',
            message: 'Set winner',
            body: JSON.stringify({ tokenId })
        });
        if (!res.ok) throw new Error('Failed to set winner');
        return res.json();
    } catch (error) {
        console.error('Error setting winner:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function setSpinTime(timestamp: number) {
    try {
        const res = await signedFetch('/api/admin/spin-time', {
            method: 'POST',
            message: 'Set spin time',
            body: JSON.stringify({ timestamp })
        });
        if (!res.ok) throw new Error('Failed to set spin time');
        return res.json();
    } catch (error) {
        console.error('Error setting spin time:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function updateTokenBet(tokenId: string, amount: number) {
    try {
        const res = await signedFetch('/api/admin/token-bet', {
            method: 'POST',
            message: 'Set token bet',
            body: JSON.stringify({ tokenId, amount })
        });
        if (!res.ok) throw new Error('Failed to update token bet');
        return res.json();
    } catch (error) {
        console.error('Error updating token bet:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function getUserVotes(userId?: string) {
    try {
        const url = userId
            ? `/api/admin/user-votes?userId=${encodeURIComponent(userId)}`
            : '/api/admin/user-votes';

        const res = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch user votes');
        return res.json();
    } catch (error) {
        console.error('Error fetching user votes:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function getRoundDuration() {
    try {
        const res = await fetch('/api/admin/round-duration', { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch round duration');
        return res.json();
    } catch (error) {
        console.error('Error fetching round duration:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function setRoundDuration(durationMinutes: number) {
    try {
        const res = await signedFetch('/api/admin/round-duration', {
            method: 'POST',
            message: 'Set round duration',
            body: JSON.stringify({ durationMinutes })
        });
        if (!res.ok) throw new Error('Failed to update round duration');
        return res.json();
    } catch (error) {
        console.error('Error updating round duration:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function getLockDuration() {
    try {
        const res = await fetch('/api/admin/lock-duration', { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch lock duration');
        return res.json();
    } catch (error) {
        console.error('Error fetching lock duration:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function setLockDuration(durationMinutes: number) {
    try {
        const res = await signedFetch('/api/admin/lock-duration', {
            method: 'POST',
            message: 'Set lock duration',
            body: JSON.stringify({ durationMinutes })
        });
        if (!res.ok) throw new Error('Failed to update lock duration');
        return res.json();
    } catch (error) {
        console.error('Error updating lock duration:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

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
        const newTime = current + 60 * 60 * 1000;            // +1 hour
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

    const RoundDurationControl = () => {
        const [durationMinutes, setDurationMinutes] = useState(5);
        const [isUpdating, setIsUpdating] = useState(false);

        const handleUpdateDuration = async () => {
            setIsUpdating(true);
            try {
                const result = await setRoundDuration(durationMinutes);
                if (result.error) {
                    toast.error(`Failed to update duration: ${result.error}`);
                } else {
                    toast.success(`Round duration set to ${durationMinutes} minute(s)`);
                    handleRefresh();
                }
            } catch (error) {
                toast.error('Failed to update round duration');
            } finally {
                setIsUpdating(false);
            }
        };

        useEffect(() => {
            if (status?.roundDuration) {
                setDurationMinutes(Math.round(status.roundDuration.duration / 60000));
            }
        }, [status?.roundDuration]);

        return (
            <Card>
                <CardHeader>
                    <CardTitle>Round Duration</CardTitle>
                    <CardDescription>Set how long each round should last</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <Label htmlFor="roundDuration">Duration (minutes)</Label>
                            <Input
                                id="roundDuration"
                                type="number"
                                value={durationMinutes}
                                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 1)}
                                min="1"
                            />
                        </div>
                        <Button
                            onClick={handleUpdateDuration}
                            disabled={isUpdating}
                            className="mb-0.5"
                        >
                            Update
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    const LockDurationControl = () => {
        const [durationMinutes, setDurationMinutes] = useState(5);
        const [isUpdating, setIsUpdating] = useState(false);

        const handleUpdateDuration = async () => {
            setIsUpdating(true);
            try {
                const result = await setLockDuration(durationMinutes);
                if (result.error) {
                    toast.error(`Failed to update lock duration: ${result.error}`);
                } else {
                    toast.success(`Lock duration set to ${durationMinutes} minute(s)`);
                    handleRefresh();
                }
            } catch (error) {
                toast.error('Failed to update lock duration');
            } finally {
                setIsUpdating(false);
            }
        };

        useEffect(() => {
            if (status?.lockDuration) {
                setDurationMinutes(Math.round(status.lockDuration.duration / 60000));
            }
        }, [status?.lockDuration]);

        return (
            <Card>
                <CardHeader>
                    <CardTitle>Lock Duration</CardTitle>
                    <CardDescription>Set how long betting should be locked before spin</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <Label htmlFor="lockDuration">Duration (minutes)</Label>
                            <Input
                                id="lockDuration"
                                type="number"
                                value={durationMinutes}
                                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0.5)}
                                min="0.5"
                                step="0.5"
                            />
                        </div>
                        <Button
                            onClick={handleUpdateDuration}
                            disabled={isUpdating}
                            className="mb-0.5"
                        >
                            Update
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    const GameStateVisualization = () => {
        if (!status?.spinStatus) return null;

        // Update timer every second
        const [currentTime, setCurrentTime] = useState(Date.now());

        useEffect(() => {
            const timer = setInterval(() => {
                setCurrentTime(Date.now());
            }, 1000);

            return () => clearInterval(timer);
        }, []);

        const { spinScheduledAt, roundDuration } = status.spinStatus;
        const startTime = spinScheduledAt - roundDuration;
        const totalDuration = roundDuration;
        const elapsed = Math.max(0, currentTime - startTime);
        const progress = Math.min(100, (elapsed / totalDuration) * 100);

        const isCompleted = currentTime >= spinScheduledAt;
        const hasWinner = !!status.spinStatus.winningTokenId;

        // Format time labels
        const formatTime = (timestamp: number) => {
            return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        // Calculate time remaining in minutes and seconds
        const getTimeRemaining = () => {
            if (isCompleted) return hasWinner ? 'Round Complete' : 'Selecting Winner...';
            const remaining = spinScheduledAt - currentTime;
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            return `${minutes}m ${seconds}s remaining`;
        };

        return (
            <Card>
                <CardHeader>
                    <CardTitle>Round Progress</CardTitle>
                    <CardDescription>Current game state and timeline</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-5">
                        <div>
                            <div className="mb-2 font-medium">Current Status: {
                                hasWinner ? 'Complete' : isCompleted ? 'Selecting Winner' : 'In Progress'
                            }</div>

                            <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${hasWinner ? 'bg-green-500' : isCompleted ? 'bg-amber-500 animate-pulse' : 'bg-primary'}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            <div className="flex justify-between text-sm text-muted-foreground mt-1">
                                <span>Start: {formatTime(startTime)}</span>
                                <span>{getTimeRemaining()}</span>
                                <span>End: {formatTime(spinScheduledAt)}</span>
                            </div>
                        </div>

                        <div className="border p-4 rounded-md space-y-2">
                            <div className="flex justify-between">
                                <span className="font-medium">Round Duration:</span>
                                <span>{Math.round(roundDuration / 60000)} minutes</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Current Time:</span>
                                <span>{new Date(currentTime).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Start Time:</span>
                                <span>{new Date(startTime).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">End Time:</span>
                                <span>{new Date(spinScheduledAt).toLocaleString()}</span>
                            </div>
                            {hasWinner && (
                                <div className="flex justify-between">
                                    <span className="font-medium">Winning Token:</span>
                                    <span className="font-semibold text-success">{
                                        status.tokens?.find((t: any) => t.contractId === status.spinStatus.winningTokenId)?.symbol ||
                                        status.spinStatus.winningTokenId
                                    }</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Meme Roulette Admin</h1>
                <div className="space-x-2">
                    <Button onClick={handleRefresh} variant="outline">Refresh</Button>
                    <Button onClick={() => router.push('/')} variant="outline">To Main App</Button>
                </div>
            </div>

            <Tabs defaultValue="status" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="status">Status</TabsTrigger>
                    <TabsTrigger value="controls">Controls</TabsTrigger>
                    <TabsTrigger value="bets">Bets</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="raw">Raw Data</TabsTrigger>
                </TabsList>

                <TabsContent value="status">
                    <div className="space-y-6">
                        <GameStateVisualization />

                        <Card>
                            <CardHeader>
                                <CardTitle>System Status</CardTitle>
                                <CardDescription>Current state of the meme roulette system</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <p>Loading status...</p>
                                ) : status?.error ? (
                                    <p className="text-red-500">Error: {status.error}</p>
                                ) : (
                                    <div className="space-y-4">
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
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="controls">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <RoundDurationControl />
                        <LockDurationControl />

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
                                                        <SelectItem key={token.contractId} value={token.contractId} className="flex items-center gap-2">
                                                            {token.image && (
                                                                <img
                                                                    src={token.image}
                                                                    alt={token.symbol}
                                                                    className="w-6 h-6 rounded-full object-cover mr-2"
                                                                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-token.png'; }}
                                                                />
                                                            )}
                                                            <span>{token.symbol} - {token.name}</span>
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

                <TabsContent value="bets">
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage Token Bets</CardTitle>
                            <CardDescription>View and modify token bets</CardDescription>
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

                                            {status?.tokens && (
                                                <div className="mt-2">
                                                    <Label htmlFor="betTokenSelect">Or select token</Label>
                                                    <Select onValueChange={(value) => setNewBetTokenId(value)}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select token" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {status.tokens.map((token: any) => (
                                                                <SelectItem key={token.contractId} value={token.contractId} className="flex items-center gap-2">
                                                                    {token.image && (
                                                                        <img
                                                                            src={token.image}
                                                                            alt={token.symbol}
                                                                            className="w-6 h-6 rounded-full object-cover mr-2"
                                                                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-token.png'; }}
                                                                        />
                                                                    )}
                                                                    <span>{token.symbol} - {token.name}</span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
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

                                <div className="border p-4 rounded-md">
                                    <h3 className="font-semibold mb-4">Current Bets</h3>
                                    {loading ? (
                                        <p>Loading bets...</p>
                                    ) : !status?.tokenBets || Object.keys(status.tokenBets).length === 0 ? (
                                        <p>No bets found</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-muted">
                                                        <th className="p-2 text-left">Token</th>
                                                        <th className="p-2 text-right">Amount (CHA)</th>
                                                        <th className="p-2 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(status.tokenBets).map(([tokenId, amount]: [string, any]) => {
                                                        const token = status.tokens?.find((t: any) => t.contractId === tokenId);
                                                        return (
                                                            <tr key={tokenId} className="border-b border-muted hover:bg-muted/50">
                                                                <td className="p-2">
                                                                    {token ? (
                                                                        <div className="flex items-center">
                                                                            {token.image && (
                                                                                <img
                                                                                    src={token.image}
                                                                                    alt={token.symbol}
                                                                                    className="w-6 h-6 rounded-full object-cover mr-2"
                                                                                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-token.png'; }}
                                                                                />
                                                                            )}
                                                                            <span className="font-semibold">{token.symbol}</span>
                                                                            <span className="ml-2 text-muted-foreground">({token.name})</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span>{tokenId}</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-2 text-right">{amount}</td>
                                                                <td className="p-2 text-right">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            setNewBetTokenId(tokenId);
                                                                            setNewBetAmount(amount);
                                                                        }}
                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        className="ml-2"
                                                                        onClick={async () => {
                                                                            await updateTokenBet(tokenId, 0);
                                                                            handleRefresh();
                                                                        }}
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="users">
                    <Card>
                        <CardHeader>
                            <CardTitle>User Vote Tracking</CardTitle>
                            <CardDescription>View votes by user</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <p>Loading user data...</p>
                            ) : (
                                <div className="space-y-6">
                                    <div className="border p-4 rounded-md">
                                        <h3 className="font-semibold mb-2">User Vote Stats</h3>
                                        <p><span className="font-medium">Total users:</span> {status?.userVotes?.stats?.userCount || 0}</p>
                                        <p><span className="font-medium">Total votes:</span> {status?.userVotes?.stats?.totalVotes || 0}</p>
                                    </div>

                                    {status?.userVotes?.votes && Object.keys(status.userVotes.votes).length > 0 ? (
                                        <div className="space-y-4">
                                            {Object.entries(status.userVotes.votes).map(([userId, votes]: [string, any]) => {
                                                const userVotes = Array.isArray(votes) ? votes : [];
                                                return (
                                                    <div key={userId} className="border p-4 rounded-md">
                                                        <h3 className="font-semibold mb-2 flex justify-between">
                                                            <span>User: {userId}</span>
                                                            <span className="text-muted-foreground">{userVotes.length} votes</span>
                                                        </h3>

                                                        <div className="overflow-x-auto">
                                                            <table className="w-full border-collapse">
                                                                <thead>
                                                                    <tr className="bg-muted text-sm">
                                                                        <th className="p-2 text-left">Token</th>
                                                                        <th className="p-2 text-right">Amount</th>
                                                                        <th className="p-2 text-right">Time</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {userVotes.map((vote: any) => {
                                                                        const token = status.tokens?.find((t: any) => t.contractId === vote.tokenId);
                                                                        return (
                                                                            <tr key={vote.id} className="border-b border-muted hover:bg-muted/50">
                                                                                <td className="p-2">
                                                                                    <div className="flex items-center">
                                                                                        {token?.image && (
                                                                                            <img
                                                                                                src={token.image}
                                                                                                alt={token.symbol}
                                                                                                className="w-5 h-5 rounded-full object-cover mr-2"
                                                                                                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-token.png'; }}
                                                                                            />
                                                                                        )}
                                                                                        <span>{token ? token.symbol : vote.tokenId}</span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="p-2 text-right">{vote.voteAmountCHA} CHA</td>
                                                                                <td className="p-2 text-right text-xs text-muted-foreground">
                                                                                    {new Date(vote.voteTime).toLocaleString()}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 text-muted-foreground">
                                            No user votes have been recorded yet
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
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