import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { UserNotificationSettings, OrderExecutedPreferences, ChannelSpecificPreference } from '@/types/notification-settings';
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
            // Return default settings if none found, ensuring all channels are defined
            settings = { orderExecuted: { ...defaultOrderExecutedPrefs } };
        } else if (!settings.orderExecuted) {
            settings.orderExecuted = { ...defaultOrderExecutedPrefs };
        } else {
            // Ensure all channel preferences exist with defaults if not set
            settings.orderExecuted = {
                ...defaultOrderExecutedPrefs,
                ...settings.orderExecuted,
                telegram: settings.orderExecuted.telegram ? { ...defaultChannelPref, ...settings.orderExecuted.telegram } : { ...defaultChannelPref },
                discord: settings.orderExecuted.discord ? { ...defaultChannelPref, ...settings.orderExecuted.discord } : { ...defaultChannelPref },
                sms: settings.orderExecuted.sms ? { ...defaultChannelPref, ...settings.orderExecuted.sms } : { ...defaultChannelPref },
            };
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
        if (!currentSettings || !currentSettings.orderExecuted) {
            currentSettings = { orderExecuted: { ...defaultOrderExecutedPrefs } };
        }
        // Ensure all parts of orderExecuted are initialized if they don't exist
        currentSettings.orderExecuted = {
            ...defaultOrderExecutedPrefs,
            ...currentSettings.orderExecuted,
            telegram: currentSettings.orderExecuted?.telegram ? { ...defaultChannelPref, ...currentSettings.orderExecuted.telegram } : { ...defaultChannelPref },
            discord: currentSettings.orderExecuted?.discord ? { ...defaultChannelPref, ...currentSettings.orderExecuted.discord } : { ...defaultChannelPref },
            sms: currentSettings.orderExecuted?.sms ? { ...defaultChannelPref, ...currentSettings.orderExecuted.sms } : { ...defaultChannelPref },
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
            // Add validation for recipientId formats if necessary
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