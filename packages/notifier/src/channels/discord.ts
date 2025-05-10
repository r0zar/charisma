// import { Client, GatewayIntentBits, TextChannel, User } from 'discord.js';
// import { Notification, IChannelSender } from '../interfaces';

// export class DiscordSender implements IChannelSender {
//     private client: Client;
//     private botToken: string | undefined;
//     private ready: boolean = false;

//     constructor(botToken?: string) {
//         this.botToken = botToken || process.env.DISCORD_BOT_TOKEN;

//         if (!this.botToken) {
//             console.warn(
//                 'Discord Bot Token not provided. DiscordSender will not be able to send messages.'
//             );
//             // Initialize a client without a token; isReady will be false.
//             this.client = new Client({ intents: [] });
//             return;
//         }

//         this.client = new Client({
//             intents: [
//                 GatewayIntentBits.Guilds, // Required for guild-related events and cache
//                 GatewayIntentBits.GuildMessages, // Required for sending messages in guilds
//                 GatewayIntentBits.DirectMessages, // Required for sending DMs
//             ],
//         });

//         this.client.once('ready', (loggedInClient) => {
//             console.log(`Discord client logged in as ${loggedInClient.user.tag}`);
//             this.ready = true;
//         });

//         this.client.on('error', (error) => {
//             console.error('Discord client error:', error);
//             this.ready = false; // Mark as not ready on error
//         });

//         this.login();
//     }

//     private async login(): Promise<void> {
//         if (this.botToken && !this.client.token) { // Check if already logged in or trying to login
//             try {
//                 await this.client.login(this.botToken);
//             } catch (error) {
//                 console.error('Failed to login to Discord:', error);
//                 this.ready = false;
//             }
//         }
//     }

//     isReady(): boolean {
//         // The client might be instantiated but not yet logged in and ready.
//         // `this.client.isReady()` is the most accurate check from discord.js v14.
//         return this.ready && this.client.isReady();
//     }

//     async send(notification: Notification): Promise<void> {
//         if (!this.isReady()) {
//             const errorMessage = 'DiscordSender is not ready (client not logged in or missing token).';
//             console.warn(errorMessage + ' Cannot send message.');
//             return Promise.reject(new Error(errorMessage));
//         }

//         if (!notification.recipient.id) {
//             const errorMessage = 'Recipient ID is missing for Discord notification';
//             console.error(errorMessage);
//             return Promise.reject(new Error(errorMessage));
//         }

//         try {
//             // Attempt to fetch as a user first (for DMs)
//             let target: User | TextChannel | undefined;
//             try {
//                 target = await this.client.users.fetch(notification.recipient.id);
//             } catch (userFetchError) {
//                 // If fetching user fails, try fetching as a channel
//                 try {
//                     const channel = await this.client.channels.fetch(notification.recipient.id);
//                     if (channel instanceof TextChannel) {
//                         target = channel;
//                     } else {
//                         console.warn(`Fetched channel ${notification.recipient.id} is not a text channel.`);
//                     }
//                 } catch (channelFetchError) {
//                     console.warn(`Could not fetch user or channel for ID: ${notification.recipient.id}. UserError: ${userFetchError}, ChannelError: ${channelFetchError}`);
//                 }
//             }

//             if (target) {
//                 await target.send(notification.message);
//                 console.log(`Discord message sent to ${notification.recipient.id}`);
//             } else {
//                 throw new Error(`Could not find a user or text channel with ID: ${notification.recipient.id}`);
//             }
//         } catch (error) {
//             console.error(`Failed to send Discord message to ${notification.recipient.id}:`, error);
//             throw error;
//         }
//     }

//     // Optional: Method to gracefully disconnect the bot
//     destroy(): void {
//         if (this.client) {
//             this.client.destroy();
//             this.ready = false;
//             console.log('Discord client destroyed.');
//         }
//     }
// } 