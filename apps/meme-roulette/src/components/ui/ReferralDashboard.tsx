'use client';

import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Share2, Trophy, Wallet, Twitter } from 'lucide-react';
import { useWallet } from '@/contexts/wallet-context';
import { Skeleton } from '@/components/ui/skeleton';

interface ReferralCode {
    code: string;
    userId: string;
    isActive: boolean;
    createdAt: number;
    totalUses: number;
    maxUses?: number;
    expiresAt?: number;
}

interface ReferralStats {
    userId: string;
    totalReferrals: number;
    activeReferrals: number;
    totalCommissions: number;
    totalClicks: number;
    conversionRate: number;
    referralCodes: ReferralCode[];
    referrals: any[];
    referredBy?: any;
}

export function ReferralDashboard() {
    const { connected, address, connectWallet } = useWallet();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [referralCode, setReferralCode] = useState('');
    const [useCodeInput, setUseCodeInput] = useState('');

    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        if (connected && address) {
            loadUserStats();
        }
    }, [connected, address]);

    const loadStats = async () => {
        setLoading(true);
        try {
            // Don't try to authenticate on page load - just show empty stats
            // Users can authenticate when they want to create/use codes
            setStats({
                userId: '',
                totalReferrals: 0,
                activeReferrals: 0,
                totalCommissions: 0,
                totalClicks: 0,
                conversionRate: 0,
                referralCodes: [],
                referrals: []
            });
        } catch (error) {
            console.error('Error loading referral stats:', error);
            // Initialize empty stats on error
            setStats({
                userId: '',
                totalReferrals: 0,
                activeReferrals: 0,
                totalCommissions: 0,
                totalClicks: 0,
                conversionRate: 0,
                referralCodes: [],
                referrals: []
            });
        } finally {
            setLoading(false);
        }
    };

    const loadUserStats = async () => {
        if (!connected || !address) {
            return false;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/referrals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'stats',
                    userId: address
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setStats(result.data);
                    if (result.data.referralCodes.length > 0) {
                        setReferralCode(result.data.referralCodes[0].code);
                    }
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error loading user stats:', error);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const createReferralCode = async () => {
        if (!connected || !address) {
            toast.error('Please connect your wallet first');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/referrals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'create_code',
                    userId: address
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setReferralCode(result.data.code);
                    toast.success('Referral code created successfully!');
                    await loadUserStats(); // Reload user stats
                } else {
                    toast.error(`Failed to create referral code: ${result.error}`);
                }
            } else {
                toast.error('Failed to create referral code');
            }
        } catch (error) {
            console.error('Error creating referral code:', error);
            toast.error('Error creating referral code');
        } finally {
            setLoading(false);
        }
    };

    const useReferralCode = async () => {
        if (!useCodeInput.trim()) {
            toast.error('Please enter a referral code');
            return;
        }

        if (!connected || !address) {
            toast.error('Please connect your wallet first');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/referrals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'use_code',
                    code: useCodeInput.trim(),
                    userId: address
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    toast.success('Referral code used successfully!');
                    setUseCodeInput('');
                    await loadUserStats(); // Reload user stats
                } else {
                    toast.error(`Failed to use referral code: ${result.error}`);
                }
            } else {
                toast.error('Failed to use referral code');
            }
        } catch (error) {
            console.error('Error using referral code:', error);
            toast.error('Error using referral code');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied to clipboard!');
        } catch (error) {
            toast.error('Failed to copy to clipboard');
        }
    };

    const copyReferralLink = () => {
        const referralLink = `${window.location.origin}?ref=${referralCode}`;
        copyToClipboard(referralLink);
    };

    const shareToTwitter = () => {
        const referralLink = `${window.location.origin}?ref=${referralCode}`;
        const tweetText = `🎰 Join me on Meme Roulette and try your luck! Use my referral code: ${referralCode}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(referralLink)}`;
        window.open(twitterUrl, '_blank');
    };

    return (
        <div className="space-y-6">
            {loading ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Referral Dashboard
                        </CardTitle>
                        <CardDescription>
                            Invite friends and track your referrals
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="p-4 border rounded-lg text-center">
                                    <Skeleton className="h-8 w-16 mx-auto mb-2" />
                                    <Skeleton className="h-4 w-20 mx-auto" />
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-40 mb-2" />
                                <Skeleton className="h-10 w-full mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-40 mb-2" />
                                <Skeleton className="h-10 w-full mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Referral Dashboard
                        </CardTitle>
                        <CardDescription>
                            Invite friends and track your referrals
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <div className="p-4 border rounded-lg text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {stats?.totalReferrals || 0}
                                </div>
                                <div className="text-sm text-muted-foreground">Total Referrals</div>
                            </div>
                            <div className="p-4 border rounded-lg text-center">
                                <div className="text-2xl font-bold text-green-600">
                                    {stats?.activeReferrals || 0}
                                </div>
                                <div className="text-sm text-muted-foreground">Active Referrals</div>
                            </div>
                            <div className="p-4 border rounded-lg text-center">
                                <div className="text-2xl font-bold text-orange-600">
                                    {stats?.totalClicks || 0}
                                </div>
                                <div className="text-sm text-muted-foreground">Link Clicks</div>
                            </div>
                            <div className="p-4 border rounded-lg text-center">
                                <div className="text-2xl font-bold text-emerald-600">
                                    {stats?.conversionRate ? `${stats.conversionRate.toFixed(1)}%` : '0%'}
                                </div>
                                <div className="text-sm text-muted-foreground">Conversion Rate</div>
                            </div>
                            <div className="p-4 border rounded-lg text-center">
                                <div className="text-2xl font-bold text-purple-600">
                                    {stats?.referralCodes?.length || 0}
                                </div>
                                <div className="text-sm text-muted-foreground">Referral Codes</div>
                            </div>
                        </div>

                        {stats?.referredBy && (
                            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                    <Trophy className="h-4 w-4" />
                                    <span className="text-sm font-medium">
                                        You were referred by: {stats.referredBy.referrerId.substring(0, 10)}...
                                    </span>
                                </div>
                            </div>
                        )}

                        {!connected ? (
                            <div className="text-center py-8">
                                <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Connect your wallet to create referral codes and track your referrals
                                </p>
                                <Button onClick={connectWallet} className="mx-auto">
                                    <Wallet className="h-4 w-4 mr-2" />
                                    Connect Wallet
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Your Referral Code</h3>
                                    {referralCode ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={referralCode}
                                                    readOnly
                                                    className="font-mono text-center text-lg"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => copyToClipboard(referralCode)}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <Button
                                                    onClick={copyReferralLink}
                                                    className="w-full"
                                                    variant="outline"
                                                >
                                                    <Share2 className="h-4 w-4 mr-2" />
                                                    Copy Link
                                                </Button>
                                                <Button
                                                    onClick={shareToTwitter}
                                                    className="w-full"
                                                    variant="outline"
                                                >
                                                    <Twitter className="h-4 w-4 mr-2" />
                                                    Share on X
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Share this code or link with friends to get credit when they join!
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-sm text-muted-foreground">
                                                You don't have a referral code yet.
                                            </p>
                                            <Button
                                                onClick={createReferralCode}
                                                disabled={loading}
                                                className="w-full"
                                            >
                                                Create Referral Code
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {!stats?.referredBy && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold">Use a Referral Code</h3>
                                        <div className="space-y-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="referralCode">Enter referral code</Label>
                                                <Input
                                                    id="referralCode"
                                                    placeholder="Enter code here..."
                                                    value={useCodeInput}
                                                    onChange={(e) => setUseCodeInput(e.target.value)}
                                                    className="font-mono"
                                                />
                                            </div>
                                            <Button
                                                onClick={useReferralCode}
                                                disabled={loading || !useCodeInput.trim()}
                                                className="w-full"
                                            >
                                                Use Referral Code
                                            </Button>
                                            <p className="text-xs text-muted-foreground">
                                                Got a referral code from a friend? Enter it here!
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {stats && stats.referrals.length > 0 && (
                            <div className="mt-6 space-y-4">
                                <h3 className="text-lg font-semibold">Your Referrals</h3>
                                <div className="space-y-2">
                                    {stats.referrals.slice(0, 5).map((referral, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="text-sm font-mono">
                                                    {referral.refereeId.substring(0, 12)}...
                                                </div>
                                                <Badge variant={referral.isActive ? 'default' : 'secondary'}>
                                                    {referral.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(referral.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))}
                                    {stats.referrals.length > 5 && (
                                        <p className="text-sm text-muted-foreground text-center">
                                            And {stats.referrals.length - 5} more...
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>
            )}
        </div>
    );
} 