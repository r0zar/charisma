'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { UserNotificationSettings, ChannelSpecificPreference } from '@/types/notification-settings';
import { signMessage, type SignedMessage } from 'blaze-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

// Helper to get default channel preference to avoid repetition
const getDefaultChannelPref = (): ChannelSpecificPreference => ({ enabled: false, recipientId: '' });

async function fetchNotificationSettingsApi(stxAddress: string): Promise<UserNotificationSettings> {
    const response = await fetch(`/api/notifications/settings?principal=${stxAddress}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }
    return response.json();
}

interface WalletSigner {
    signFunction: (message: string) => Promise<SignedMessage>;
}

async function saveNotificationSettingsApi(
    settings: Partial<UserNotificationSettings>,
    signerDetails: WalletSigner
): Promise<UserNotificationSettings> {
    const messageToSign = JSON.stringify(settings);
    const signedData: SignedMessage = await signerDetails.signFunction(messageToSign);

    const response = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-signature': signedData.signature,
            'x-public-key': signedData.publicKey,
        },
        body: messageToSign,
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to save settings: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }
    return response.json();
}

interface NotificationUIToggleState {
    orderExecuted: boolean;
    bidReceived: boolean;
    bidAccepted: boolean;
    bidCancelled: boolean;
    offerFilled: boolean;
    offerCancelled: boolean;
    memeRouletteSwap: boolean;
}

interface NotificationRecipientIDs {
    orderExecuted?: string;
    bidReceived?: string;
    bidAccepted?: string;
    bidCancelled?: string;
    offerFilled?: string;
    offerCancelled?: string;
    memeRouletteSwap?: string;
}

export default function NotificationsSettings() {
    const { address: userPrincipal } = useWallet();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [pendingToggles, setPendingToggles] = useState<Set<keyof NotificationUIToggleState>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const [uiToggleState, setUiToggleState] = useState<NotificationUIToggleState>({
        orderExecuted: false,
        bidReceived: false,
        bidAccepted: false,
        bidCancelled: false,
        offerFilled: false,
        offerCancelled: false,
        memeRouletteSwap: false,
    });
    const [recipientIds, setRecipientIds] = useState<NotificationRecipientIDs>({});

    const loadSettings = useCallback(async () => {
        if (userPrincipal) {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedSettings = await fetchNotificationSettingsApi(userPrincipal);

                setUiToggleState({
                    orderExecuted: fetchedSettings.orderExecuted?.telegram?.enabled || false,
                    bidReceived: fetchedSettings.bidReceived?.telegram?.enabled || false,
                    bidAccepted: fetchedSettings.bidAccepted?.telegram?.enabled || false,
                    bidCancelled: fetchedSettings.bidCancelled?.telegram?.enabled || false,
                    offerFilled: fetchedSettings.offerFilled?.telegram?.enabled || false,
                    offerCancelled: fetchedSettings.offerCancelled?.telegram?.enabled || false,
                    memeRouletteSwap: fetchedSettings.memeRouletteSwap?.telegram?.enabled || false,
                });

                setRecipientIds({
                    orderExecuted: fetchedSettings.orderExecuted?.telegram?.recipientId,
                    bidReceived: fetchedSettings.bidReceived?.telegram?.recipientId,
                    bidAccepted: fetchedSettings.bidAccepted?.telegram?.recipientId,
                    bidCancelled: fetchedSettings.bidCancelled?.telegram?.recipientId,
                    offerFilled: fetchedSettings.offerFilled?.telegram?.recipientId,
                    offerCancelled: fetchedSettings.offerCancelled?.telegram?.recipientId,
                    memeRouletteSwap: fetchedSettings.memeRouletteSwap?.telegram?.recipientId,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load settings');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
    }, [userPrincipal]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const buildSettingsPayload = (notificationType: keyof NotificationUIToggleState): Partial<UserNotificationSettings> => {
        const payload: Partial<UserNotificationSettings> = {};

        payload[notificationType] = {
            telegram: {
                enabled: uiToggleState[notificationType],
                recipientId: uiToggleState[notificationType] ? (recipientIds[notificationType] || '') : '',
            },
        };

        return payload;
    };

    const saveSettings = async (settingsToSave: Partial<UserNotificationSettings>) => {
        if (!userPrincipal) {
            setError("Wallet not connected. Please connect your wallet.");
            return false;
        }
        setIsSaving(true);
        setError(null);
        try {
            const signerDetails: WalletSigner = {
                signFunction: (message: string) => signMessage(message),
            };
            const saved = await saveNotificationSettingsApi(settingsToSave, signerDetails);

            // Update recipient IDs from saved settings
            Object.keys(saved).forEach(key => {
                const notifKey = key as keyof UserNotificationSettings;
                if (saved[notifKey] && typeof saved[notifKey] === 'object' && 'telegram' in saved[notifKey]!) {
                    setRecipientIds(prev => ({
                        ...prev,
                        [notifKey]: (saved[notifKey] as any).telegram?.recipientId || '',
                    }));
                }
            });

            console.log('Settings saved successfully.');
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save settings');
            console.error('Failed to save settings:', err);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleNotificationToggle = async (notificationType: keyof NotificationUIToggleState) => {
        // Immediately update UI for responsive feedback
        const newState = !uiToggleState[notificationType];
        setUiToggleState(prev => ({ ...prev, [notificationType]: newState }));

        // Mark this toggle as pending
        setPendingToggles(prev => new Set(prev).add(notificationType));

        // Add a small delay to let the user see the visual change
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const settingsToSave = {
                [notificationType]: {
                    telegram: {
                        enabled: newState,
                        recipientId: newState ? (recipientIds[notificationType] || '') : '',
                    },
                }
            };

            const success = await saveSettings(settingsToSave);

            if (!success) {
                // Revert the toggle state if save failed
                setUiToggleState(prev => ({ ...prev, [notificationType]: !newState }));
            }
        } catch (err) {
            // Revert the toggle state on error
            setUiToggleState(prev => ({ ...prev, [notificationType]: !newState }));
            console.error('Toggle save failed:', err);
        } finally {
            // Remove from pending set
            setPendingToggles(prev => {
                const newSet = new Set(prev);
                newSet.delete(notificationType);
                return newSet;
            });
        }
    };

    const handleRecipientIdChange = (notificationType: keyof NotificationRecipientIDs, value: string) => {
        setRecipientIds(prev => ({ ...prev, [notificationType]: value }));
    };

    const handleRecipientIdSave = async (notificationType: keyof NotificationRecipientIDs) => {
        if (uiToggleState[notificationType]) {
            console.log(`Saving recipient ID for ${notificationType}: ${recipientIds[notificationType]}`);
            const settingsToSave = buildSettingsPayload(notificationType);
            await saveSettings(settingsToSave);
        } else {
            console.log(`Recipient ID for ${notificationType} not saved as notification is disabled.`);
        }
    };

    // Notification type configurations
    const notificationTypes = [
        {
            category: "Trade Execution",
            notifications: [
                {
                    key: 'orderExecuted' as keyof NotificationUIToggleState,
                    title: "Order Executed",
                    description: "Get notified when your trade order is successfully executed"
                }
            ]
        },
        {
            category: "Bid Events",
            notifications: [
                {
                    key: 'bidReceived' as keyof NotificationUIToggleState,
                    title: "Bid Received",
                    description: "Get notified when someone places a bid on your offer"
                },
                {
                    key: 'bidAccepted' as keyof NotificationUIToggleState,
                    title: "Bid Accepted",
                    description: "Get notified when your bid gets accepted by an offer creator"
                },
                {
                    key: 'bidCancelled' as keyof NotificationUIToggleState,
                    title: "Bid Cancelled",
                    description: "Get notified when a bid on your offer gets cancelled"
                }
            ]
        },
        {
            category: "Offer Events",
            notifications: [
                {
                    key: 'offerFilled' as keyof NotificationUIToggleState,
                    title: "Offer Filled",
                    description: "Get notified when an offer you're watching gets filled"
                },
                {
                    key: 'offerCancelled' as keyof NotificationUIToggleState,
                    title: "Offer Cancelled",
                    description: "Get notified when an offer you're watching gets cancelled"
                }
            ]
        },
        {
            category: "Meme Roulette",
            notifications: [
                {
                    key: 'memeRouletteSwap' as keyof NotificationUIToggleState,
                    title: "Meme Roulette Swap",
                    description: "Get notified when your Meme Roulette swap is processed"
                }
            ]
        }
    ];

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground">Loading your notification settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Description */}
            <div>
                <p className="text-muted-foreground text-sm mb-4">
                    Configure your notification preferences to stay updated on trades, bids, offers, and other important events.
                </p>
            </div>

            {error && (
                <Card className="bg-red-500/10 border-red-500/30">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="text-red-400 mt-0.5">⚠️</div>
                            <div>
                                <h4 className="text-red-400 font-semibold">Error</h4>
                                <p className="text-red-300/80 text-sm">{error}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid md:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                    {/* Notification Categories */}
                    {notificationTypes.map(({ category, notifications }) => (
                        <Card key={category} className="bg-background/30 border-border">
                            <CardHeader>
                                <CardTitle className="text-foreground text-lg">{category}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {notifications.map(({ key, title, description }) => {
                                    const isPending = pendingToggles.has(key);
                                    const isDisabled = !userPrincipal || isLoading || isPending;
                                    return (
                                        <div key={key} className="py-4 border-b border-border last:border-b-0">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <h3 className="text-base font-semibold text-foreground">{title}</h3>
                                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
                                                    {isPending && (
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <div className="h-3 w-3 border-2 border-blue-400/60 border-t-blue-400 rounded-full animate-spin" />
                                                            <span className="text-xs text-blue-400">Saving changes...</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center ml-6">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            id={`${key}Toggle`}
                                                            className="sr-only"
                                                            checked={uiToggleState[key]}
                                                            onChange={() => handleNotificationToggle(key)}
                                                            disabled={isDisabled}
                                                        />
                                                        <div
                                                            className={`relative w-12 h-6 rounded-full transition-all duration-200 cursor-pointer overflow-hidden ${
                                                                isDisabled
                                                                    ? 'bg-muted cursor-not-allowed'
                                                                    : uiToggleState[key]
                                                                        ? 'bg-blue-500/80 shadow-lg shadow-blue-500/20'
                                                                        : 'bg-muted-foreground/20 hover:bg-muted-foreground/30'
                                                            }`}
                                                            onClick={() => !isDisabled && handleNotificationToggle(key)}
                                                        >
                                                            <div className="absolute inset-0 bg-gradient-to-r from-background/5 to-transparent" />
                                                        </div>
                                                        <div
                                                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 pointer-events-none ${
                                                                uiToggleState[key] ? 'transform translate-x-6' : ''
                                                            } ${isPending ? 'animate-pulse' : ''}`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Enter numerical Telegram Chat ID"
                                                    value={recipientIds[key] || ''}
                                                    onChange={(e) => handleRecipientIdChange(key, e.target.value)}
                                                    onBlur={() => handleRecipientIdSave(key)}
                                                    className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/20 transition-all duration-200 disabled:opacity-50"
                                                    disabled={isSaving || !userPrincipal}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    ))}
                </div>
                
                {/* Sidebar */}
                <div className="md:col-span-1">
                    <div className="space-y-6">
                        {/* Setup Instructions */}
                        <Card className="bg-blue-500/5 border-blue-500/20">
                            <CardHeader>
                                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 bg-blue-400 rounded-full" />
                                    Setup Guide
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1.5 h-1.5 w-1.5 bg-muted-foreground rounded-full flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-foreground mb-1">Get Your Chat ID</p>
                                            <p className="leading-relaxed">
                                                Message{' '}
                                                <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors duration-200 underline underline-offset-2 inline-flex items-center gap-1">
                                                    @userinfobot
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>{' '}
                                                to get your numerical Telegram Chat ID
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1.5 h-1.5 w-1.5 bg-muted-foreground rounded-full flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-foreground mb-1">Start Bot Chat</p>
                                            <p className="leading-relaxed">
                                                Start a conversation with{' '}
                                                <a href="https://t.me/BuiltOnBitcoin_bot" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors duration-200 underline underline-offset-2 inline-flex items-center gap-1">
                                                    @BuiltOnBitcoin_bot
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>{' '}
                                                so it can send you messages
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1.5 h-1.5 w-1.5 bg-muted-foreground rounded-full flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-foreground mb-1">Configure Notifications</p>
                                            <p className="leading-relaxed">
                                                Enter your Chat ID and toggle the notifications you want to receive
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        {/* Status */}
                        <Card className="bg-green-500/5 border-green-500/20">
                            <CardHeader>
                                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 bg-green-400 rounded-full" />
                                    Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Service:</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            <span className="text-green-400 font-medium">Active</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Notifications:</span>
                                        <span className="text-foreground font-medium">{Object.values(uiToggleState).filter(Boolean).length} enabled</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}