'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Twitter } from 'lucide-react';
import { useWallet } from '@/contexts/wallet-context';

interface TwitterShareButtonProps {
    message: string;
    hashtags?: string[];
    size?: 'sm' | 'default' | 'lg';
    variant?: 'default' | 'outline' | 'ghost';
    className?: string;
    showIcon?: boolean;
}

export function TwitterShareButton({
    message,
    hashtags = ['MemeRoulette', 'Charisma'],
    size = 'sm',
    variant = 'outline',
    className = '',
    showIcon = true
}: TwitterShareButtonProps) {
    const { connected, address } = useWallet();

    const shareToTwitter = async () => {
        let tweetText = message;
        let referralLink = window.location.origin;

        // Try to get user's referral code if connected
        if (connected && address) {
            try {
                const response = await fetch('/api/referrals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'stats',
                        userId: address
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data.referralCodes.length > 0) {
                        const referralCode = result.data.referralCodes[0].code;
                        referralLink = `${window.location.origin}?ref=${referralCode}`;
                        tweetText += ` Try it yourself: `;
                    }
                }
            } catch (error) {
                console.log('Could not load referral code');
            }
        }

        const hashtagString = hashtags.length > 0 ? `&hashtags=${hashtags.join(',')}` : '';
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(referralLink)}${hashtagString}`;

        window.open(twitterUrl, '_blank', 'width=600,height=400');
    };

    return (
        <Button
            onClick={shareToTwitter}
            size={size}
            variant={variant}
            className={`${className}`}
        >
            {showIcon && <Twitter className="h-4 w-4 mr-2" />}
            Share
        </Button>
    );
} 