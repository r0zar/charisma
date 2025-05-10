'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { UserNotificationSettings, OrderExecutedPreferences, ChannelSpecificPreference } from '@/types/notification-settings';
import { signMessage, type SignedMessage } from '@repo/stacks';

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

interface OrderExecutedChannelUIToggleState {
    telegram: boolean;
    // discord: boolean;
    // sms: boolean;
}

interface OrderExecutedChannelRecipientIDs {
    telegram?: string;
    // discord?: string;
    // sms?: string;
}

export default function NotificationSettingsPage() {
    const { address: userPrincipal, connected } = useWallet();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [uiToggleState, setUiToggleState] = useState<OrderExecutedChannelUIToggleState>({
        telegram: false,
        // discord: false,
        // sms: false,
    });
    const [recipientIds, setRecipientIds] = useState<OrderExecutedChannelRecipientIDs>({});

    const loadSettings = useCallback(async () => {
        if (connected && userPrincipal) {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedSettings = await fetchNotificationSettingsApi(userPrincipal);
                const prefs = fetchedSettings.orderExecuted || { telegram: getDefaultChannelPref(), discord: getDefaultChannelPref(), sms: getDefaultChannelPref() };
                setUiToggleState({
                    telegram: prefs.telegram?.enabled || false,
                    // discord: prefs.discord?.enabled || false,
                    // sms: prefs.sms?.enabled || false,
                });
                setRecipientIds({
                    telegram: prefs.telegram?.recipientId,
                    // discord: prefs.discord?.recipientId,
                    // sms: prefs.sms?.recipientId,
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

    const buildSettingsPayload = (): Partial<UserNotificationSettings> => {
        return {
            orderExecuted: {
                telegram: {
                    enabled: uiToggleState.telegram,
                    recipientId: uiToggleState.telegram ? (recipientIds.telegram || '') : '',
                },
                // discord: {
                //     enabled: uiToggleState.discord,
                //     recipientId: uiToggleState.discord ? (recipientIds.discord || '') : '',
                // },
                // sms: {
                //     enabled: uiToggleState.sms,
                //     recipientId: uiToggleState.sms ? (recipientIds.sms || '') : '',
                // },
            },
        };
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
            if (saved.orderExecuted) {
                setRecipientIds({
                    telegram: saved.orderExecuted.telegram?.recipientId || '',
                    // discord: saved.orderExecuted.discord?.recipientId || '',
                    // sms: saved.orderExecuted.sms?.recipientId || '',
                });
            }
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

    const handleChannelToggle = async (channelKey: keyof OrderExecutedChannelUIToggleState) => {
        const newUiState = { ...uiToggleState, [channelKey]: !uiToggleState[channelKey] };
        setUiToggleState(newUiState);

        const settingsToSave = {
            orderExecuted: {
                telegram: {
                    enabled: newUiState.telegram,
                    recipientId: newUiState.telegram ? (recipientIds.telegram || '') : '',
                },
                // discord: {
                //     enabled: newUiState.discord,
                //     recipientId: newUiState.discord ? (recipientIds.discord || '') : '',
                // },
                // sms: {
                //     enabled: newUiState.sms,
                //     recipientId: newUiState.sms ? (recipientIds.sms || '') : '',
                // },
            },
        };

        const success = await saveSettings(settingsToSave);
        if (!success) {
            setUiToggleState(prev => ({ ...prev, [channelKey]: !prev[channelKey] }));
        }
    };

    const handleRecipientIdChange = (channelKey: keyof OrderExecutedChannelRecipientIDs, value: string) => {
        setRecipientIds(prev => ({ ...prev, [channelKey]: value }));
    };

    const handleRecipientIdSave = async (channelKey: keyof OrderExecutedChannelRecipientIDs) => {
        if (uiToggleState[channelKey]) {
            console.log(`Saving recipient ID for ${channelKey}: ${recipientIds[channelKey]}`);
            const settingsToSave = buildSettingsPayload();
            await saveSettings(settingsToSave);
        } else {
            console.log(`Recipient ID for ${channelKey} not saved as channel is disabled.`);
        }
    };

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
        <div className="container mx-auto p-4 max-w-2xl">
            <h1 className="text-3xl font-bold mb-8 text-center">Notification Settings</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Error:</strong>
                    <span className="block sm:inline"> {error}</span>
                </div>
            )}

            <div className="bg-card shadow-md rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Order Executed Notifications</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Receive a notification when your trade order is successfully executed via your preferred channels.
                </p>

                {Object.keys(uiToggleState).map((channel) => {
                    const channelTyped = channel as keyof OrderExecutedChannelUIToggleState;
                    const recipientIdKey = channelTyped as keyof OrderExecutedChannelRecipientIDs;
                    return (
                        <div key={channelTyped} className="py-3 border-b last:border-b-0">
                            <div className="flex items-center justify-between">
                                <span className="text-md capitalize">{channelTyped}</span>
                                <label htmlFor={`${channelTyped}Toggle`} className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            id={`${channelTyped}Toggle`}
                                            className="sr-only"
                                            checked={uiToggleState[channelTyped]}
                                            onChange={() => handleChannelToggle(channelTyped)}
                                            disabled={!userPrincipal || isLoading || isSaving}
                                        />
                                        <div className={`block w-12 h-7 rounded-full transition-colors ${uiToggleState[channelTyped] ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                                        <div
                                            className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${uiToggleState[channelTyped] ? 'transform translate-x-5' : ''}`}
                                        ></div>
                                    </div>
                                </label>
                            </div>
                            <div className="mt-3 flex items-center">
                                <input
                                    type="text"
                                    placeholder={channelTyped === 'telegram' ? "Enter numerical Telegram Chat ID" : `Enter ${channelTyped} ID / Number`}
                                    value={recipientIds[recipientIdKey] || ''}
                                    onChange={(e) => handleRecipientIdChange(recipientIdKey, e.target.value)}
                                    onBlur={() => handleRecipientIdSave(recipientIdKey)}
                                    className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    disabled={isSaving || !userPrincipal}
                                />
                            </div>
                            {channelTyped === 'telegram' && (
                                <div className="mt-2 text-xs text-gray-500 space-y-1">
                                    <p>
                                        To get your <strong>numerical Telegram Chat ID</strong>:
                                        Search for <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@userinfobot</a> on Telegram and start a chat with it. It will reply with your ID.
                                    </p>
                                    <p>
                                        <strong>Important:</strong> You also need to start a chat with our notification bot, <a href="https://t.me/BuiltOnBitcoin_bot" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@BuiltOnBitcoin_bot</a>, so it has permission to send you messages.
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
} 