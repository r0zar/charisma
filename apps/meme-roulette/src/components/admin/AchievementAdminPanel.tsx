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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/sonner';
import {
    Trophy,
    RefreshCw,
    Settings,
    Users,
    AlertTriangle,
    CheckCircle,
    Award,
    BarChart3,
    UserCheck,
    Trash2,
    Play,
    Download,
    Upload
} from 'lucide-react';

interface AchievementData {
    id: string;
    name: string;
    type: string;
    rarity: string;
    threshold?: number;
    awardedCount: number;
}

interface StatisticsData {
    totalAchievements: number;
    achievementsByType: Record<string, number>;
    achievementsByRarity: Record<string, number>;
    usersWithAchievements: number;
}

export const AchievementAdminPanel = () => {
    const [loading, setLoading] = useState(false);
    const [achievements, setAchievements] = useState<AchievementData[]>([]);
    const [statistics, setStatistics] = useState<StatisticsData | null>(null);
    const [validationResults, setValidationResults] = useState<any>(null);

    // Form states
    const [bulkAwardAchievementId, setBulkAwardAchievementId] = useState('');
    const [bulkAwardUserIds, setBulkAwardUserIds] = useState('');
    const [resetUserId, setResetUserId] = useState('');
    const [forceCheckUserId, setForceCheckUserId] = useState('');
    const [retroactiveUserLimit, setRetroactiveUserLimit] = useState(50);
    const [retroactiveDryRun, setRetroactiveDryRun] = useState(true);

    useEffect(() => {
        loadStatistics();
    }, []);

    const callAchievementAPI = async (action: string, params: any = {}) => {
        try {
            const response = await fetch('/api/admin/achievements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action, ...params }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Unknown error');
            }

            return result;
        } catch (error) {
            console.error(`[ADMIN] ${action} failed:`, error);
            throw error;
        }
    };

    const loadStatistics = async () => {
        try {
            setLoading(true);
            const result = await callAchievementAPI('get_statistics');
            setStatistics(result.data.statistics);
            setAchievements(result.data.achievements);
        } catch (error) {
            toast.error(`Failed to load statistics: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleInitialize = async () => {
        try {
            setLoading(true);
            const result = await callAchievementAPI('initialize');
            toast.success(result.message);
            await loadStatistics();
        } catch (error) {
            toast.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRetroactiveAwards = async () => {
        try {
            setLoading(true);
            const result = await callAchievementAPI('retroactive_awards', {
                userLimit: retroactiveUserLimit,
                dryRun: retroactiveDryRun
            });

            toast.success(result.message);

            if (result.data.userResults.length > 0) {
                const successCount = result.data.userResults.filter((r: any) => !r.error).length;
                const errorCount = result.data.userResults.filter((r: any) => r.error).length;

                toast.info(`Processed ${result.data.processedUsers} users. Awards: ${result.data.totalAwardsGiven}. Errors: ${errorCount}`);
            }

            await loadStatistics();
        } catch (error) {
            toast.error(`Retroactive awards failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkAward = async () => {
        try {
            if (!bulkAwardAchievementId || !bulkAwardUserIds.trim()) {
                toast.error('Please provide achievement ID and user IDs');
                return;
            }

            setLoading(true);
            const userIds = bulkAwardUserIds.split('\n').map(id => id.trim()).filter(id => id);

            const result = await callAchievementAPI('bulk_award', {
                achievementId: bulkAwardAchievementId,
                userIds
            });

            toast.success(result.message);
            toast.info(`Success: ${result.data.results.successCount}, Already had: ${result.data.results.alreadyHadCount}, Errors: ${result.data.results.errorCount}`);

            setBulkAwardUserIds('');
            await loadStatistics();
        } catch (error) {
            toast.error(`Bulk award failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleResetUser = async () => {
        try {
            if (!resetUserId.trim()) {
                toast.error('Please provide a user ID');
                return;
            }

            setLoading(true);
            const result = await callAchievementAPI('reset_user_achievements', {
                userId: resetUserId.trim()
            });

            toast.success(result.message);
            setResetUserId('');
            await loadStatistics();
        } catch (error) {
            toast.error(`Reset failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleForceCheck = async () => {
        try {
            if (!forceCheckUserId.trim()) {
                toast.error('Please provide a user ID');
                return;
            }

            setLoading(true);
            const result = await callAchievementAPI('force_check_user', {
                userId: forceCheckUserId.trim()
            });

            toast.success(result.message);
            if (result.data.newAchievementsAwarded > 0) {
                toast.info(`Awarded ${result.data.newAchievementsAwarded} new achievements: ${result.data.newAchievements.join(', ')}`);
            } else {
                toast.info('No new achievements to award');
            }

            setForceCheckUserId('');
            await loadStatistics();
        } catch (error) {
            toast.error(`Force check failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleValidateSystem = async () => {
        try {
            setLoading(true);
            const result = await callAchievementAPI('validate_system');
            setValidationResults(result.data);

            if (result.data.isHealthy) {
                toast.success('System validation passed!');
            } else {
                toast.warning(`Validation found ${result.data.issues.length} issues`);
            }
        } catch (error) {
            toast.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity) {
            case 'common': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
            case 'rare': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'epic': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'legendary': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                        <Trophy className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                        Achievement Management
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage the achievement system and user badges</p>
                </div>
                <Button onClick={loadStatistics} disabled={loading} variant="outline" size="sm" className="w-full sm:w-auto">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Statistics Overview */}
            {statistics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <Card>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs md:text-sm text-muted-foreground">Total Achievements</p>
                                    <p className="text-lg md:text-2xl font-bold">{statistics.totalAchievements}</p>
                                </div>
                                <Award className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs md:text-sm text-muted-foreground">Users w/ Achievements</p>
                                    <p className="text-lg md:text-2xl font-bold">{statistics.usersWithAchievements}</p>
                                </div>
                                <Users className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs md:text-sm text-muted-foreground">By Rarity</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {Object.entries(statistics.achievementsByRarity).map(([rarity, count]) => (
                                            <Badge key={rarity} variant="outline" className={`text-xs ${getRarityColor(rarity)}`}>
                                                <span className="hidden sm:inline">{rarity}: </span>{count}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs md:text-sm text-muted-foreground">System Status</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        {validationResults?.isHealthy !== undefined ? (
                                            validationResults.isHealthy ? (
                                                <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/20 text-xs">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    <span className="hidden sm:inline">Healthy</span>
                                                    <span className="sm:hidden">OK</span>
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/20 text-xs">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    <span className="hidden sm:inline">Issues</span>
                                                    <span className="sm:hidden">!</span>
                                                </Badge>
                                            )
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground text-xs">
                                                Unknown
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <Settings className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Main Operations */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                {/* System Operations */}
                <Card>
                    <CardHeader className="pb-3 md:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <Settings className="h-4 w-4 md:h-5 md:w-5" />
                            System Operations
                        </CardTitle>
                        <CardDescription className="text-sm">Core system management operations</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4">
                        <div className="border p-3 md:p-4 rounded-lg">
                            <h4 className="font-medium mb-2 text-sm md:text-base">Initialize System</h4>
                            <p className="text-xs md:text-sm text-muted-foreground mb-3">
                                Initialize or update achievement definitions (idempotent operation)
                            </p>
                            <Button onClick={handleInitialize} disabled={loading} className="w-full" size="sm">
                                <Play className="h-4 w-4 mr-2" />
                                Initialize Achievements
                            </Button>
                        </div>

                        <div className="border p-3 md:p-4 rounded-lg">
                            <h4 className="font-medium mb-2 text-sm md:text-base">Validate System</h4>
                            <p className="text-xs md:text-sm text-muted-foreground mb-3">
                                Check system integrity and identify issues
                            </p>
                            <Button onClick={handleValidateSystem} disabled={loading} variant="outline" className="w-full" size="sm">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Run Validation
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Retroactive Awards */}
                <Card>
                    <CardHeader className="pb-3 md:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <Users className="h-4 w-4 md:h-5 md:w-5" />
                            Retroactive Awards
                        </CardTitle>
                        <CardDescription className="text-sm">Award achievements to existing users</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4">
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                <div>
                                    <Label htmlFor="userLimit" className="text-sm">User Limit</Label>
                                    <Input
                                        id="userLimit"
                                        type="number"
                                        value={retroactiveUserLimit}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRetroactiveUserLimit(parseInt(e.target.value) || 50)}
                                        min="1"
                                        max="1000"
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex items-center space-x-2 sm:mt-6">
                                    <Switch
                                        id="dryRun"
                                        checked={retroactiveDryRun}
                                        onCheckedChange={setRetroactiveDryRun}
                                    />
                                    <Label htmlFor="dryRun" className="text-sm">Dry Run</Label>
                                </div>
                            </div>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                {retroactiveDryRun ? 'Preview' : 'Apply'} achievements for up to {retroactiveUserLimit} users
                            </p>
                        </div>
                        <Button
                            onClick={handleRetroactiveAwards}
                            disabled={loading}
                            variant={retroactiveDryRun ? "outline" : "default"}
                            className="w-full"
                            size="sm"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            {retroactiveDryRun ? 'Preview Awards' : 'Apply Awards'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Bulk Award */}
                <Card>
                    <CardHeader className="pb-3 md:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <Upload className="h-4 w-4 md:h-5 md:w-5" />
                            Bulk Award
                        </CardTitle>
                        <CardDescription className="text-sm">Award specific achievement to multiple users</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4">
                        <div>
                            <Label htmlFor="bulkAwardAchievementId" className="text-sm">Achievement ID</Label>
                            <select
                                id="bulkAwardAchievementId"
                                value={bulkAwardAchievementId}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBulkAwardAchievementId(e.target.value)}
                                className="w-full p-2 mt-1 text-sm border border-border rounded-md bg-background"
                            >
                                <option value="">Select achievement...</option>
                                {achievements.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} ({a.id}) - {a.rarity}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="bulkAwardUserIds" className="text-sm">User IDs (one per line)</Label>
                            <Textarea
                                id="bulkAwardUserIds"
                                value={bulkAwardUserIds}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBulkAwardUserIds(e.target.value)}
                                placeholder="SP1ABC123...&#10;SP2DEF456...&#10;SP3GHI789..."
                                rows={3}
                                className="mt-1 text-sm"
                            />
                        </div>
                        <Button onClick={handleBulkAward} disabled={loading} className="w-full" size="sm">
                            <Award className="h-4 w-4 mr-2" />
                            Bulk Award
                        </Button>
                    </CardContent>
                </Card>

                {/* User Operations */}
                <Card>
                    <CardHeader className="pb-3 md:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            <UserCheck className="h-4 w-4 md:h-5 md:w-5" />
                            User Operations
                        </CardTitle>
                        <CardDescription className="text-sm">Manage individual user achievements</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4">
                        <div className="border p-3 md:p-4 rounded-lg">
                            <h4 className="font-medium mb-2 text-sm md:text-base">Force Check User</h4>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    value={forceCheckUserId}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForceCheckUserId(e.target.value)}
                                    placeholder="SP1ABC123..."
                                    className="flex-1 text-sm"
                                />
                                <Button onClick={handleForceCheck} disabled={loading} size="sm" className="sm:w-auto">
                                    <CheckCircle className="h-4 w-4 sm:mr-0 mr-2" />
                                    <span className="sm:hidden">Check</span>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Force achievement check and award for specific user
                            </p>
                        </div>

                        <div className="border p-3 md:p-4 rounded-lg">
                            <h4 className="font-medium mb-2 text-sm md:text-base">Reset User Achievements</h4>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    value={resetUserId}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetUserId(e.target.value)}
                                    placeholder="SP1ABC123..."
                                    className="flex-1 text-sm"
                                />
                                <Button onClick={handleResetUser} disabled={loading} variant="destructive" size="sm" className="sm:w-auto">
                                    <Trash2 className="h-4 w-4 sm:mr-0 mr-2" />
                                    <span className="sm:hidden">Reset</span>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Clear all achievements for this user (for testing)
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Achievement List */}
            {achievements.length > 0 && (
                <Card>
                    <CardHeader className="pb-3 md:pb-6">
                        <CardTitle className="text-base md:text-lg">Achievement List</CardTitle>
                        <CardDescription className="text-sm">All available achievements and their award counts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                            {achievements.map(achievement => (
                                <div key={achievement.id} className="border p-3 rounded-lg">
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <h4 className="font-medium text-sm md:text-base truncate">{achievement.name}</h4>
                                        <Badge variant="outline" className={`text-xs flex-shrink-0 ${getRarityColor(achievement.rarity)}`}>
                                            {achievement.rarity}
                                        </Badge>
                                    </div>
                                    <p className="text-xs md:text-sm text-muted-foreground mb-2 line-clamp-2">
                                        <span className="font-medium">Type:</span> {achievement.type}
                                        {achievement.threshold && (
                                            <span className="block sm:inline sm:ml-2">
                                                <span className="font-medium">Threshold:</span> {achievement.threshold >= 1000000 ? (achievement.threshold / 1000000) + ' CHA' : achievement.threshold}
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                        <span className="text-xs font-mono text-muted-foreground truncate">{achievement.id}</span>
                                        <Badge variant="secondary" className="text-xs w-fit">
                                            {achievement.awardedCount} awarded
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Validation Results */}
            {validationResults && (
                <Card>
                    <CardHeader className="pb-3 md:pb-6">
                        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                            {validationResults.isHealthy ? (
                                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />
                            )}
                            Validation Results
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                <div className="text-center sm:text-left">
                                    <p className="text-xs md:text-sm font-medium">Total Achievements</p>
                                    <p className="text-base md:text-lg font-bold">{validationResults.statistics.totalAchievements}</p>
                                </div>
                                <div className="text-center sm:text-left">
                                    <p className="text-xs md:text-sm font-medium">Users with Achievements</p>
                                    <p className="text-base md:text-lg font-bold">{validationResults.statistics.usersWithAchievements}</p>
                                </div>
                                <div className="text-center sm:text-left">
                                    <p className="text-xs md:text-sm font-medium">Total Awarded</p>
                                    <p className="text-base md:text-lg font-bold">{validationResults.statistics.totalAchievementsAwarded}</p>
                                </div>
                                <div className="text-center sm:text-left">
                                    <p className="text-xs md:text-sm font-medium">Issues Found</p>
                                    <p className={`text-base md:text-lg font-bold ${validationResults.issues.length === 0 ? 'text-green-500' : 'text-yellow-500'}`}>
                                        {validationResults.issues.length}
                                    </p>
                                </div>
                            </div>

                            {validationResults.issues.length > 0 && (
                                <div className="border-t pt-4">
                                    <h4 className="font-medium mb-2 text-sm md:text-base">Issues:</h4>
                                    <ul className="space-y-2">
                                        {validationResults.issues.map((issue: string, index: number) => (
                                            <li key={index} className="text-xs md:text-sm text-yellow-600 flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                                <span className="break-words">{issue}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}; 