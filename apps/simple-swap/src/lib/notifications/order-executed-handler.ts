import { kv } from '@vercel/kv';
import { NotifierClient } from '@charisma/notifier';
import type { UserNotificationSettings } from '@/types/notification-settings';
import { LimitOrder } from '@/lib/orders/types'; // Assuming this path is correct for LimitOrder
import { log } from '@repo/logger'; // Using the same logger as executor
import type { Notification, NotificationChannel } from '@charisma/notifier';

// Placeholder for a function that might get more user-friendly token names/decimals
// For now, we'll use the contract IDs or simple placeholders.
// You might want to create a mapping or fetch details if needed.
function formatTokenAmount(contractId: string, amount: string): string {
    // Basic formatting, assuming 6 decimals for STX-like tokens if not specified
    // This should be improved with actual token metadata
    const M_STX_DECIMALS = 1_000_000;
    const numericAmount = BigInt(amount);
    let formattedAmount = (Number(numericAmount) / M_STX_DECIMALS).toFixed(6);

    // Try to get a simpler name
    let tokenName = contractId.split('.').pop()?.split('-token')[0]?.toUpperCase() || contractId;
    if (tokenName.startsWith('token-')) tokenName = tokenName.substring(6);


    // Remove trailing zeros after decimal point
    formattedAmount = formattedAmount.replace(/(\\.\\d*?[1-9])0+$|(\\.\\d*?)0+$/, '$1$2');
    if (formattedAmount.endsWith('.')) formattedAmount = formattedAmount.slice(0, -1);

    return `${formattedAmount} ${tokenName}`;
}

function getSimpleTokenName(contractId: string): string {
    return contractId.split('.').pop()?.split('-token')[0]?.toUpperCase() || contractId;
}


export async function sendOrderExecutedNotification(
    order: Pick<LimitOrder, 'recipient' | 'uuid' | 'inputToken' | 'outputToken' | 'amountIn'>,
    txid: string
): Promise<void> {
    const { recipient: userPrincipal, uuid, inputToken, outputToken, amountIn } = order;

    log({ orderUuid: uuid, userPrincipal, txid }, 'Attempting to send order executed notification.');

    try {
        const settingsKey = `user:${userPrincipal}:notifications`;
        const settings = await kv.get<UserNotificationSettings>(settingsKey);

        if (!settings || !settings.orderExecuted) {
            log({ orderUuid: uuid, userPrincipal }, 'User has no notification settings or orderExecuted preferences.');
            return;
        }

        const orderPrefs = settings.orderExecuted;
        const channelsToNotify = [];

        if (orderPrefs.telegram?.enabled && orderPrefs.telegram.recipientId) {
            channelsToNotify.push({ type: 'telegram', recipientId: orderPrefs.telegram.recipientId });
        }
        if (orderPrefs.discord?.enabled && orderPrefs.discord.recipientId) {
            channelsToNotify.push({ type: 'discord', recipientId: orderPrefs.discord.recipientId });
        }
        if (orderPrefs.sms?.enabled && orderPrefs.sms.recipientId) {
            channelsToNotify.push({ type: 'sms', recipientId: orderPrefs.sms.recipientId });
        }

        if (channelsToNotify.length === 0) {
            log({ orderUuid: uuid, userPrincipal }, 'No enabled notification channels with recipient IDs for order execution.');
            return;
        }

        const notifier = new NotifierClient(
            process.env.TELEGRAM_BOT_TOKEN,
            process.env.DISCORD_BOT_TOKEN,
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
            process.env.TWILIO_PHONE_NUMBER
        );

        const amountInFormatted = formatTokenAmount(inputToken, amountIn);
        const inputTokenName = getSimpleTokenName(inputToken);
        const outputTokenName = getSimpleTokenName(outputToken);

        const message = `🚀 Order Executed! 🚀\n\nYour limit order (${uuid.substring(0, 8)}...) to swap ${amountInFormatted} for ${outputTokenName} has been successfully processed.\n\nTransaction ID: ${txid}\n(View on explorer: https://explorer.hiro.so/txid/${txid}?chain=mainnet)`; // Assuming mainnet for explorer link

        for (const notifyChannel of channelsToNotify) {
            try {
                log({ orderUuid: uuid, userPrincipal, channelType: notifyChannel.type, recipientId: notifyChannel.recipientId }, `Sending notification via ${notifyChannel.type}`);

                const notificationPayload: Notification = {
                    recipient: { id: notifyChannel.recipientId },
                    message: message, // The common message string
                };

                await notifier.send(notifyChannel.type as NotificationChannel, notificationPayload);

                log({ orderUuid: uuid, userPrincipal, channelType: notifyChannel.type }, `Notification sent successfully via ${notifyChannel.type}.`);
            } catch (channelError) {
                log({ orderUuid: uuid, userPrincipal, channelType: notifyChannel.type, error: channelError }, `Failed to send notification via ${notifyChannel.type}.`);
            }
        }

        // Cleanly destroy notifier if it has disposable resources
        if (typeof notifier.destroyAll === 'function') { // Check if destroyAll method exists
            await notifier.destroyAll();
            log({ orderUuid: uuid, userPrincipal }, 'Notifier resources destroyed.');
        }

    } catch (error) {
        log({ orderUuid: uuid, userPrincipal, error }, 'Failed to process order execution notification.');
        // Do not rethrow, as this should not block order processing
    }
} 