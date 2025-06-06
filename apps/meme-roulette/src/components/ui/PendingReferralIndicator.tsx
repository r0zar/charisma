'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/wallet-context';
import { Gift, Wallet, X } from 'lucide-react';

const PENDING_REFERRAL_KEY = 'pending_referral_code';
const INDICATOR_DISMISSED_KEY = 'referral_indicator_dismissed';

export function PendingReferralIndicator() {
    const { connected, connectWallet } = useWallet();
    const [showIndicator, setShowIndicator] = useState(false);
    const [pendingCode, setPendingCode] = useState<string | null>(null);

    useEffect(() => {
        const checkPendingReferral = () => {
            const pending = localStorage.getItem(PENDING_REFERRAL_KEY);
            const dismissed = localStorage.getItem(INDICATOR_DISMISSED_KEY);

            if (pending && !connected && !dismissed) {
                setPendingCode(pending);
                setShowIndicator(true);
            } else {
                setShowIndicator(false);
            }
        };

        checkPendingReferral();

        // Check periodically in case localStorage changes
        const interval = setInterval(checkPendingReferral, 2000);

        return () => clearInterval(interval);
    }, [connected]);

    const handleDismiss = () => {
        localStorage.setItem(INDICATOR_DISMISSED_KEY, 'true');
        setShowIndicator(false);
    };

    const handleConnectWallet = () => {
        connectWallet();
    };

    if (!showIndicator || !pendingCode) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
            <Card className="border-primary/30 bg-primary/5 backdrop-blur-md shadow-lg">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 bg-primary/20 rounded-full p-2">
                            <Gift className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm mb-1 text-foreground">
                                Referral Code Ready! 🎁
                            </h4>
                            <p className="text-xs text-muted-foreground mb-3">
                                Connect your wallet to claim your referral code: <span className="font-mono text-primary">{pendingCode}</span>
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleConnectWallet}
                                    size="sm"
                                    className="text-xs"
                                >
                                    <Wallet className="h-3 w-3 mr-1" />
                                    Connect Wallet
                                </Button>
                                <Button
                                    onClick={handleDismiss}
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs p-2"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 