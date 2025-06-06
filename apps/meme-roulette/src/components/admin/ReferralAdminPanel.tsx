'use client';

import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import {
    getReferralConfig,
    getReferralSystemStats,
    getAllReferrals,
    getReferralStats
} from '@/lib/admin-api';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SystemStats {
    totalReferrals: number;
    activeReferrals: number;
    totalReferralCodes: number;
    activeReferralCodes: number;
    topReferrers: Array<{ userId: string; referrals: number; commissions: number }>;
}

interface FunnelUser {
    userId: string;
    totalClicks: number;
    totalReferrals: number;
    conversionRate: number;
}

export function ReferralAdminPanel() {
    const [loading, setLoading] = useState(false);
    const [systemStats, setSystemStats] = useState<SystemStats | null>({
        totalReferrals: 0,
        activeReferrals: 0,
        totalReferralCodes: 0,
        activeReferralCodes: 0,
        topReferrers: []
    });
    const [cronStatus, setCronStatus] = useState<any>(null);
    const [funnelData, setFunnelData] = useState<FunnelUser[]>([]);
    const [funnelLoading, setFunnelLoading] = useState(false);
    const [funnelSearch, setFunnelSearch] = useState('');

    useEffect(() => {
        loadData();
        loadFunnelData();
        // Check cron status every 30 seconds
        const interval = setInterval(loadCronStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // For now, just show default stats since the KV functions might not be working
            setSystemStats({
                totalReferrals: 0,
                activeReferrals: 0,
                totalReferralCodes: 0,
                activeReferralCodes: 0,
                topReferrers: []
            });
            await loadCronStatus();
        } catch (error) {
            console.error('Failed to load referral data:', error);
            toast.error(`Failed to load referral data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const loadCronStatus = async () => {
        try {
            const response = await fetch('/api/admin/cron-status');
            if (response.ok) {
                const result = await response.json();
                setCronStatus(result.data);
            }
        } catch (error) {
            console.error('Failed to load cron status:', error);
        }
    };

    const loadFunnelData = async () => {
        setFunnelLoading(true);
        try {
            // Get all referrals to find all referrers
            const allReferralsRes = await getAllReferrals(10000, 0);
            const allReferrals = allReferralsRes?.data || [];
            // Get all unique referrerIds
            const userIds = Array.from(
                new Set(
                    allReferrals
                        .filter((r: any) => typeof r.referrerId === 'string')
                        .map((r: any) => r.referrerId)
                )
            );
            // Fetch stats for each user
            const statsList: FunnelUser[] = [];
            for (const userIdRaw of userIds) {
                const userId = typeof userIdRaw === 'string' ? userIdRaw : String(userIdRaw);
                try {
                    const statsRes = await getReferralStats(userId);
                    const stats = statsRes?.data || statsRes;
                    statsList.push({
                        userId,
                        totalClicks: stats.totalClicks || 0,
                        totalReferrals: stats.totalReferrals || 0,
                        conversionRate: stats.conversionRate || 0,
                    });
                } catch (e) {
                    // Ignore errors for individual users
                }
            }
            setFunnelData(statsList.sort((a, b) => b.totalReferrals - a.totalReferrals));
        } catch (e) {
            toast.error('Failed to load referral funnel data');
        } finally {
            setFunnelLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8">
                    <p className="text-center text-muted-foreground">Loading referral system...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Referral System</CardTitle>
                    <CardDescription>Manage the referral system configuration and monitor performance</CardDescription>
                </CardHeader>
                <CardContent>
                    {systemStats ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-4 border rounded-lg">
                                <div className="text-2xl font-bold">{systemStats.totalReferrals}</div>
                                <div className="text-sm text-muted-foreground">Total Referrals</div>
                            </div>
                            <div className="p-4 border rounded-lg">
                                <div className="text-2xl font-bold">{systemStats.activeReferrals}</div>
                                <div className="text-sm text-muted-foreground">Active Referrals</div>
                            </div>
                            <div className="p-4 border rounded-lg">
                                <div className="text-2xl font-bold">{systemStats.totalReferralCodes}</div>
                                <div className="text-sm text-muted-foreground">Total Codes</div>
                            </div>
                            <div className="p-4 border rounded-lg">
                                <div className="text-2xl font-bold">{systemStats.activeReferralCodes}</div>
                                <div className="text-sm text-muted-foreground">Active Codes</div>
                            </div>
                            <div className="p-4 border rounded-lg">
                                <div className="text-2xl font-bold">
                                    {cronStatus ? (
                                        <span className={
                                            cronStatus.status === 'completed' ? 'text-green-600' :
                                                cronStatus.status === 'running' ? 'text-blue-600' :
                                                    cronStatus.status === 'error' ? 'text-red-600' :
                                                        cronStatus.status === 'Stale' ? 'text-orange-600' :
                                                            'text-gray-600'
                                        }>
                                            {cronStatus.status.toUpperCase()}
                                        </span>
                                    ) : 'LOADING...'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Achievement Processor
                                </div>
                                {cronStatus && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {cronStatus.lastRun && (
                                            <div>Last: {new Date(cronStatus.lastRun).toLocaleTimeString()}</div>
                                        )}
                                        {cronStatus.details?.totalAwardsGiven > 0 && (
                                            <div>Awards: {cronStatus.details.totalAwardsGiven}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Loading statistics...</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={loadData} disabled={loading}>
                        Refresh Data
                    </Button>
                </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Referral Funnel</CardTitle>
                    <CardDescription>
                        Per-user breakdown: how many clicks, credited referrals, and conversion rate for each referrer.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex items-center gap-2">
                        <Input
                            placeholder="Search by user ID..."
                            value={funnelSearch}
                            onChange={e => setFunnelSearch(e.target.value)}
                            className="max-w-xs"
                        />
                        <Button onClick={loadFunnelData} disabled={funnelLoading} size="sm">
                            Refresh
                        </Button>
                    </div>
                    {funnelLoading ? (
                        <div className="text-center text-muted-foreground py-8">Loading funnel data...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead className="text-right">Total Clicks</TableHead>
                                        <TableHead className="text-right">Total Referrals</TableHead>
                                        <TableHead className="text-right">Conversion Rate</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {funnelData.filter(u => !funnelSearch || String(u.userId).includes(String(funnelSearch))).map(user => (
                                        <TableRow key={user.userId}>
                                            <TableCell className="font-mono text-xs">{user.userId}</TableCell>
                                            <TableCell className="text-right">{user.totalClicks}</TableCell>
                                            <TableCell className="text-right">{user.totalReferrals}</TableCell>
                                            <TableCell className="text-right">{user.conversionRate.toFixed(1)}%</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {funnelData.length === 0 && (
                                <div className="text-center text-muted-foreground py-8">No referral funnel data found.</div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
