import { kv } from '@vercel/kv';
import {
    Referral,
    ReferralCode,
    ReferralStats,
    ReferralCommission,
    ReferralConfig
} from '@/types/spin';

/**
 * Default referral configuration
 */
const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
    commissionRate: 0.05, // 5% commission
    maxCommissionPerVote: 1000, // Max 1000 CHA commission per vote
    isEnabled: true,
    requireMinimumVotes: 1, // Referrer earns commission after referee's first vote
    maxReferralsPerUser: 1000 // Max 1000 referrals per user
};

/**
 * Generate a unique referral code
 */
function generateReferralCode(userId: string): string {
    const timestamp = Date.now().toString(36);
    const userHash = userId.slice(-4);
    const random = Math.random().toString(36).substring(2, 6);
    return `${userHash}${timestamp}${random}`.toUpperCase();
}

/**
 * Get referral system configuration
 */
export async function getReferralConfig(): Promise<ReferralConfig> {
    try {
        const config = await kv.get('referral_config');
        if (!config) {
            // Initialize with default config without calling setReferralConfig to avoid circular dependency
            await kv.set('referral_config', DEFAULT_REFERRAL_CONFIG);
            return DEFAULT_REFERRAL_CONFIG;
        }
        return config as ReferralConfig;
    } catch (error) {
        console.error('Failed to get referral config:', error);
        return DEFAULT_REFERRAL_CONFIG;
    }
}

/**
 * Set referral system configuration
 */
export async function setReferralConfig(config: Partial<ReferralConfig>): Promise<ReferralConfig> {
    try {
        // Get current config directly from KV to avoid circular dependency
        const currentConfig = await kv.get('referral_config') as ReferralConfig || DEFAULT_REFERRAL_CONFIG;
        const newConfig = { ...currentConfig, ...config };
        await kv.set('referral_config', newConfig);
        return newConfig;
    } catch (error) {
        console.error('Failed to set referral config:', error);
        throw error;
    }
}

/**
 * Create a new referral code for a user
 */
export async function createReferralCode(
    userId: string,
    customCode?: string,
    maxUses?: number,
    expiresAt?: number
): Promise<ReferralCode> {
    try {
        const code = customCode || generateReferralCode(userId);

        // Check if code already exists
        const existingCode = await kv.get(`referral_code:${code}`);
        if (existingCode) {
            throw new Error(`Referral code ${code} already exists`);
        }

        const referralCode: ReferralCode = {
            code,
            userId,
            isActive: true,
            createdAt: Date.now(),
            totalUses: 0,
            maxUses,
            expiresAt
        };

        await kv.set(`referral_code:${code}`, referralCode);

        // Add to user's referral codes list
        const userCodes = await kv.get(`user:${userId}:referral_codes`) || [];
        (userCodes as string[]).push(code);
        await kv.set(`user:${userId}:referral_codes`, userCodes);

        return referralCode;
    } catch (error) {
        console.error('Failed to create referral code:', error);
        throw error;
    }
}

/**
 * Get a referral code by code string
 */
export async function getReferralCode(code: string): Promise<ReferralCode | null> {
    try {
        const referralCode = await kv.get(`referral_code:${code}`);
        return referralCode as ReferralCode | null;
    } catch (error) {
        console.error('Failed to get referral code:', error);
        return null;
    }
}

/**
 * Use a referral code to create a referral relationship
 */
