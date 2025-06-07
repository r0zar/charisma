import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { UserNotificationSettings, OrderExecutedPreferences, BidEventPreferences, OfferEventPreferences, ChannelSpecificPreference, MemeRouletteSwapPreferences } from '@/types/notification-settings';
import { verifySignatureAndGetSigner, type SignatureVerificationOptions } from 'blaze-sdk';
import { STACKS_MAINNET } from '@stacks/network';

async function getAuthenticatedUserPrincipal(
    request: NextRequest,
    signedMessageOverride?: string // For POST requests, the body will be the message
): Promise<string | null> {
    let messageToVerify = signedMessageOverride;
    if (request.method === 'GET' && !signedMessageOverride) {
        messageToVerify = `GET ${new URL(request.url).pathname}`;
    } else if (!messageToVerify) {
        console.error('No message provided for signature verification for non-GET request.');
        return null;
    }

    const authOptions: SignatureVerificationOptions = {
        message: messageToVerify!,
        network: STACKS_MAINNET, // Assuming mainnet, adjust if necessary
        // headers will use defaults (x-signature, x-public-key)
    };

    const authResult = await verifySignatureAndGetSigner(request as any, authOptions);

    if (authResult.ok) {
        console.log(`Authenticated user: ${authResult.signer}`);
        return authResult.signer;
    } else {
        console.warn(`Authentication failed: ${authResult.error}, Status: ${authResult.status}`);
        return null;
    }
}

const getKvKey = (userPrincipal: string) => `user:${userPrincipal}:notifications`;

