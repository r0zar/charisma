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
    getReferralSystemStats
} from '@/lib/admin-api';

interface SystemStats {
    totalReferrals: number;
    activeReferrals: number;
    totalCommissions: number;
    totalReferralCodes: number;
    activeReferralCodes: number;
    topReferrers: Array<{ userId: string; referrals: number; commissions: number }>;
}

export function ReferralAdminPanel() {
    const [loading, setLoading] = useState(false);
    const [systemStats, setSystemStats] = useState<SystemStats | null>({
        totalReferrals: 0,
        activeReferrals: 0,
        totalCommissions: 0,
        totalReferralCodes: 0,
        activeReferralCodes: 0,
        topReferrers: []
    });
    const [cronStatus, setCronStatus] = useState<any>(null);

    useEffect(() => {
        loadData();
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
                totalCommissions: 0,
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
                                <div className="text-2xl font-bold">{systemStats.totalCommissions.toFixed(2)}</div>
                                <div className="text-sm text-muted-foreground">Total Commissions (CHA)</div>
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
        </div>
    );
}