export async function useReferralCode(code: string, refereeId: string): Promise<Referral | null> {
    try {
        const referralCode = await getReferralCode(code);
        if (!referralCode || !referralCode.isActive) {
            throw new Error('Invalid or inactive referral code');
        }

        // Check if code is expired
        if (referralCode.expiresAt && Date.now() > referralCode.expiresAt) {
            throw new Error('Referral code has expired');
        }

        // Check if code has reached max uses
        if (referralCode.maxUses && referralCode.totalUses >= referralCode.maxUses) {
            throw new Error('Referral code has reached maximum uses');
        }

        // Check if user is trying to refer themselves
        if (referralCode.userId === refereeId) {
            throw new Error('Cannot refer yourself');
        }

        // Check if user is already referred by someone
        const existingReferral = await kv.get(`user:${refereeId}:referred_by`);
        if (existingReferral) {
            throw new Error('User is already referred by someone');
        }

        // Create referral
        const referralId = `${referralCode.userId}_${refereeId}_${Date.now()}`;
        const referral: Referral = {
            id: referralId,
            referrerId: referralCode.userId,
            refereeId,
            referralCode: code,
            createdAt: Date.now(),
            isActive: true,
            totalCommissions: 0,
            refereeLifetimeVotes: 0
        };

        // Save referral
        await kv.set(`referral:${referralId}`, referral);
        await kv.set(`user:${refereeId}:referred_by`, referralId);

        // Add to referrer's referrals list
        const referrerReferrals = await kv.get(`user:${referralCode.userId}:referrals`) || [];
        (referrerReferrals as string[]).push(referralId);
        await kv.set(`user:${referralCode.userId}:referrals`, referrerReferrals);

        // Update referral code usage
        referralCode.totalUses++;
        await kv.set(`referral_code:${code}`, referralCode);

        return referral;
    } catch (error) {
        console.error('Failed to use referral code:', error);
        throw error;
    }
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
    try {
        // Get user's referral codes
        const userCodes = await kv.get(`user:${userId}:referral_codes`) || [];
        const referralCodes: ReferralCode[] = [];
        for (const code of userCodes as string[]) {
            const referralCode = await getReferralCode(code);
            if (referralCode) {
                referralCodes.push(referralCode);
            }
        }

        // Get user's referrals
        const userReferralIds = await kv.get(`user:${userId}:referrals`) || [];
        const referrals: Referral[] = [];
        let totalCommissions = 0;
        let activeReferrals = 0;

        for (const referralId of userReferralIds as string[]) {
            const referral = await kv.get(`referral:${referralId}`);
            if (referral) {
                referrals.push(referral as Referral);
                totalCommissions += (referral as Referral).totalCommissions;
                if ((referral as Referral).isActive) {
                    activeReferrals++;
                }
            }
        }

        // Check if user was referred by someone
        const referredByReferralId = await kv.get(`user:${userId}:referred_by`);
        let referredBy: Referral | undefined;
        if (referredByReferralId) {
            const referralData = await kv.get(`referral:${referredByReferralId}`);
            if (referralData) {
                referredBy = referralData as Referral;
            }
        }

        return {
            userId,
            totalReferrals: referrals.length,
            activeReferrals,
            totalCommissions,
            referralCodes,
            referrals,
            referredBy
        };
    } catch (error) {
        console.error('Failed to get referral stats:', error);
        throw error;
    }
}

/**
 * Record a commission earned from a referral
 */
export async function recordReferralCommission(
    referralId: string,
    amount: number,
    sourceVoteId: string,
    roundId?: string
): Promise<ReferralCommission> {
    try {
        const referral = await kv.get(`referral:${referralId}`) as Referral;
        if (!referral || !referral.isActive) {
            throw new Error('Invalid or inactive referral');
        }

        const config = await getReferralConfig();
        if (!config.isEnabled) {
            throw new Error('Referral system is disabled');
        }

        // Calculate commission amount
        const commissionAmount = Math.min(amount * config.commissionRate, config.maxCommissionPerVote);

        const commissionId = `${referralId}_${sourceVoteId}_${Date.now()}`;
        const commission: ReferralCommission = {
            id: commissionId,
            referralId,
            referrerId: referral.referrerId,
            refereeId: referral.refereeId,
            amount: commissionAmount,
            sourceVoteId,
            createdAt: Date.now(),
            roundId
        };

        // Save commission
        await kv.set(`commission:${commissionId}`, commission);

        // Update referral total commissions
        referral.totalCommissions += commissionAmount;
        referral.refereeLifetimeVotes++;
        await kv.set(`referral:${referralId}`, referral);

        // Add to referrer's commissions list
        const referrerCommissions = await kv.get(`user:${referral.referrerId}:commissions`) || [];
        (referrerCommissions as string[]).push(commissionId);
        await kv.set(`user:${referral.referrerId}:commissions`, referrerCommissions);

        return commission;
    } catch (error) {
        console.error('Failed to record referral commission:', error);
        throw error;
    }
}

/**
 * Get all referrals in the system
 */
