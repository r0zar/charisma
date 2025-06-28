import { NotifierClient } from './index';
import { Notification, NotificationChannel, NotificationRecipient, IChannelSender } from './interfaces';
import { TelegramSender } from './channels/telegram';
// import { DiscordSender } from './channels/discord';
import { SMSSender } from './channels/sms';

// Mock Senders
jest.mock('./channels/telegram');
jest.mock('./channels/discord');
jest.mock('./channels/sms');

const MockedTelegramSender = TelegramSender as jest.MockedClass<typeof TelegramSender>;
// const MockedDiscordSender = DiscordSender as jest.MockedClass<typeof DiscordSender>;
const MockedSMSSender = SMSSender as jest.MockedClass<typeof SMSSender>;

// Helper function to create a notification
const createNotification = (message: string, recipientId: string): Notification => ({
    message,
    recipient: { id: recipientId },
});

describe('NotifierClient', () => {
    let mockTelegramSenderInstance: jest.Mocked<IChannelSender>;
    let mockDiscordSenderInstance: jest.Mocked<IChannelSender>;
    let mockSMSSenderInstance: jest.Mocked<IChannelSender>;

    beforeEach(() => {
        MockedTelegramSender.mockClear();
        // MockedDiscordSender.mockClear();
        MockedSMSSender.mockClear();

        mockTelegramSenderInstance = {
            send: jest.fn(),
            isReady: jest.fn(),
            destroy: jest.fn(),
        };
        mockDiscordSenderInstance = {
            send: jest.fn(),
            isReady: jest.fn(),
            destroy: jest.fn(),
        };
        mockSMSSenderInstance = {
            send: jest.fn(),
            isReady: jest.fn(),
            destroy: jest.fn(),
        };

        MockedTelegramSender.mockImplementation(() => mockTelegramSenderInstance as any);
        // MockedDiscordSender.mockImplementation(() => mockDiscordSenderInstance as any);
        MockedSMSSender.mockImplementation(() => mockSMSSenderInstance as any);
    });

    it('should initialize correctly with all senders', () => {
        const client = new NotifierClient();
        expect(client).toBeInstanceOf(NotifierClient);
        expect(MockedTelegramSender).toHaveBeenCalledTimes(1);
        // expect(MockedDiscordSender).toHaveBeenCalledTimes(1);
        expect(MockedSMSSender).toHaveBeenCalledTimes(1);
    });

    describe('send method', () => {
        it('should call telegramSender.send for telegram channel if ready', async () => {
            (mockTelegramSenderInstance.isReady as jest.Mock).mockReturnValue(true);
            (mockTelegramSenderInstance.send as jest.Mock).mockResolvedValue(undefined);

            const client = new NotifierClient();
            const notification = createNotification('Hello Telegram', 'chat123');
            await client.send('telegram', notification);

            expect(mockTelegramSenderInstance.isReady).toHaveBeenCalledTimes(1);
            expect(mockTelegramSenderInstance.send).toHaveBeenCalledWith(notification);
        });

        it('should reject if telegramSender is not ready', async () => {
            (mockTelegramSenderInstance.isReady as jest.Mock).mockReturnValue(false);
            const client = new NotifierClient();
            const notification = createNotification('Hello Telegram', 'chat123');
            await expect(client.send('telegram', notification))
                .rejects.toThrow('Sender for channel telegram is not ready.');
            expect(mockTelegramSenderInstance.send).not.toHaveBeenCalled();
        });

        it('should fallback to telegram for discord channel (discord is commented out)', async () => {
            (mockTelegramSenderInstance.isReady as jest.Mock).mockReturnValue(true);
            (mockTelegramSenderInstance.send as jest.Mock).mockResolvedValue(undefined);

            const client = new NotifierClient();
            const notification = createNotification('Hello Discord', 'discordUser123');
            await client.send('discord', notification);

            expect(mockTelegramSenderInstance.isReady).toHaveBeenCalledTimes(1);
            expect(mockTelegramSenderInstance.send).toHaveBeenCalledWith(notification);
        });

        it('should reject if telegram sender is not ready (discord fallback)', async () => {
            (mockTelegramSenderInstance.isReady as jest.Mock).mockReturnValue(false);
            const client = new NotifierClient();
            const notification = createNotification('Hello Discord', 'discordUser123');
            await expect(client.send('discord', notification))
                .rejects.toThrow('Sender for channel discord is not ready.');
            expect(mockTelegramSenderInstance.send).not.toHaveBeenCalled();
        });

        it('should call smsSender.send for sms channel if ready', async () => {
            (mockSMSSenderInstance.isReady as jest.Mock).mockReturnValue(true);
            (mockSMSSenderInstance.send as jest.Mock).mockResolvedValue(undefined);

            const client = new NotifierClient();
            const notification = createNotification('Hello SMS', '+1234567890');
            await client.send('sms', notification);

            expect(mockSMSSenderInstance.isReady).toHaveBeenCalledTimes(1);
            expect(mockSMSSenderInstance.send).toHaveBeenCalledWith(notification);
        });

        it('should reject if smsSender is not ready', async () => {
            (mockSMSSenderInstance.isReady as jest.Mock).mockReturnValue(false);
            const client = new NotifierClient();
            const notification = createNotification('Hello SMS', '+1234567890');
            await expect(client.send('sms', notification))
                .rejects.toThrow('Sender for channel sms is not ready.');
            expect(mockSMSSenderInstance.send).not.toHaveBeenCalled();
        });

        it('should reject for an unsupported channel', async () => {
            const client = new NotifierClient();
            const notification = createNotification('Hello Invalid', 'user123');
            await expect(client.send('unsupported' as NotificationChannel, notification))
                .rejects.toThrow('Unsupported channel: unsupported');
        });
    });

    describe('destroyAll method', () => {
        it('should call destroy on smsSender if it exists and is a function', async () => {
            const client = new NotifierClient();
            await client.destroyAll();
            expect(mockSMSSenderInstance.destroy).toHaveBeenCalledTimes(1);
        });
    });
}); 