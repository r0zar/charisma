import { NextRequest, NextResponse } from 'next/server';
import {
    getReferralStats,
    createReferralCode,
    useReferralCode,
    getReferralConfig
} from '@/lib/referrals-kv';

// Public referral API endpoints
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        switch (action) {
            case 'config':
                return await handleGetConfig();

            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('[PUBLIC] Referral API error:', error);
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, userId, ...params } = body;

        // Validate userId for actions that require it
        if ((action === 'stats' || action === 'create_code' || action === 'use_code') && !userId) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        switch (action) {
            case 'stats':
                return await handleGetUserStats(userId);

            case 'create_code':
                return await handleCreateCode(userId);

            case 'use_code':
                return await handleUseCode(userId, params);

            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('[PUBLIC] Referral API error:', error);
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
 * Get referral stats for the current user
 */
async function handleGetUserStats(userId: string) {
    try {
        const stats = await getReferralStats(userId);

        return NextResponse.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Failed to get user referral stats:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get referral stats' },
            { status: 500 }
        );
    }
}

/**
 * Get public referral configuration
 */
async function handleGetConfig() {
    try {
        const config = await getReferralConfig();

        // Return only public config data
        const publicConfig = {
            isEnabled: config.isEnabled,
            commissionRate: config.commissionRate,
            maxCommissionPerVote: config.maxCommissionPerVote,
            requireMinimumVotes: config.requireMinimumVotes
        };

        return NextResponse.json({
            success: true,
            data: publicConfig
        });
    } catch (error) {
        console.error('Failed to get referral config:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get referral config' },
            { status: 500 }
        );
    }
}

/**
 * Create a new referral code for the current user
 */
async function handleCreateCode(userId: string) {
    try {
        // Check if user already has a referral code
        const stats = await getReferralStats(userId);

        if (stats.referralCodes.length > 0) {
            // Return existing code instead of creating a new one
            return NextResponse.json({
                success: true,
                data: stats.referralCodes[0],
                message: 'Using existing referral code'
            });
        }

        const referralCode = await createReferralCode(userId);

        return NextResponse.json({
            success: true,
            data: referralCode,
            message: 'Referral code created successfully'
        });
    } catch (error) {
        console.error('Failed to create referral code:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create referral code' },
            { status: 500 }
        );
    }
}

/**
 * Use a referral code
 */
async function handleUseCode(userId: string, params: { code: string }) {
    try {
        const { code } = params;

        if (!code) {
            return NextResponse.json(
                { success: false, error: 'Referral code is required' },
                { status: 400 }
            );
        }

        const referral = await useReferralCode(code, userId);

        if (!referral) {
            return NextResponse.json(
                { success: false, error: 'Failed to use referral code' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: referral,
            message: 'Referral code used successfully'
        });
    } catch (error) {
        console.error('Failed to use referral code:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to use referral code'
            },
            { status: 400 }
        );
    }
} 