const defaultChannelPref: ChannelSpecificPreference = { enabled: false, recipientId: '' };
const defaultOrderExecutedPrefs: OrderExecutedPreferences = {
    telegram: { ...defaultChannelPref },
    discord: { ...defaultChannelPref },
    sms: { ...defaultChannelPref },
};
const defaultBidEventPrefs: BidEventPreferences = {
    telegram: { ...defaultChannelPref },
    discord: { ...defaultChannelPref },
    sms: { ...defaultChannelPref },
};
const defaultOfferEventPrefs: OfferEventPreferences = {
    telegram: { ...defaultChannelPref },
    discord: { ...defaultChannelPref },
    sms: { ...defaultChannelPref },
};
const defaultMemeRouletteSwapPrefs: MemeRouletteSwapPreferences = {
    telegram: { ...defaultChannelPref },
    discord: { ...defaultChannelPref },
    sms: { ...defaultChannelPref },
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userPrincipal = searchParams.get('principal');

    if (!userPrincipal) {
        return NextResponse.json({ error: 'Missing principal query parameter' }, { status: 400 });
    }

    // Validate the principal format if necessary (e.g., using a regex or a Stacks library function)
    // For now, we'll assume it's valid if provided.

    try {
        const settingsKey = getKvKey(userPrincipal);
        let settings = await kv.get<UserNotificationSettings>(settingsKey);

        if (!settings) {
            // Return default settings if none found, ensuring all notification types are defined
            settings = {
                orderExecuted: { ...defaultOrderExecutedPrefs },
                bidReceived: { ...defaultBidEventPrefs },
                bidAccepted: { ...defaultBidEventPrefs },
                bidCancelled: { ...defaultBidEventPrefs },
                offerFilled: { ...defaultOfferEventPrefs },
                offerCancelled: { ...defaultOfferEventPrefs },
                memeRouletteSwap: { ...defaultMemeRouletteSwapPrefs },
            };
        } else {
            // Ensure all notification types exist with defaults if not set
            if (!settings.orderExecuted) {
                settings.orderExecuted = { ...defaultOrderExecutedPrefs };
            } else {
                settings.orderExecuted = {
                    ...defaultOrderExecutedPrefs,
                    ...settings.orderExecuted,
                    telegram: settings.orderExecuted.telegram ? { ...defaultChannelPref, ...settings.orderExecuted.telegram } : { ...defaultChannelPref },
                    discord: settings.orderExecuted.discord ? { ...defaultChannelPref, ...settings.orderExecuted.discord } : { ...defaultChannelPref },
                    sms: settings.orderExecuted.sms ? { ...defaultChannelPref, ...settings.orderExecuted.sms } : { ...defaultChannelPref },
                };
            }

            // Initialize bid event preferences
            ['bidReceived', 'bidAccepted', 'bidCancelled'].forEach(eventType => {
                const key = eventType as keyof Pick<UserNotificationSettings, 'bidReceived' | 'bidAccepted' | 'bidCancelled'>;
                if (!settings![key]) {
                    settings![key] = { ...defaultBidEventPrefs };
                } else {
                    settings![key] = {
                        ...defaultBidEventPrefs,
                        ...settings![key],
                        telegram: settings![key]!.telegram ? { ...defaultChannelPref, ...settings![key]!.telegram } : { ...defaultChannelPref },
                        discord: settings![key]!.discord ? { ...defaultChannelPref, ...settings![key]!.discord } : { ...defaultChannelPref },
                        sms: settings![key]!.sms ? { ...defaultChannelPref, ...settings![key]!.sms } : { ...defaultChannelPref },
                    };
                }
            });

            // Initialize offer event preferences
            ['offerFilled', 'offerCancelled'].forEach(eventType => {
                const key = eventType as keyof Pick<UserNotificationSettings, 'offerFilled' | 'offerCancelled'>;
                if (!settings![key]) {
                    settings![key] = { ...defaultOfferEventPrefs };
                } else {
                    settings![key] = {
                        ...defaultOfferEventPrefs,
                        ...settings![key],
                        telegram: settings![key]!.telegram ? { ...defaultChannelPref, ...settings![key]!.telegram } : { ...defaultChannelPref },
                        discord: settings![key]!.discord ? { ...defaultChannelPref, ...settings![key]!.discord } : { ...defaultChannelPref },
                        sms: settings![key]!.sms ? { ...defaultChannelPref, ...settings![key]!.sms } : { ...defaultChannelPref },
                    };
                }
            });

            // Initialize memeRouletteSwap preferences
            if (!settings.memeRouletteSwap) {
                settings.memeRouletteSwap = { ...defaultMemeRouletteSwapPrefs };
            } else {
                settings.memeRouletteSwap = {
                    ...defaultMemeRouletteSwapPrefs,
                    ...settings.memeRouletteSwap,
                    telegram: settings.memeRouletteSwap.telegram ? { ...defaultChannelPref, ...settings.memeRouletteSwap.telegram } : { ...defaultChannelPref },
                    discord: settings.memeRouletteSwap.discord ? { ...defaultChannelPref, ...settings.memeRouletteSwap.discord } : { ...defaultChannelPref },
                    sms: settings.memeRouletteSwap.sms ? { ...defaultChannelPref, ...settings.memeRouletteSwap.sms } : { ...defaultChannelPref },
                };
            }
        }
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error fetching notification settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    // For POST, the message signed should be the raw request body.
    // We need to clone the request to read the body as text first for signature verification,
    // and then read it as JSON for processing.
    const requestClone = request.clone();
    const rawBody = await requestClone.text();

    const userPrincipal = await getAuthenticatedUserPrincipal(request, rawBody);
    if (!userPrincipal) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Now parse the original request body as JSON
        const body = await request.json() as Partial<UserNotificationSettings>;
        const settingsKey = getKvKey(userPrincipal);

        let currentSettings = await kv.get<UserNotificationSettings>(settingsKey);
        if (!currentSettings) {
            currentSettings = {
                orderExecuted: { ...defaultOrderExecutedPrefs },
                bidReceived: { ...defaultBidEventPrefs },
                bidAccepted: { ...defaultBidEventPrefs },
                bidCancelled: { ...defaultBidEventPrefs },
                offerFilled: { ...defaultOfferEventPrefs },
                offerCancelled: { ...defaultOfferEventPrefs },
                memeRouletteSwap: { ...defaultMemeRouletteSwapPrefs },
            };
        }

        // Ensure all parts are initialized if they don't exist
        if (!currentSettings.orderExecuted) {
            currentSettings.orderExecuted = { ...defaultOrderExecutedPrefs };
        }
        currentSettings.orderExecuted = {
            ...defaultOrderExecutedPrefs,
            ...currentSettings.orderExecuted,
            telegram: currentSettings.orderExecuted?.telegram ? { ...defaultChannelPref, ...currentSettings.orderExecuted.telegram } : { ...defaultChannelPref },
            discord: currentSettings.orderExecuted?.discord ? { ...defaultChannelPref, ...currentSettings.orderExecuted.discord } : { ...defaultChannelPref },
            sms: currentSettings.orderExecuted?.sms ? { ...defaultChannelPref, ...currentSettings.orderExecuted.sms } : { ...defaultChannelPref },
        };

        // Initialize bid event preferences if they don't exist
        ['bidReceived', 'bidAccepted', 'bidCancelled'].forEach(eventType => {
            const key = eventType as keyof Pick<UserNotificationSettings, 'bidReceived' | 'bidAccepted' | 'bidCancelled'>;
            if (!currentSettings![key]) {
                currentSettings![key] = { ...defaultBidEventPrefs };
            } else {
                currentSettings![key] = {
                    ...defaultBidEventPrefs,
                    ...currentSettings![key],
                    telegram: currentSettings![key]!.telegram ? { ...defaultChannelPref, ...currentSettings![key]!.telegram } : { ...defaultChannelPref },
                    discord: currentSettings![key]!.discord ? { ...defaultChannelPref, ...currentSettings![key]!.discord } : { ...defaultChannelPref },
                    sms: currentSettings![key]!.sms ? { ...defaultChannelPref, ...currentSettings![key]!.sms } : { ...defaultChannelPref },
                };
            }
        });

        // Initialize offer event preferences if they don't exist
        ['offerFilled', 'offerCancelled'].forEach(eventType => {
            const key = eventType as keyof Pick<UserNotificationSettings, 'offerFilled' | 'offerCancelled'>;
            if (!currentSettings![key]) {
                currentSettings![key] = { ...defaultOfferEventPrefs };
            } else {
                currentSettings![key] = {
                    ...defaultOfferEventPrefs,
                    ...currentSettings![key],
                    telegram: currentSettings![key]!.telegram ? { ...defaultChannelPref, ...currentSettings![key]!.telegram } : { ...defaultChannelPref },
                    discord: currentSettings![key]!.discord ? { ...defaultChannelPref, ...currentSettings![key]!.discord } : { ...defaultChannelPref },
                    sms: currentSettings![key]!.sms ? { ...defaultChannelPref, ...currentSettings![key]!.sms } : { ...defaultChannelPref },
                };
            }
        });

        // Initialize memeRouletteSwap preferences if they don't exist
        if (!currentSettings.memeRouletteSwap) {
            currentSettings.memeRouletteSwap = { ...defaultMemeRouletteSwapPrefs };
        }
        currentSettings.memeRouletteSwap = {
            ...defaultMemeRouletteSwapPrefs,
            ...currentSettings.memeRouletteSwap,
            telegram: currentSettings.memeRouletteSwap?.telegram ? { ...defaultChannelPref, ...currentSettings.memeRouletteSwap.telegram } : { ...defaultChannelPref },
            discord: currentSettings.memeRouletteSwap?.discord ? { ...defaultChannelPref, ...currentSettings.memeRouletteSwap.discord } : { ...defaultChannelPref },
            sms: currentSettings.memeRouletteSwap?.sms ? { ...defaultChannelPref, ...currentSettings.memeRouletteSwap.sms } : { ...defaultChannelPref },
        };

        const newSettings: UserNotificationSettings = JSON.parse(JSON.stringify(currentSettings)); // Deep clone

        // Update orderExecuted settings if provided in the body
        if (body.orderExecuted) {
            const orderPrefs = body.orderExecuted;
            if (orderPrefs.telegram !== undefined) {
                newSettings.orderExecuted!.telegram = { ...newSettings.orderExecuted!.telegram, ...orderPrefs.telegram };
            }
            if (orderPrefs.discord !== undefined) {
                newSettings.orderExecuted!.discord = { ...newSettings.orderExecuted!.discord, ...orderPrefs.discord };
            }
            if (orderPrefs.sms !== undefined) {
                newSettings.orderExecuted!.sms = { ...newSettings.orderExecuted!.sms, ...orderPrefs.sms };
            }
        }

        // Update bid event settings if provided in the body
        ['bidReceived', 'bidAccepted', 'bidCancelled'].forEach(eventType => {
            const key = eventType as keyof Pick<UserNotificationSettings, 'bidReceived' | 'bidAccepted' | 'bidCancelled'>;
            if (body[key]) {
                const eventPrefs = body[key]!;
                if (eventPrefs.telegram !== undefined) {
                    newSettings[key]!.telegram = { ...newSettings[key]!.telegram, ...eventPrefs.telegram };
                }
                if (eventPrefs.discord !== undefined) {
                    newSettings[key]!.discord = { ...newSettings[key]!.discord, ...eventPrefs.discord };
                }
                if (eventPrefs.sms !== undefined) {
                    newSettings[key]!.sms = { ...newSettings[key]!.sms, ...eventPrefs.sms };
                }
            }
        });

        // Update offer event settings if provided in the body
        ['offerFilled', 'offerCancelled'].forEach(eventType => {
            const key = eventType as keyof Pick<UserNotificationSettings, 'offerFilled' | 'offerCancelled'>;
            if (body[key]) {
                const eventPrefs = body[key]!;
                if (eventPrefs.telegram !== undefined) {
                    newSettings[key]!.telegram = { ...newSettings[key]!.telegram, ...eventPrefs.telegram };
                }
                if (eventPrefs.discord !== undefined) {
                    newSettings[key]!.discord = { ...newSettings[key]!.discord, ...eventPrefs.discord };
                }
                if (eventPrefs.sms !== undefined) {
                    newSettings[key]!.sms = { ...newSettings[key]!.sms, ...eventPrefs.sms };
                }
            }
        });

        // Update memeRouletteSwap settings if provided in the body
        if (body.memeRouletteSwap) {
            const memePrefs = body.memeRouletteSwap;
            if (memePrefs.telegram !== undefined) {
                newSettings.memeRouletteSwap!.telegram = { ...newSettings.memeRouletteSwap!.telegram, ...memePrefs.telegram };
            }
            if (memePrefs.discord !== undefined) {
                newSettings.memeRouletteSwap!.discord = { ...newSettings.memeRouletteSwap!.discord, ...memePrefs.discord };
            }
            if (memePrefs.sms !== undefined) {
                newSettings.memeRouletteSwap!.sms = { ...newSettings.memeRouletteSwap!.sms, ...memePrefs.sms };
            }
        }

        await kv.set(settingsKey, newSettings);
        return NextResponse.json(newSettings);
    } catch (error) {
        console.error('Error updating notification settings:', error);
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
} 