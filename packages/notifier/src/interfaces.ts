export interface NotificationRecipient {
    id: string; // e.g., Discord user ID, Telegram chat ID, phone number
}

export interface Notification {
    message: string;
    recipient: NotificationRecipient;
    // We can add more common fields later, like priority, metadata, etc.
}

export type NotificationChannel = 'discord' | 'telegram' | 'sms';

export interface INotifier {
    send(channel: NotificationChannel, notification: Notification): Promise<void>;
    // We could also have channel-specific methods if needed, or a more generic send
    // send(notification: Notification, channels: NotificationChannel[]): Promise<void>;
}

export interface IChannelSender {
    send(notification: Notification): Promise<void>;
    isReady(): boolean;
    destroy?: () => void;
} 