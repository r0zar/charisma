import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
    checkAndAwardAchievements,
    checkReferralAchievements
} from '@/lib/leaderboard-kv';
import { getReferralStats } from '@/lib/referrals-kv';
import { requireAdmin } from '@/lib/roulette/admin-auth';

// Award achievements to everyone on the leaderboards
async function processAchievements() {
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

/** Vercel cron, every 10 minutes */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
    if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return processAchievements();
}

/** Manual run from the admin page */
export async function POST(request: NextRequest) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    return processAchievements();
}