export async function getAllReferrals(limit: number = 100, offset: number = 0): Promise<Referral[]> {
    try {
        const scanResult = await kv.scan(0, { match: 'referral:*', count: 1000 });
        const referralKeys = scanResult[1];

        const referrals: Referral[] = [];
        const startIndex = offset;
        const endIndex = Math.min(offset + limit, referralKeys.length);

        for (let i = startIndex; i < endIndex; i++) {
            if (i < referralKeys.length) {
                const referral = await kv.get(referralKeys[i]);
                if (referral) {
                    referrals.push(referral as Referral);
                }
            }
        }

        return referrals.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
        console.error('Failed to get all referrals:', error);
        return [];
    }
}

/**
 * Get referral commissions
 */
export async function getReferralCommissions(
    userId?: string,
    limit: number = 100,
    offset: number = 0
): Promise<ReferralCommission[]> {
    try {
        if (userId) {
            // Get commissions for specific user
            const userCommissionIds = await kv.get(`user:${userId}:commissions`) || [];
            const commissions: ReferralCommission[] = [];

            const startIndex = offset;
            const endIndex = Math.min(offset + limit, (userCommissionIds as string[]).length);

            for (let i = startIndex; i < endIndex; i++) {
                if (i < (userCommissionIds as string[]).length) {
                    const commission = await kv.get(`commission:${(userCommissionIds as string[])[i]}`);
                    if (commission) {
                        commissions.push(commission as ReferralCommission);
                    }
                }
            }

            return commissions.sort((a, b) => b.createdAt - a.createdAt);
        } else {
            // Get all commissions
            const scanResult = await kv.scan(0, { match: 'commission:*', count: 1000 });
            const commissionKeys = scanResult[1];

            const commissions: ReferralCommission[] = [];
            const startIndex = offset;
            const endIndex = Math.min(offset + limit, commissionKeys.length);

            for (let i = startIndex; i < endIndex; i++) {
                if (i < commissionKeys.length) {
                    const commission = await kv.get(commissionKeys[i]);
                    if (commission) {
                        commissions.push(commission as ReferralCommission);
                    }
                }
            }

            return commissions.sort((a, b) => b.createdAt - a.createdAt);
        }
    } catch (error) {
        console.error('Failed to get referral commissions:', error);
        return [];
    }
}

/**
 * Deactivate a referral
 */
export async function deactivateReferral(referralId: string, reason?: string): Promise<boolean> {
    try {
        const referral = await kv.get(`referral:${referralId}`) as Referral;
        if (!referral) {
            return false;
        }

        referral.isActive = false;
        await kv.set(`referral:${referralId}`, referral);

        console.log(`Referral ${referralId} deactivated${reason ? ` - Reason: ${reason}` : ''}`);
        return true;
    } catch (error) {
        console.error('Failed to deactivate referral:', error);
        return false;
    }
}

/**
 * Deactivate a referral code
 */
export async function deactivateReferralCode(code: string, reason?: string): Promise<boolean> {
    try {
        const referralCode = await getReferralCode(code);
        if (!referralCode) {
            return false;
        }

        referralCode.isActive = false;
        await kv.set(`referral_code:${code}`, referralCode);

        console.log(`Referral code ${code} deactivated${reason ? ` - Reason: ${reason}` : ''}`);
        return true;
    } catch (error) {
        console.error('Failed to deactivate referral code:', error);
        return false;
    }
}

/**
 * Delete all referral data for a user
 */
export async function deleteReferralData(userId: string): Promise<void> {
    try {
        // Delete user's referral codes
        const userCodes = await kv.get(`user:${userId}:referral_codes`) || [];
        for (const code of userCodes as string[]) {
            await kv.del(`referral_code:${code}`);
        }
        await kv.del(`user:${userId}:referral_codes`);

        // Delete user's referrals
        const userReferralIds = await kv.get(`user:${userId}:referrals`) || [];
        for (const referralId of userReferralIds as string[]) {
            await kv.del(`referral:${referralId}`);
        }
        await kv.del(`user:${userId}:referrals`);

        // Delete user's commissions
        const userCommissionIds = await kv.get(`user:${userId}:commissions`) || [];
        for (const commissionId of userCommissionIds as string[]) {
            await kv.del(`commission:${commissionId}`);
        }
        await kv.del(`user:${userId}:commissions`);

        // Delete user's referred_by reference
        await kv.del(`user:${userId}:referred_by`);

        console.log(`All referral data deleted for user: ${userId}`);
    } catch (error) {
        console.error('Failed to delete referral data:', error);
        throw error;
    }
} 