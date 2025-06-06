import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
    getReferralStats,
    getReferralConfig,
    setReferralConfig,
    getAllReferrals,
    deactivateReferral,
    createReferralCode,
    deactivateReferralCode,
    getReferralCommissions,
    deleteReferralData
} from '@/lib/referrals-kv';

// Admin-only referral management endpoints
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        console.log(`[ADMIN] Referral operation: ${action}`, params);

        switch (action) {
            case 'get_stats':
                return await handleGetStats(params);

            case 'get_config':
                return await handleGetConfig();

            case 'update_config':
                return await handleUpdateConfig(params);

            case 'get_all_referrals':
                return await handleGetAllReferrals(params);

            case 'deactivate_referral':
                return await handleDeactivateReferral(params);

            case 'create_referral_code':
                return await handleCreateReferralCode(params);

            case 'deactivate_referral_code':
                return await handleDeactivateReferralCode(params);

            case 'get_commissions':
                return await handleGetCommissions(params);

            case 'reset_user_referrals':
                return await handleResetUserReferrals(params);

            case 'get_system_stats':
                return await handleGetSystemStats();

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('[ADMIN] Referral API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

/**
 * Get referral stats for a specific user
 */
async function handleGetStats(params: { userId: string }) {
    try {
        const { userId } = params;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            );
        }

        const stats = await getReferralStats(userId);

        return NextResponse.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[ADMIN] Failed to get referral stats:', error);
        throw error;
    }
}

/**
 * Get current referral system configuration
 */
async function handleGetConfig() {
    try {
        const config = await getReferralConfig();

        return NextResponse.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('[ADMIN] Failed to get referral config:', error);
        throw error;
    }
}

/**
 * Update referral system configuration
 */
async function handleUpdateConfig(params: any) {
    try {
        const config = await setReferralConfig(params);

        return NextResponse.json({
            success: true,
            message: 'Referral configuration updated successfully',
            data: config
        });
    } catch (error) {
        console.error('[ADMIN] Failed to update referral config:', error);
        throw error;
    }
}

/**
 * Get all referrals in the system
 */
async function handleGetAllReferrals(params: { limit?: number; offset?: number }) {
    try {
        const { limit = 100, offset = 0 } = params;
        const referrals = await getAllReferrals(limit, offset);

        return NextResponse.json({
            success: true,
            data: referrals
        });
    } catch (error) {
        console.error('[ADMIN] Failed to get all referrals:', error);
        throw error;
    }
}

/**
 * Deactivate a specific referral
 */
async function handleDeactivateReferral(params: { referralId: string; reason?: string }) {
    try {
        const { referralId, reason } = params;

        if (!referralId) {
            return NextResponse.json(
                { success: false, error: 'referralId is required' },
                { status: 400 }
            );
        }

        const success = await deactivateReferral(referralId, reason);

        return NextResponse.json({
            success,
            message: success ? 'Referral deactivated successfully' : 'Failed to deactivate referral'
        });
    } catch (error) {
        console.error('[ADMIN] Failed to deactivate referral:', error);
        throw error;
    }
}

/**
 * Create a new referral code for a user
 */
async function handleCreateReferralCode(params: { userId: string; code?: string; maxUses?: number; expiresAt?: number }) {
    try {
        const { userId, code, maxUses, expiresAt } = params;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            );
        }

        const referralCode = await createReferralCode(userId, code, maxUses, expiresAt);

        return NextResponse.json({
            success: true,
            message: 'Referral code created successfully',
            data: referralCode
        });
    } catch (error) {
        console.error('[ADMIN] Failed to create referral code:', error);
        throw error;
    }
}

/**
 * Deactivate a referral code
 */
async function handleDeactivateReferralCode(params: { code: string; reason?: string }) {
    try {
        const { code, reason } = params;

        if (!code) {
            return NextResponse.json(
                { success: false, error: 'code is required' },
                { status: 400 }
            );
        }

        const success = await deactivateReferralCode(code, reason);

        return NextResponse.json({
            success,
            message: success ? 'Referral code deactivated successfully' : 'Failed to deactivate referral code'
        });
    } catch (error) {
        console.error('[ADMIN] Failed to deactivate referral code:', error);
        throw error;
    }
}

/**
 * Get referral commissions
 */
async function handleGetCommissions(params: { userId?: string; limit?: number; offset?: number }) {
    try {
        const { userId, limit = 100, offset = 0 } = params;
        const commissions = await getReferralCommissions(userId, limit, offset);

        return NextResponse.json({
            success: true,
            data: commissions
        });
    } catch (error) {
        console.error('[ADMIN] Failed to get referral commissions:', error);
        throw error;
    }
}

/**
 * Reset all referral data for a user
 */
async function handleResetUserReferrals(params: { userId: string }) {
    try {
        const { userId } = params;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            );
        }

        await deleteReferralData(userId);

        return NextResponse.json({
            success: true,
            message: `Referral data reset for user: ${userId}`
        });
    } catch (error) {
        console.error('[ADMIN] Failed to reset user referrals:', error);
        throw error;
    }
}

/**
 * Get system-wide referral statistics
 */
async function handleGetSystemStats() {
    try {
        const stats = {
            totalReferrals: 0,
            activeReferrals: 0,
            totalCommissions: 0,
            totalReferralCodes: 0,
            activeReferralCodes: 0,
            topReferrers: [] as Array<{ userId: string; referrals: number; commissions: number }>
        };

        // Get all referrals
        const allReferrals = await getAllReferrals(10000, 0);
        stats.totalReferrals = allReferrals.length;
        stats.activeReferrals = allReferrals.filter((r: any) => r.isActive).length;

        // Calculate total commissions
        stats.totalCommissions = allReferrals.reduce((sum: number, r: any) => sum + r.totalCommissions, 0);

        // Get all referral codes
        try {
            const scanResult = await kv.scan(0, { match: 'referral_code:*', count: 1000 });
            const codeKeys = scanResult[1];
            stats.totalReferralCodes = codeKeys.length;

            let activeCodeCount = 0;
            for (const key of codeKeys) {
                const code = await kv.get(key);
                if (code && typeof code === 'object' && 'isActive' in code && code.isActive) {
                    activeCodeCount++;
                }
            }
            stats.activeReferralCodes = activeCodeCount;
        } catch (scanError) {
            console.warn('Could not scan referral codes:', scanError);
        }

        // Calculate top referrers
        const referrerStats = new Map<string, { referrals: number; commissions: number }>();
        allReferrals.forEach((r: any) => {
            const current = referrerStats.get(r.referrerId) || { referrals: 0, commissions: 0 };
            current.referrals++;
            current.commissions += r.totalCommissions;
            referrerStats.set(r.referrerId, current);
        });

        stats.topReferrers = Array.from(referrerStats.entries())
            .map(([userId, data]) => ({ userId, ...data }))
            .sort((a, b) => b.commissions - a.commissions)
            .slice(0, 10);

        return NextResponse.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[ADMIN] Failed to get system stats:', error);
        throw error;
    }
} 