import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
    checkAndAwardAchievements,
    checkReferralAchievements
} from '@/lib/leaderboard-kv';
import { getReferralStats } from '@/lib/referrals-kv';

// Cron job to automatically process achievements every 10 minutes
export async function GET(request: NextRequest) {
    try {
        console.log('[CRON] Starting automatic achievement processing...');
        const startTime = Date.now();

        // Store job start info
        await kv.set('cron:achievements:status', {
            status: 'running',
            startTime,
            lastRun: Date.now(),
            message: 'Processing achievements...'
        });

        // Get all users from leaderboard entries (they have stats)
        const leaderboardKeys = [
            'leaderboard:total_cha',
            'leaderboard:total_votes'
        ];

        const allUserIds = new Set<string>();

        for (const key of leaderboardKeys) {
            try {
                const userIds = await kv.zrange(key, 0, -1);
                userIds.forEach(id => allUserIds.add(id as string));
            } catch (error) {
                console.error(`[CRON] Error fetching from ${key}:`, error);
            }
        }

        const userArray = Array.from(allUserIds);
        console.log(`[CRON] Processing ${userArray.length} users for achievements`);

        const results = {
            processedUsers: 0,
            totalAwardsGiven: 0,
            errors: 0,
            startTime,
            duration: 0
        };

        // Process users in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < userArray.length; i += batchSize) {
            const batch = userArray.slice(i, i + batchSize);

            await Promise.all(batch.map(async (userId) => {
                try {
                    // Check general achievements
                    const newAchievements = await checkAndAwardAchievements(userId);
                    results.totalAwardsGiven += newAchievements.length;

                    // Check referral achievements
                    try {
                        const referralStats = await getReferralStats(userId);
                        const newReferralAchievements = await checkReferralAchievements(userId, referralStats.totalReferrals);
                        results.totalAwardsGiven += newReferralAchievements.length;

                        if (newReferralAchievements.length > 0) {
                            console.log(`[CRON] Awarded ${newReferralAchievements.length} referral achievements to user ${userId.substring(0, 10)}... (${referralStats.totalReferrals} referrals)`);
                        }
                    } catch (referralError) {
                        // Don't fail the whole process if referral checking fails
                        console.error(`[CRON] Error checking referral achievements for ${userId}:`, referralError);
                    }

                    results.processedUsers++;

                    if (newAchievements.length > 0) {
                        console.log(`[CRON] Awarded ${newAchievements.length} general achievements to user ${userId.substring(0, 10)}...`);
                    }
                } catch (error) {
                    console.error(`[CRON] Error processing user ${userId}:`, error);
                    results.errors++;
                }
            }));

            // Update progress
            if (i % 50 === 0) {
                await kv.set('cron:achievements:status', {
                    status: 'running',
                    startTime,
                    lastRun: Date.now(),
                    message: `Processed ${Math.min(i + batchSize, userArray.length)}/${userArray.length} users`,
                    processedUsers: results.processedUsers,
                    totalAwardsGiven: results.totalAwardsGiven
                });
            }
        }

        results.duration = Date.now() - startTime;

        // Store completion status
        await kv.set('cron:achievements:status', {
            status: 'completed',
            lastRun: Date.now(),
            message: `Completed successfully`,
            ...results
        });

        // Store in history
        await kv.lpush('cron:achievements:history', {
            timestamp: Date.now(),
            ...results
        });

        // Keep only last 10 runs in history
        await kv.ltrim('cron:achievements:history', 0, 9);

        console.log(`[CRON] Achievement processing completed in ${results.duration}ms`);
        console.log(`[CRON] Results:`, results);

        return NextResponse.json({
            success: true,
            message: 'Achievement processing completed',
            data: results
        });

    } catch (error) {
        console.error('[CRON] Achievement processing failed:', error);

        // Store error status
        await kv.set('cron:achievements:status', {
            status: 'error',
            lastRun: Date.now(),
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error.message : String(error)
        });

        return NextResponse.json(
            {
                success: false,
                error: 'Achievement processing failed',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

// Allow POST for manual triggering (admin only)
export async function POST(request: NextRequest) {
    try {
        // Verify admin access (you might want to add proper admin verification here)
        const body = await request.json();
        if (body.adminKey !== process.env.ADMIN_SECRET) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Trigger the same process as GET
        return await GET(request);
    } catch (error) {
        console.error('[CRON] Manual trigger failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Manual trigger failed',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
} 