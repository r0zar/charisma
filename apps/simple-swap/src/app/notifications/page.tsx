'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { UserNotificationSettings, ChannelSpecificPreference } from '@/types/notification-settings';
import { signMessage, type SignedMessage } from 'blaze-sdk';
import { Header } from "@/components/layout/header";

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

function NotificationSettingsContent() {
    const { address: userPrincipal, connected } = useWallet();

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
        if (connected && userPrincipal) {
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
    }, [userPrincipal, connected]);

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

    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 py-8 md:py-12">
                <div className="container max-w-6xl">
                    {!connected ? (
                        <div className="flex flex-col items-center justify-center py-16 text-white/40">
                            <div className="relative mb-6">
                                <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                                    <div className="h-8 w-8 text-white/30">🔔</div>
                                </div>
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                            </div>
                            <h3 className="text-lg font-medium text-white/70 mb-2">Connect Your Wallet</h3>
                            <p className="text-sm text-center max-w-md leading-relaxed">
                                Please connect your wallet to manage your notification preferences and receive real-time updates.
                            </p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="h-8 w-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin mb-4" />
                            <p className="text-white/60">Loading your notification settings...</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-3 gap-8">
                            {/* Main Content */}
                            <div className="md:col-span-2">
                                <div className="space-y-8">
                                    {/* Header Section */}
                                    <div className="space-y-4">
                                        <div>
                                            <h1 className="text-3xl font-medium text-white/95 tracking-wide mb-3">Notification Settings</h1>
                                            <p className="text-white/60 max-w-2xl text-base leading-relaxed">
                                                Configure your notification preferences to stay updated on trades, bids, offers, and other important events.
                                            </p>
                                        </div>
                                    </div>
                                    {error && (
                                        <div className="relative p-4 rounded-2xl bg-red-500/[0.08] border border-red-500/[0.15] backdrop-blur-sm overflow-hidden" role="alert">
                                            <div className="absolute inset-0 bg-gradient-to-r from-red-500/[0.02] to-transparent pointer-events-none" />
                                            <div className="relative">
                                                <strong className="font-semibold text-red-400">Error:</strong>
                                                <span className="block sm:inline text-red-300 ml-2">{error}</span>
                                            </div>
                                        </div>
                                    )}
                                    {/* Notification Categories */}
                                    <div className="space-y-6">
                                        {notificationTypes.map(({ category, notifications }) => (
                                            <div key={category} className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                                                <div className="relative">
                                                    <h2 className="text-xl font-semibold text-white/90 mb-6">{category}</h2>
                                                    {notifications.map(({ key, title, description }) => {
                                                        const isPending = pendingToggles.has(key);
                                                        const isDisabled = !userPrincipal || isLoading || isPending;
                                                        return (
                                                            <div key={key} className="py-4 border-b border-white/[0.08] last:border-b-0">
                                                                <div className="flex items-start justify-between mb-4">
                                                                    <div className="flex-1">
                                                                        <h3 className="text-base font-semibold text-white/90">{title}</h3>
                                                                        <p className="text-sm text-white/60 mt-1 leading-relaxed">{description}</p>
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
                                                                                        ? 'bg-white/[0.08] cursor-not-allowed'
                                                                                        : uiToggleState[key]
                                                                                            ? 'bg-blue-500/80 shadow-lg shadow-blue-500/20'
                                                                                            : 'bg-white/[0.12] hover:bg-white/[0.15]'
                                                                                }`}
                                                                                onClick={() => !isDisabled && handleNotificationToggle(key)}
                                                                            >
                                                                                <div className="absolute inset-0 bg-gradient-to-r from-white/[0.05] to-transparent" />
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
                                                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/90 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/20 transition-all duration-200 disabled:opacity-50 backdrop-blur-sm"
                                                                        disabled={isSaving || !userPrincipal}
                                                                    />
                                                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/[0.01] to-transparent pointer-events-none" />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Sidebar */}
                            <div className="md:col-span-1">
                                <div className="sticky top-24 space-y-6">
                                    {/* Setup Instructions */}
                                    <div className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] to-transparent pointer-events-none" />
                                        <div className="relative">
                                            <h3 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 bg-blue-400 rounded-full" />
                                                Setup Guide
                                            </h3>
                                            <div className="text-sm text-white/70 space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1.5 h-1.5 w-1.5 bg-white/40 rounded-full flex-shrink-0" />
                                                    <div>
                                                        <p className="font-medium text-white/80 mb-1">Get Your Chat ID</p>
                                                        <p className="leading-relaxed">
                                                            Message{' '}
                                                            <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors duration-200 underline underline-offset-2">@userinfobot</a>{' '}
                                                            to get your numerical Telegram Chat ID
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1.5 h-1.5 w-1.5 bg-white/40 rounded-full flex-shrink-0" />
                                                    <div>
                                                        <p className="font-medium text-white/80 mb-1">Start Bot Chat</p>
                                                        <p className="leading-relaxed">
                                                            Start a conversation with{' '}
                                                            <a href="https://t.me/BuiltOnBitcoin_bot" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors duration-200 underline underline-offset-2">@BuiltOnBitcoin_bot</a>{' '}
                                                            so it can send you messages
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1.5 h-1.5 w-1.5 bg-white/40 rounded-full flex-shrink-0" />
                                                    <div>
                                                        <p className="font-medium text-white/80 mb-1">Configure Notifications</p>
                                                        <p className="leading-relaxed">
                                                            Enter your Chat ID and toggle the notifications you want to receive
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Status */}
                                    <div className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.02] to-transparent pointer-events-none" />
                                        <div className="relative">
                                            <h3 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 bg-green-400 rounded-full" />
                                                Status
                                            </h3>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white/60">Service:</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                        <span className="text-green-400 font-medium">Active</span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white/60">Notifications:</span>
                                                    <span className="text-white/80 font-medium">{Object.values(uiToggleState).filter(Boolean).length} enabled</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function NotificationsFallback() {
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 py-8 md:py-12">
                <div className="container max-w-6xl">
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="h-8 w-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin mb-4" />
                        <p className="text-white/60">Loading notification settings...</p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function NotificationSettingsPage() {
    return (
        <Suspense fallback={<NotificationsFallback />}>
            <NotificationSettingsContent />
        </Suspense>
    );
} 