'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Search, Crown, Star, Flame, Users, Gift, Zap, Clock, Lock, X, Calendar, Circle, Hexagon, Diamond, Sparkles } from 'lucide-react';
import { useAchievements, useUserAchievements } from '@/hooks/useLeaderboard';
import type { AchievementDefinition, UserAchievement } from '@/hooks/useLeaderboard';
import { useWallet } from '@/contexts/wallet-context';
import { TwitterShareButton } from '@/components/ui/TwitterShareButton';

const AchievementBadges = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRarity, setFilterRarity] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);
    const [selectedAchievement, setSelectedAchievement] = useState<AchievementDefinition | null>(null);
    const [hoveredAchievement, setHoveredAchievement] = useState<string | null>(null);

    const { address: walletAddress, connected } = useWallet();

    const { data: achievementsData, isLoading: achievementsLoading } = useAchievements();
    const { data: userAchievementsData, isLoading: userAchievementsLoading } = useUserAchievements(connected ? walletAddress : null);

    // Filter and search achievements
    const filteredAchievements = useMemo(() => {
        if (!achievementsData?.achievements) return [];

        return achievementsData.achievements.filter(achievement => {
            const matchesSearch = achievement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                achievement.description.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesRarity = filterRarity === 'all' || achievement.rarity === filterRarity;
            const matchesType = filterType === 'all' || achievement.type === filterType;

            const isUnlocked = userAchievementsData?.achievements.some(ua => ua.achievementId === achievement.id);
            const matchesUnlocked = !showUnlockedOnly || isUnlocked;

            return matchesSearch && matchesRarity && matchesType && matchesUnlocked;
        });
    }, [achievementsData?.achievements, searchTerm, filterRarity, filterType, showUnlockedOnly, userAchievementsData?.achievements]);

    const getRarityColor = (rarity: string) => {
        switch (rarity) {
            case 'common': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
            case 'rare': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'epic': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'legendary': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    const getRarityEffect = (rarity: string, unlocked: boolean) => {
        if (!unlocked) return '';

        switch (rarity) {
            case 'legendary': return 'legendary-effect';
            case 'epic': return 'epic-effect';
            case 'rare': return 'rare-effect';
            case 'common':
            default: return '';
        }
    };



    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'milestone': return <Trophy className="h-3 w-3" />;
            case 'streak': return <Flame className="h-3 w-3" />;
            case 'special': return <Crown className="h-3 w-3" />;
            case 'social': return <Users className="h-3 w-3" />;
            case 'earnings': return <Gift className="h-3 w-3" />;
            default: return <Star className="h-3 w-3" />;
        }
    };

    const getRarityIcon = (rarity: string, size: 'sm' | 'md' = 'sm') => {
        const sizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
        switch (rarity) {
            case 'legendary': return <Sparkles className={sizeClass} />;
            case 'epic': return <Diamond className={sizeClass} />;
            case 'rare': return <Hexagon className={sizeClass} />;
            case 'common':
            default: return <Circle className={sizeClass} />;
        }
    };

    const isUnlocked = (achievementId: string): boolean => {
        return userAchievementsData?.achievements.some(ua => ua.achievementId === achievementId) || false;
    };

    const getUnlockedDate = (achievementId: string) => {
        const achievement = userAchievementsData?.achievements.find(ua => ua.achievementId === achievementId);
        return achievement ? new Date(achievement.unlockedAt).toLocaleDateString() : null;
    };

    const isLoading = achievementsLoading || userAchievementsLoading;

    const AchievementTooltip = ({ achievement, unlocked, children }: {
        achievement: AchievementDefinition;
        unlocked: boolean;
        children: React.ReactNode;
    }) => {
        const unlockedDate = getUnlockedDate(achievement.id);

        return (
            <div className="relative group">
                {children}
                {hoveredAchievement === achievement.id && (
                    <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg text-sm min-w-[200px] max-w-[280px] pointer-events-none">
                        <div className="font-medium mb-1">{achievement.name}</div>
                        <div className="text-muted-foreground text-xs mb-2">{achievement.description}</div>
                        <div className="flex items-center justify-between text-xs">
                            <Badge variant="outline" className={`${getRarityColor(achievement.rarity)} ${getRarityEffect(achievement.rarity, unlocked)}`}>
                                {getRarityIcon(achievement.rarity, 'sm')}
                            </Badge>
                            {unlocked && unlockedDate && (
                                <div className="flex items-center gap-1 text-green-400">
                                    <Calendar className="h-3 w-3" />
                                    <span>{unlockedDate}</span>
                                </div>
                            )}
                        </div>
                        {achievement.threshold && (
                            <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                Target: {achievement.threshold >= 1000000
                                    ? `${(achievement.threshold / 1000000).toLocaleString()} CHA`
                                    : achievement.threshold.toLocaleString()
                                }
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Memoize the entire achievement grid to prevent re-renders from websocket updates
    const achievementGrid = useMemo(() => (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
            {filteredAchievements.map((achievement, index) => {
                const unlocked = isUnlocked(achievement.id);

                return (
                    <AchievementTooltip key={achievement.id} achievement={achievement} unlocked={unlocked}>
                        <div
                            className="aspect-square w-full cursor-pointer"
                            onMouseEnter={() => setHoveredAchievement(achievement.id)}
                            onMouseLeave={() => setHoveredAchievement(null)}
                            onClick={() => setSelectedAchievement(achievement)}
                        >
                            <div
                                className={`achievement-badge w-full h-full rounded-xl border-2 flex items-center justify-center text-2xl sm:text-3xl relative overflow-hidden ${unlocked
                                    ? `${getRarityColor(achievement.rarity)} ${getRarityEffect(achievement.rarity, unlocked)} hover:border-opacity-80`
                                    : 'border-border/30 bg-muted/10 grayscale-[0.8] hover:grayscale-[0.6]'
                                    }`}
                            >
                                {unlocked ? (
                                    <span className="drop-shadow-sm">{achievement.icon}</span>
                                ) : (
                                    <div className="relative">
                                        <span className="text-muted-foreground/50">{achievement.icon}</span>
                                        <Lock className="absolute -bottom-1 -right-1 h-4 w-4 text-muted-foreground/70 bg-background rounded-full p-0.5" />
                                    </div>
                                )}

                                {/* Tiny type indicator in corner */}
                                <div className="absolute top-1 left-1 text-muted-foreground/60">
                                    {getTypeIcon(achievement.type)}
                                </div>
                            </div>
                        </div>
                    </AchievementTooltip>
                );
            })}
        </div>
    ), [filteredAchievements, userAchievementsData?.achievements, hoveredAchievement]);

    return (
        <div className="flex flex-col gap-0 md:gap-6 mb-0 md:mb-8">
            {/* Header */}
            <div className="bg-background/50 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-base sm:text-lg font-semibold font-display flex items-center gap-2 mb-2">
                            <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            Achievement Badges
                        </h1>
                        <p className="text-sm text-muted-foreground">Collect badges by participating in the meme roulette madness</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
                            <Zap className="h-3 w-3 text-primary" />
                            <span className="text-muted-foreground">
                                {userAchievementsData?.unlockedCount || 0}/{achievementsData?.totalCount || 0} Unlocked
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Search achievements..."
                            className="pl-10 bg-background border-border"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                        {/* Rarity Filter */}
                        <select
                            value={filterRarity}
                            onChange={(e) => setFilterRarity(e.target.value)}
                            className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                        >
                            <option value="all">All Rarities</option>
                            <option value="common">Common</option>
                            <option value="rare">Rare</option>
                            <option value="epic">Epic</option>
                            <option value="legendary">Legendary</option>
                        </select>

                        {/* Type Filter */}
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                        >
                            <option value="all">All Types</option>
                            <option value="milestone">Milestone</option>
                            <option value="streak">Streak</option>
                            <option value="special">Special</option>
                            <option value="social">Social</option>
                            <option value="earnings">Earnings</option>
                        </select>

                        {/* Unlocked Filter */}
                        <button
                            onClick={() => setShowUnlockedOnly(!showUnlockedOnly)}
                            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${showUnlockedOnly
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Unlocked Only
                        </button>
                    </div>
                </div>
            </div>

            {/* Achievement Grid */}
            <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
                {isLoading ? (
                    // Loading skeleton
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
                        {Array.from({ length: 24 }).map((_, index) => (
                            <div key={index} className="aspect-square w-full">
                                <div className="w-full h-full bg-muted/30 rounded-xl animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : filteredAchievements.length > 0 ? (
                    achievementGrid
                ) : (
                    <div className="text-center py-12">
                        <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium mb-2">No Achievements Found</h3>
                        <p className="text-muted-foreground">
                            {searchTerm || filterRarity !== 'all' || filterType !== 'all' || showUnlockedOnly
                                ? 'Try adjusting your filters to see more achievements.'
                                : 'Start playing meme roulette to unlock achievements!'}
                        </p>
                    </div>
                )}

                {/* Stats Footer */}
                <div className="mt-6 pt-4 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
                    <div>
                        Showing {filteredAchievements.length} of {achievementsData?.totalCount || 0} achievements
                    </div>
                    <div className="flex items-center gap-1">
                        <span>Progress:</span>
                        <span className="font-medium text-primary">
                            {Math.round(((userAchievementsData?.unlockedCount || 0) / (achievementsData?.totalCount || 1)) * 100)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Achievement Details Modal */}
            {selectedAchievement && (
                <Dialog open={true} onOpenChange={(open) => !open && setSelectedAchievement(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-3xl ${isUnlocked(selectedAchievement.id)
                                    ? `${getRarityColor(selectedAchievement.rarity)} ${getRarityEffect(selectedAchievement.rarity, isUnlocked(selectedAchievement.id))}`
                                    : 'bg-muted/20 grayscale'
                                    }`}
                                >
                                    {isUnlocked(selectedAchievement.id) ? (
                                        selectedAchievement.icon
                                    ) : (
                                        <div className="relative">
                                            <span className="text-muted-foreground/50">{selectedAchievement.icon}</span>
                                            <Lock className="absolute -bottom-1 -right-1 h-5 w-5 text-muted-foreground bg-background rounded-full p-0.5" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="font-display text-lg flex items-center gap-2">
                                        {selectedAchievement.name}
                                        <Badge variant="outline" className={`${getRarityColor(selectedAchievement.rarity)} ${getRarityEffect(selectedAchievement.rarity, isUnlocked(selectedAchievement.id))}`}>
                                            {getRarityIcon(selectedAchievement.rarity, 'sm')}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
                                        {getTypeIcon(selectedAchievement.type)}
                                        <span className="capitalize">{selectedAchievement.type}</span>
                                    </div>
                                </div>
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <p className="text-muted-foreground">{selectedAchievement.description}</p>

                            {selectedAchievement.threshold && (
                                <div className="bg-muted/20 rounded-lg p-3">
                                    <div className="text-sm font-medium mb-1">Target</div>
                                    <div className="text-muted-foreground">
                                        {selectedAchievement.threshold >= 1000000
                                            ? `${(selectedAchievement.threshold / 1000000).toLocaleString()} CHA`
                                            : selectedAchievement.threshold.toLocaleString()
                                        }
                                    </div>
                                </div>
                            )}

                            {isUnlocked(selectedAchievement.id) ? (
                                <div className="space-y-3">
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 text-green-400 font-medium mb-1">
                                            <Trophy className="h-4 w-4" />
                                            Achievement Unlocked!
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Unlocked on {getUnlockedDate(selectedAchievement.id)}
                                        </div>
                                    </div>
                                    <TwitterShareButton
                                        message={selectedAchievement.type === 'social'
                                            ? `Just unlocked "${selectedAchievement.name}" in Meme Roulette! ${selectedAchievement.icon} Growing the community one referral at a time...`
                                            : `Just unlocked the "${selectedAchievement.name}" achievement in Meme Roulette! ${selectedAchievement.icon} ${selectedAchievement.description}`
                                        }
                                        variant="default"
                                        size="default"
                                        className="w-full"
                                    />
                                </div>
                            ) : (
                                <div className="bg-muted/10 border border-border/20 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-muted-foreground font-medium mb-1">
                                        <Lock className="h-4 w-4" />
                                        Locked
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Complete the requirements to unlock this achievement.
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

export default AchievementBadges; 