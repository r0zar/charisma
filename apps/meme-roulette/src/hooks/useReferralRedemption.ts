'use client';

import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-context';
import { toast } from '@/components/ui/sonner';

const PENDING_REFERRAL_KEY = 'pending_referral_code';
const REFERRAL_REDEEMED_KEY = 'referral_redeemed';

export function useReferralRedemption() {
    const searchParams = useSearchParams();
    const { connected, address } = useWallet();

    // Check for referral code in URL and store it
    useEffect(() => {
        const referralCode = searchParams?.get('ref');

        if (referralCode && referralCode.trim()) {
            // Don't overwrite if user already has a pending referral
            const existingPending = localStorage.getItem(PENDING_REFERRAL_KEY);
            const alreadyRedeemed = localStorage.getItem(REFERRAL_REDEEMED_KEY);

            if (!existingPending && !alreadyRedeemed) {
                localStorage.setItem(PENDING_REFERRAL_KEY, referralCode.trim());
                console.log(`🎯 Referral code detected: ${referralCode.trim()}`);

                if (!connected) {
                    toast.info('Referral code saved! Connect your wallet to claim it.', {
                        duration: 5000
                    });
                }
            }
        }
    }, [searchParams, connected]);

    // Automatically redeem referral code when wallet connects
    const redeemPendingReferral = useCallback(async () => {
        if (!connected || !address) return;

        const pendingCode = localStorage.getItem(PENDING_REFERRAL_KEY);
        if (!pendingCode) return;

        const alreadyRedeemed = localStorage.getItem(REFERRAL_REDEEMED_KEY);
        if (alreadyRedeemed) {
            // Clean up if already redeemed
            localStorage.removeItem(PENDING_REFERRAL_KEY);
            return;
        }

        try {
            console.log(`🔄 Attempting to redeem referral code: ${pendingCode}`);

            const response = await fetch('/api/referrals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'use_code',
                    code: pendingCode,
                    userId: address
                })
            });

            const result = await response.json();

            if (result.success) {
                // Success! Clean up and mark as redeemed
                localStorage.removeItem(PENDING_REFERRAL_KEY);
                localStorage.setItem(REFERRAL_REDEEMED_KEY, 'true');

                toast.success('🎉 Referral code redeemed successfully! Welcome to the roulette!', {
                    duration: 6000
                });

                console.log(`✅ Referral code redeemed: ${pendingCode}`);
            } else {
                // Handle specific error cases
                const errorMessage = result.error || 'Failed to redeem referral code';

                if (errorMessage.includes('already referred')) {
                    // User already referred - clean up and mark as handled
                    localStorage.removeItem(PENDING_REFERRAL_KEY);
                    localStorage.setItem(REFERRAL_REDEEMED_KEY, 'true');

                    toast.info('You\'re already part of someone\'s referral network!', {
                        duration: 4000
                    });
                } else if (errorMessage.includes('Invalid or inactive')) {
                    // Invalid code - clean up but don't mark as redeemed
                    localStorage.removeItem(PENDING_REFERRAL_KEY);

                    toast.error('The referral code has expired or is invalid.', {
                        duration: 4000
                    });
                } else if (errorMessage.includes('refer yourself')) {
                    // Self-referral attempt - clean up
                    localStorage.removeItem(PENDING_REFERRAL_KEY);

                    toast.error('You can\'t use your own referral code!', {
                        duration: 4000
                    });
                } else {
                    // Other errors - keep the code for retry
                    console.error('Failed to redeem referral code:', errorMessage);
                    toast.error(`Could not redeem referral code: ${errorMessage}`, {
                        duration: 4000
                    });
                }
            }
        } catch (error) {
            console.error('Error redeeming referral code:', error);
            toast.error('Network error while redeeming referral code. We\'ll try again later.', {
                duration: 4000
            });
            // Keep the pending code for retry
        }
    }, [connected, address]);

    // Auto-redeem when wallet connects
    useEffect(() => {
        if (connected && address) {
            // Small delay to ensure wallet is fully connected
            const timer = setTimeout(() => {
                redeemPendingReferral();
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [connected, address, redeemPendingReferral]);

    // Utility function to check if there's a pending referral
    const hasPendingReferral = useCallback(() => {
        return !!localStorage.getItem(PENDING_REFERRAL_KEY);
    }, []);

    // Function to manually trigger redemption (for retry scenarios)
    const retryRedemption = useCallback(() => {
        if (connected && address) {
            redeemPendingReferral();
        } else {
            toast.error('Please connect your wallet first');
        }
    }, [connected, address, redeemPendingReferral]);

    return {
        hasPendingReferral,
        retryRedemption
    };
} 