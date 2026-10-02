import { signedFetchWithTimestamp } from 'blaze-sdk';
import { ADMIN_MESSAGE } from '@/lib/roulette/admin';
import type { PublicBet, RoundPayload, RouletteConfig } from '@/lib/roulette/types';

/** Every admin call is signed by the admin wallet with a timestamp; the server refuses anything older than 5 minutes. */
async function adminPost<T = any>(path: string, body: unknown): Promise<T> {
    const res = await signedFetchWithTimestamp(path, {
        method: 'POST',
        message: ADMIN_MESSAGE,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `${path} answered ${res.status}`);
    return json as T;
}

// --- Rounds ---

export type AdminRoundState = RoundPayload & { history: string[]; bets: PublicBet[] };

export async function getRoundAdmin(): Promise<AdminRoundState> {
    const res = await fetch('/api/admin/round', { cache: 'no-store' });
    if (!res.ok) throw new Error(`/api/admin/round answered ${res.status}`);
    return res.json();
}

export const saveConfig = (config: RouletteConfig) => adminPost('/api/admin/round', { action: 'config', ...config });
export const rescheduleRound = (endsAt: number) => adminPost('/api/admin/round', { action: 'reschedule', endsAt });
export const voidRound = () => adminPost('/api/admin/round', { action: 'void' });

// --- Achievements ---

export const achievementAction = (action: string, params: Record<string, unknown> = {}) =>
    adminPost('/api/admin/achievements', { action, ...params });

export const runAchievementsNow = () => adminPost('/api/cron/process-achievements', {});

// --- Referrals (these return { error } instead of throwing, as the referral panel expects) ---

async function referral(body: Record<string, unknown>) {
    try {
        return await adminPost('/api/admin/referrals', body);
    } catch (error) {
        console.error(`Referral admin ${body.action} failed:`, error);
        return { error: error instanceof Error ? error.message : String(error) };
    }
}

export const getReferralStats = (userId: string) => referral({ action: 'get_stats', userId });
export const getReferralConfig = () => referral({ action: 'get_config' });
export const updateReferralConfig = (config: Record<string, unknown>) => referral({ action: 'update_config', ...config });
export const getAllReferrals = (limit?: number, offset?: number) => referral({ action: 'get_all_referrals', limit, offset });
export const deactivateReferral = (referralId: string, reason?: string) => referral({ action: 'deactivate_referral', referralId, reason });
export const createReferralCode = (userId: string, code?: string, maxUses?: number, expiresAt?: number) =>
    referral({ action: 'create_referral_code', userId, code, maxUses, expiresAt });
export const deactivateReferralCode = (code: string, reason?: string) => referral({ action: 'deactivate_referral_code', code, reason });
export const getReferralCommissions = (userId?: string, limit?: number, offset?: number) =>
    referral({ action: 'get_commissions', userId, limit, offset });
export const resetUserReferrals = (userId: string) => referral({ action: 'reset_user_referrals', userId });
export const getReferralSystemStats = () => referral({ action: 'get_system_stats' });
