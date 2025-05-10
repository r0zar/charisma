import twilio from 'twilio';
import { Notification, IChannelSender } from '../interfaces';

export class SMSSender implements IChannelSender {
    private client: twilio.Twilio | undefined;
    private accountSid: string | undefined;
    private authToken: string | undefined;
    private fromPhoneNumber: string | undefined;

    constructor(
        accountSid?: string,
        authToken?: string,
        fromPhoneNumber?: string
    ) {
        this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID;
        this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN;
        this.fromPhoneNumber = fromPhoneNumber || process.env.TWILIO_PHONE_NUMBER;

        if (this.accountSid && this.authToken && this.fromPhoneNumber) {
            try {
                this.client = twilio(this.accountSid, this.authToken);
            } catch (error) {
                console.error('Failed to initialize Twilio client:', error);
                this.client = undefined;
            }
        } else {
            console.warn(
                'Twilio Account SID, Auth Token, or Phone Number not provided. SMSSender will not be able to send messages.'
            );
        }
    }

    isReady(): boolean {
        return !!this.client && !!this.fromPhoneNumber;
    }

    async send(notification: Notification): Promise<void> {
        if (!this.isReady()) {
            const errorMessage = 'SMSSender is not ready (Twilio client not initialized or missing credentials/phone number).';
            console.warn(errorMessage + ' Cannot send message.');
            return Promise.reject(new Error(errorMessage));
        }

        if (!notification.recipient.id) {
            const errorMessage = 'Recipient ID (phone number) is missing for SMS notification';
            console.error(errorMessage);
            return Promise.reject(new Error(errorMessage));
        }

        try {
            await this.client!.messages.create({
                body: notification.message,
                from: this.fromPhoneNumber!,
                to: notification.recipient.id, // Should be E.164 format, e.g., +1234567890
            });
            console.log(`SMS sent to ${notification.recipient.id} via Twilio.`);
        } catch (error) {
            console.error(`Failed to send SMS to ${notification.recipient.id} via Twilio:`, error);
            throw error;
        }
    }

    // destroy method is not strictly necessary for Twilio client as it doesn't maintain a persistent connection like Discord/Telegram bots.
    // However, to conform to IChannelSender if other senders might need it:
    destroy(): void {
        // No explicit destroy action needed for the Twilio client instance itself.
        console.log('SMSSender destroy called - no specific action taken for Twilio client.');
    }
} 