import { kv } from '@vercel/kv';
import { NotifierClient } from '@charisma/notifier';
import type { UserNotificationSettings } from '@/types/notification-settings';
import { LimitOrder } from '@/lib/orders/types'; // Assuming this path is correct for LimitOrder
import type { Notification, NotificationChannel } from '@charisma/notifier';
import { getTokenMetadataCached } from '@repo/tokens';

// Format token amount using proper decimals from token metadata
async function formatTokenAmount(contractId: string, amount: string): Promise<string> {
    try {
        // Get token metadata to access proper decimals and symbol
        const tokenMeta = await getTokenMetadataCached(contractId);
        const decimals = tokenMeta.decimals || 6; // Default to 6 if not specified
        const symbol = tokenMeta.symbol || getSimpleTokenName(contractId);

        const numericAmount = BigInt(amount);
        let formattedAmount = (Number(numericAmount) / Math.pow(10, decimals)).toFixed(decimals);

        // Remove trailing zeros after decimal point
        formattedAmount = formattedAmount.replace(/(\\.\\d*?[1-9])0+$|(\\.\\d*?)0+$/, '$1$2');
        if (formattedAmount.endsWith('.')) formattedAmount = formattedAmount.slice(0, -1);

        return `${formattedAmount} ${symbol}`;
    } catch (error) {
        console.error(`Failed to get token metadata for ${contractId}:`, error);

        // Fallback to 6 decimals if metadata fetch fails
        const numericAmount = BigInt(amount);
        let formattedAmount = (Number(numericAmount) / 1_000_000).toFixed(6);

        const tokenName = getSimpleTokenName(contractId);

        // Remove trailing zeros after decimal point
        formattedAmount = formattedAmount.replace(/(\\.\\d*?[1-9])0+$|(\\.\\d*?)0+$/, '$1$2');
        if (formattedAmount.endsWith('.')) formattedAmount = formattedAmount.slice(0, -1);

        return `${formattedAmount} ${tokenName}`;
    }
}

function getSimpleTokenName(contractId: string): string {
    const contractName = contractId.split('.').pop();
    if (!contractName) return contractId;

    // Remove common token prefixes/suffixes
    const tokenName = contractName
        .replace(/^token-/, '')
        .replace(/-token$/, '')
        .replace(/^t/, '') // Remove single 't' prefix
        .toUpperCase();

    return tokenName || contractId;
}

// Get token symbol using metadata, with fallback to simple name
async function getTokenSymbol(contractId: string): Promise<string> {
    try {
        const tokenMeta = await getTokenMetadataCached(contractId);
        return tokenMeta.symbol || getSimpleTokenName(contractId);
    } catch (error) {
        console.error(`Failed to get token symbol for ${contractId}:`, error);
        return getSimpleTokenName(contractId);
    }
}


export async function sendOrderExecutedNotification(
    order: Pick<LimitOrder, 'recipient' | 'uuid' | 'inputToken' | 'outputToken' | 'amountIn'>,
    txid: string
): Promise<void> {
    const { recipient: userPrincipal, uuid, inputToken, outputToken, amountIn } = order;

    console.log({ orderUuid: uuid, userPrincipal, txid }, 'Attempting to send order executed notification.');

    try {
        const settingsKey = `user:${userPrincipal}:notifications`;
        const settings = await kv.get<UserNotificationSettings>(settingsKey);

        if (!settings || !settings.orderExecuted) {
            console.log({ orderUuid: uuid, userPrincipal }, 'User has no notification settings or orderExecuted preferences.');
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
            console.log({ orderUuid: uuid, userPrincipal }, 'No enabled notification channels with recipient IDs for order execution.');
            return;
        }

        const notifier = new NotifierClient(
            process.env.TELEGRAM_BOT_TOKEN,
            process.env.DISCORD_BOT_TOKEN,
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
            process.env.TWILIO_PHONE_NUMBER
        );

        const amountInFormatted = await formatTokenAmount(inputToken, amountIn);
        const outputTokenName = await getTokenSymbol(outputToken);

        const message = `Order Executed!\n\nYour order (${uuid.substring(0, 8)}...) to swap ${amountInFormatted} for ${outputTokenName} has been successfully processed.\n\nTransaction ID: ${txid}\n(View on explorer: https://explorer.hiro.so/txid/${txid}?chain=mainnet)`; // Assuming mainnet for explorer link

        for (const notifyChannel of channelsToNotify) {
            try {
                console.log({ orderUuid: uuid, userPrincipal, channelType: notifyChannel.type, recipientId: notifyChannel.recipientId }, `Sending notification via ${notifyChannel.type}`);

                const notificationPayload: Notification = {
                    recipient: { id: notifyChannel.recipientId },
                    message: message, // The common message string
                };

                await notifier.send(notifyChannel.type as NotificationChannel, notificationPayload);

                console.log({ orderUuid: uuid, userPrincipal, channelType: notifyChannel.type }, `Notification sent successfully via ${notifyChannel.type}.`);
            } catch (channelError) {
                console.log({ orderUuid: uuid, userPrincipal, channelType: notifyChannel.type, error: channelError }, `Failed to send notification via ${notifyChannel.type}.`);
            }
        }

        // Cleanly destroy notifier if it has disposable resources
        if (typeof notifier.destroyAll === 'function') { // Check if destroyAll method exists
            await notifier.destroyAll();
            console.log({ orderUuid: uuid, userPrincipal }, 'Notifier resources destroyed.');
        }

    } catch (error) {
        console.log({ orderUuid: uuid, userPrincipal, error }, 'Failed to process order execution notification.');
        // Do not rethrow, as this should not block order processing
    }
} 