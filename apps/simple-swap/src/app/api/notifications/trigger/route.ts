import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { UserNotificationSettings } from '@/types/notification-settings';

// This would typically be a separate service/utility, but keeping it simple for demo
interface NotificationEvent {
    type: 'bidReceived' | 'bidAccepted' | 'bidCancelled' | 'offerFilled' | 'offerCancelled' | 'orderExecuted' | 'memeRouletteSwap';
    userPrincipal: string; // The user who should receive the notification
    data: {
        offerId?: string;
        bidId?: string;
        bidAmount?: string;
        offerAmount?: string;
        tokenSymbol?: string;
        counterpartyAddress?: string;
        txId?: string;
        // Add any Meme Roulette Swap specific fields here if needed
    };
}

async function sendTelegramNotification(chatId: string, message: string): Promise<boolean> {
    // This would integrate with your actual Telegram bot
    // For demo purposes, we'll just log it
    console.log(`[Telegram Bot] Sending to ${chatId}: ${message}`);

    // In a real implementation, you would call the Telegram Bot API:
    // const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //         chat_id: chatId,
    //         text: message,
    //         parse_mode: 'HTML'
    //     })
    // });
    // return response.ok;

    return true; // Simulate success for demo
}

function formatNotificationMessage(event: NotificationEvent): string {
    const { type, data } = event;

    switch (type) {
        case 'bidReceived':
            return `🎯 <b>New Bid Received!</b>\n\nSomeone placed a bid of ${data.bidAmount} ${data.tokenSymbol} on your offer.\n\nOffer ID: ${data.offerId}\nFrom: ${data.counterpartyAddress?.slice(0, 8)}...`;

        case 'bidAccepted':
            return `✅ <b>Bid Accepted!</b>\n\nYour bid of ${data.bidAmount} ${data.tokenSymbol} has been accepted!\n\nOffer ID: ${data.offerId}\n${data.txId ? `Transaction: ${data.txId}` : ''}`;

        case 'bidCancelled':
            return `❌ <b>Bid Cancelled</b>\n\nA bid on your offer has been cancelled.\n\nOffer ID: ${data.offerId}\nBid Amount: ${data.bidAmount} ${data.tokenSymbol}`;

        case 'offerFilled':
            return `🎉 <b>Offer Filled!</b>\n\nAn offer you were watching has been filled.\n\nOffer ID: ${data.offerId}\nAmount: ${data.offerAmount} ${data.tokenSymbol}`;

        case 'offerCancelled':
            return `⚠️ <b>Offer Cancelled</b>\n\nAn offer you were watching has been cancelled.\n\nOffer ID: ${data.offerId}\nAmount: ${data.offerAmount} ${data.tokenSymbol}`;

        case 'orderExecuted':
            return `⚡ <b>Trade Executed!</b>\n\nYour trade order has been successfully executed.\n\n${data.txId ? `Transaction: ${data.txId}` : 'Check your wallet for details.'}`;

        case 'memeRouletteSwap':
            return `🎲 <b>Meme Roulette Swap!</b>\n\nYour Meme Roulette swap has been processed.${data.txId ? `\nTransaction: ${data.txId}` : ''}`;

        default:
            return `📢 You have a new notification regarding your trade activity.`;
    }
}

async function triggerNotification(event: NotificationEvent): Promise<boolean> {
    try {
        const settingsKey = `user:${event.userPrincipal}:notifications`;
        const settings = await kv.get<UserNotificationSettings>(settingsKey);

        if (!settings || !settings[event.type]) {
            console.log(`No notification settings found for ${event.userPrincipal} and event type ${event.type}`);
            return false;
        }

        const eventSettings = settings[event.type]!;
        let notificationSent = false;

        // Check Telegram notifications
        if (eventSettings.telegram?.enabled && eventSettings.telegram.recipientId) {
            const message = formatNotificationMessage(event);
            const success = await sendTelegramNotification(eventSettings.telegram.recipientId, message);
            if (success) {
                notificationSent = true;
                console.log(`Telegram notification sent to ${event.userPrincipal} for ${event.type}`);
            }
        }

        // Add Discord and SMS support here when implemented
        // if (eventSettings.discord?.enabled && eventSettings.discord.recipientId) { ... }
        // if (eventSettings.sms?.enabled && eventSettings.sms.recipientId) { ... }

        return notificationSent;
    } catch (error) {
        console.error(`Error triggering notification for ${event.userPrincipal}:`, error);
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const event: NotificationEvent = await request.json();

        // Validate the event
        if (!event.type || !event.userPrincipal) {
            return NextResponse.json({ error: 'Missing required fields: type and userPrincipal' }, { status: 400 });
        }

        const validTypes = ['bidReceived', 'bidAccepted', 'bidCancelled', 'offerFilled', 'offerCancelled', 'orderExecuted', 'memeRouletteSwap'];
        if (!validTypes.includes(event.type)) {
            return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
        }

        const success = await triggerNotification(event);

        return NextResponse.json({
            success,
            message: success ? 'Notification triggered successfully' : 'No notifications sent (user preferences or missing settings)'
        });

    } catch (error) {
        console.error('Error in notification trigger endpoint:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET endpoint for testing - shows example payloads
export async function GET() {
    const examples = {
        bidReceived: {
            type: 'bidReceived',
            userPrincipal: 'SP1ABC...DEF',
            data: {
                offerId: 'offer-123',
                bidAmount: '100.0',
                tokenSymbol: 'STX',
                counterpartyAddress: 'SP2XYZ...ABC'
            }
        },
        bidAccepted: {
            type: 'bidAccepted',
            userPrincipal: 'SP1ABC...DEF',
            data: {
                offerId: 'offer-123',
                bidAmount: '100.0',
                tokenSymbol: 'STX',
                txId: '0x123abc...def'
            }
        },
        orderExecuted: {
            type: 'orderExecuted',
            userPrincipal: 'SP1ABC...DEF',
            data: {
                txId: '0x123abc...def'
            }
        }
    };

    return NextResponse.json({
        message: 'Notification trigger endpoint',
        usage: 'POST to this endpoint with a NotificationEvent payload',
        examples
    });
} 