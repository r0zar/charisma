'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { UserNotificationSettings, OrderExecutedPreferences, BidEventPreferences, OfferEventPreferences, ChannelSpecificPreference } from '@/types/notification-settings';
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
}

interface NotificationRecipientIDs {
    orderExecuted?: string;
    bidReceived?: string;
    bidAccepted?: string;
    bidCancelled?: string;
    offerFilled?: string;
    offerCancelled?: string;
}

export default function NotificationSettingsPage() {
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
                });

                setRecipientIds({
                    orderExecuted: fetchedSettings.orderExecuted?.telegram?.recipientId,
                    bidReceived: fetchedSettings.bidReceived?.telegram?.recipientId,
                    bidAccepted: fetchedSettings.bidAccepted?.telegram?.recipientId,
                    bidCancelled: fetchedSettings.bidCancelled?.telegram?.recipientId,
                    offerFilled: fetchedSettings.offerFilled?.telegram?.recipientId,
                    offerCancelled: fetchedSettings.offerCancelled?.telegram?.recipientId,
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
        }
    ];

    if (!connected) {
        return (
            <div className="container mx-auto p-4 max-w-2xl text-center">
                <p className="text-lg text-gray-600">Please connect your wallet to manage notification settings.</p>
            </div>
        );
    }

    if (isLoading) {
        return <div className="container mx-auto p-4 max-w-2xl text-center"><p>Loading settings...</p></div>;
    }

    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <main className="container flex-1 py-8">
                <div className="container mx-auto p-4 max-w-2xl">
                    <h1 className="text-3xl font-bold mb-8 text-center">Notification Settings</h1>

                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                            <strong className="font-bold">Error:</strong>
                            <span className="block sm:inline"> {error}</span>
                        </div>
                    )}

                    <div className="space-y-6">
                        {notificationTypes.map(({ category, notifications }) => (
                            <div key={category} className="bg-card shadow-md rounded-lg p-6">
                                <h2 className="text-xl font-semibold mb-4">{category}</h2>

                                {notifications.map(({ key, title, description }) => {
                                    const isPending = pendingToggles.has(key);
                                    const isDisabled = !userPrincipal || isLoading || isPending;

                                    return (
                                        <div key={key} className="py-3 border-b last:border-b-0">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h3 className="text-md font-medium">{title}</h3>
                                                    <p className="text-sm text-gray-500 mt-1">{description}</p>
                                                    {isPending && (
                                                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                                            <span className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></span>
                                                            Saving...
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center ml-4">
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
                                                            className={`block w-12 h-7 rounded-full transition-colors cursor-pointer ${isDisabled
                                                                ? 'bg-gray-200 cursor-not-allowed'
                                                                : uiToggleState[key]
                                                                    ? 'bg-blue-600'
                                                                    : 'bg-gray-300'
                                                                }`}
                                                            onClick={() => !isDisabled && handleNotificationToggle(key)}
                                                        ></div>
                                                        <div
                                                            className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform pointer-events-none ${uiToggleState[key] ? 'transform translate-x-5' : ''
                                                                } ${isPending ? 'animate-pulse' : ''}`}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="text"
                                                    placeholder="Enter numerical Telegram Chat ID"
                                                    value={recipientIds[key] || ''}
                                                    onChange={(e) => handleRecipientIdChange(key, e.target.value)}
                                                    onBlur={() => handleRecipientIdSave(key)}
                                                    className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                    disabled={isSaving || !userPrincipal}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Setup Instructions</h3>
                            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-2">
                                <p>
                                    <strong>Step 1:</strong> Get your numerical Telegram Chat ID by messaging{' '}
                                    <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@userinfobot</a>
                                </p>
                                <p>
                                    <strong>Step 2:</strong> Start a chat with our notification bot{' '}
                                    <a href="https://t.me/BuiltOnBitcoin_bot" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@BuiltOnBitcoin_bot</a>{' '}
                                    so it can send you messages
                                </p>
                                <p>
                                    <strong>Step 3:</strong> Enter your Chat ID above and enable the notifications you want to receive
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 