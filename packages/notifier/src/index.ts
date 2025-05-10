import { INotifier, Notification, NotificationChannel, NotificationRecipient, IChannelSender } from './interfaces';
import { TelegramSender } from './channels/telegram';
// import { DiscordSender } from './channels/discord';
import { SMSSender } from './channels/sms'; // Import SMSSender

export class NotifierClient implements INotifier {
    private telegramSender: IChannelSender;
    // private discordSender: IChannelSender;
    private smsSender: IChannelSender;

    constructor(
        telegramBotToken?: string,
        discordBotToken?: string,
        twilioAccountSid?: string,
        twilioAuthToken?: string,
        twilioPhoneNumber?: string
    ) {
        this.telegramSender = new TelegramSender(telegramBotToken);
        // this.discordSender = new DiscordSender(discordBotToken);
        this.smsSender = new SMSSender(twilioAccountSid, twilioAuthToken, twilioPhoneNumber); // Initialize SMSSender

        console.log('NotifierClient initialized with all channel senders');
    }

    async send(channel: NotificationChannel, notification: Notification): Promise<void> {
        console.log(`Attempting to send notification via ${channel} to ${notification.recipient.id}`);

        let sender: IChannelSender;

        switch (channel) {
            case 'discord':
            // sender = this.discordSender;
            // break;
            case 'telegram':
                sender = this.telegramSender;
                break;
            case 'sms':
                sender = this.smsSender;
                break;
            default:
                const exhaustiveCheck: never = channel;
                return Promise.reject(new Error(`Unsupported channel: ${exhaustiveCheck}`));
        }

        if (!sender.isReady()) {
            console.warn(`Sender for channel ${channel} is not ready. Skipping notification.`);
            return Promise.reject(new Error(`Sender for channel ${channel} is not ready.`));
        }

        try {
            await sender.send(notification);
            console.log(`Notification successfully routed via ${channel}.`);
        } catch (error) {
            console.error(`Error sending notification via ${channel}:`, error);
            throw error;
        }
    }

    async destroyAll(): Promise<void> {
        console.log('Destroying all notifier clients...');
        // if (this.discordSender && typeof (this.discordSender as any).destroy === 'function') {
        //     (this.discordSender as any).destroy();
        // }
        if (this.smsSender && typeof (this.smsSender as any).destroy === 'function') {
            (this.smsSender as any).destroy();
        }
        // Add similar destroy calls for TelegramSender if it implements a destroy method
        console.log('All notifier clients shutdown sequence initiated.');
    }
}

// Example usage (for testing, will be removed or moved)
// Ensure necessary environment variables are set (TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
async function testNotifier() {
    const client = new NotifierClient();

    const telegramRecipient: NotificationRecipient = { id: 'YOUR_TELEGRAM_CHAT_ID' };
    const telegramNotification: Notification = {
        message: 'Hello from NotifierClient via Telegram!',
        recipient: telegramRecipient
    };

    const discordRecipient: NotificationRecipient = { id: 'YOUR_DISCORD_USER_ID_OR_CHANNEL_ID' };
    const discordNotification: Notification = {
        message: 'Hello from NotifierClient via Discord!',
        recipient: discordRecipient,
    };

    const smsRecipient: NotificationRecipient = { id: '+1YOUR_TWILIO_VERIFIED_TO_NUMBER' }; // Use a real phone number
    const smsNotification: Notification = {
        message: 'Hello from NotifierClient via SMS (Twilio)!',
        recipient: smsRecipient,
    };

    // Allow some time for Discord client to login and become ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (client["telegramSender"].isReady()) {
        try {
            console.log('Sending test Telegram message...');
            await client.send('telegram', telegramNotification);
        } catch (error) {
            console.error('Test Telegram notification failed:', error);
        }
    } else {
        console.warn('Telegram sender not ready, skipping. Ensure TELEGRAM_BOT_TOKEN is set.');
    }

    // if (client["discordSender"].isReady()) {
    //     try {
    //         console.log('Sending test Discord message...');
    //         await client.send('discord', discordNotification);
    //     } catch (error) {
    //         console.error('Test Discord notification failed:', error);
    //     }
    // } else {
    //     console.warn('Discord sender not ready, skipping. Ensure DISCORD_BOT_TOKEN is set and bot has permissions.');
    // }

    if (client["smsSender"].isReady()) {
        try {
            console.log('Sending test SMS message...');
            await client.send('sms', smsNotification);
        } catch (error) {
            console.error('Test SMS notification failed:', error);
        }
    } else {
        console.warn('SMS sender not ready, skipping. Ensure Twilio credentials and phone number are set.');
    }

    await client.destroyAll();
}

if (require.main === module) {
    testNotifier();
}

export * from './interfaces'; 