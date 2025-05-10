# @charisma/notifier

This package provides a unified client to send notifications via multiple channels: Telegram, Discord, and SMS (via Twilio).

## Features

- Send notifications to Telegram users or groups.
- Send notifications to Discord users (DMs) or channels.
- Send SMS notifications via Twilio.
- Common interface for all notification channels.
- Individual channel senders can be used directly if needed.

## Environment Variables Setup

To use this notifier, you need to set up API tokens and credentials for each service you intend to use. These are typically configured via environment variables.

You can set these variables directly in your shell, or use a `.env` file at the root of your project (or the root of this package) and a library like `dotenv` to load them at runtime (note: `dotenv` is not an explicit dependency of this package yet).

Example `.env` file structure:

```env
# Telegram
TELEGRAM_BOT_TOKEN='your_telegram_bot_token_here'

# Discord
DISCORD_BOT_TOKEN='your_discord_bot_token_here'

# Twilio (for SMS)
TWILIO_ACCOUNT_SID='your_twilio_account_sid_here'
TWILIO_AUTH_TOKEN='your_twilio_auth_token_here'
TWILIO_PHONE_NUMBER='your_twilio_phone_number_here'
```

Below are instructions on how to obtain these credentials for each service:

### 1. Telegram

- **`TELEGRAM_BOT_TOKEN`**: This is the authentication token for your Telegram Bot.
    1.  **Create a Bot**: Open Telegram and search for "BotFather".
    2.  Start a chat with BotFather by sending the `/start` command.
    3.  Create a new bot by sending the `/newbot` command.
    4.  Follow the prompts to choose a name and username for your bot.
    5.  BotFather will provide you with an **API token**. This is your `TELEGRAM_BOT_TOKEN`.
    6.  Keep this token secure, as it allows full control over your bot.

### 2. Discord

- **`DISCORD_BOT_TOKEN`**: This is the authentication token for your Discord Bot.
    1.  **Create an Application and Bot**:
        - Go to the [Discord Developer Portal](https://discord.com/developers/applications).
        - Click "New Application" and give it a name.
        - Navigate to the "Bot" tab in your application's settings.
        - Click "Add Bot" and confirm.
    2.  **Get the Token**: Under the bot's username, you will see a section for "TOKEN". Click "Copy" to get your `DISCORD_BOT_TOKEN`.
        - **Important**: You may need to click "Reset Token" if you haven't saved it before. Treat this token like a password!
    3.  **Enable Privileged Gateway Intents**: For the bot to function correctly (especially for reading messages or user information if needed beyond just sending), you might need to enable Privileged Gateway Intents under the "Bot" tab. For sending messages as implemented in this package, `Guilds`, `GuildMessages`, and `DirectMessages` intents are used. Ensure these are enabled if your bot requires them beyond basic functionality or if you encounter permission issues.
    4.  **Invite Bot to Server**: To send messages to a server channel, your bot must be a member of that server.
        - Go to the "OAuth2" -> "URL Generator" tab in the Developer Portal.
        - Select the `bot` scope. 
        - In "Bot Permissions" that appear below, select necessary permissions (e.g., `Send Messages`, `Read Message History` in the channels it should operate).
        - Copy the generated URL and open it in your browser to invite the bot to your server.

### 3. Twilio (for SMS)

- **`TWILIO_ACCOUNT_SID`**: Your main Twilio account identifier.
- **`TWILIO_AUTH_TOKEN`**: Your Twilio account authentication token.
- **`TWILIO_PHONE_NUMBER`**: A Twilio phone number that you own, capable of sending SMS messages.

    1.  **Create or Login to Twilio Account**: Go to [www.twilio.com](https://www.twilio.com/) and sign up or log in.
    2.  **Find Credentials**: On your Twilio Console Dashboard ([www.twilio.com/console](https://www.twilio.com/console)), you will find your `ACCOUNT SID` and `AUTH TOKEN`.
        - Click "Show" next to the Auth Token if it's hidden.
        - **Important**: Keep your Auth Token secure.
    3.  **Get a Twilio Phone Number**: If you don't have one, you'll need to buy or provision a Twilio phone number that is SMS-capable.
        - You can find this under "Phone Numbers" -> "Manage" -> "Active numbers" in the Twilio console.
        - Ensure this number is E.164 formatted (e.g., `+1234567890`) when setting `TWILIO_PHONE_NUMBER`.
    4.  **Verify "To" Numbers (Trial Accounts)**: If you are using a Twilio trial account, you can only send SMS messages to phone numbers that you have verified in the Twilio console.

## Usage

```typescript
import { NotifierClient, NotificationRecipient, Notification } from '@charisma/notifier';

// Initialize the client. Tokens can be passed directly or loaded from env variables by the senders.
const notifier = new NotifierClient(
  // process.env.TELEGRAM_BOT_TOKEN, // (optional, defaults to env)
  // process.env.DISCORD_BOT_TOKEN,    // (optional, defaults to env)
  // process.env.TWILIO_ACCOUNT_SID,   // (optional, defaults to env)
  // process.env.TWILIO_AUTH_TOKEN,    // (optional, defaults to env)
  // process.env.TWILIO_PHONE_NUMBER   // (optional, defaults to env)
);

async function sendAlerts() {
  const telegramUser: NotificationRecipient = { id: 'YOUR_TELEGRAM_CHAT_ID' }; // Replace with actual Chat ID
  const discordUserOrChannel: NotificationRecipient = { id: 'YOUR_DISCORD_USER_OR_CHANNEL_ID' }; // Replace
  const smsUser: NotificationRecipient = { id: '+1234567890' }; // Replace with E.164 phone number

  const telegramMessage: Notification = {
    message: 'This is a test alert for Telegram!',
    recipient: telegramUser,
  };

  const discordMessage: Notification = {
    message: 'This is a test alert for Discord!',
    recipient: discordUserOrChannel,
  };

  const smsMessage: Notification = {
    message: 'This is a test alert via SMS!',
    recipient: smsUser,
  };

  try {
    if (notifier["telegramSender"].isReady()) { // Basic readiness check
      await notifier.send('telegram', telegramMessage);
      console.log('Telegram alert sent!');
    }

    // For Discord, allow some time for client to connect and be ready
    await new Promise(resolve => setTimeout(resolve, 5000)); 
    if (notifier["discordSender"].isReady()) {
      await notifier.send('discord', discordMessage);
      console.log('Discord alert sent!');
    }

    if (notifier["smsSender"].isReady()) {
      await notifier.send('sms', smsMessage);
      console.log('SMS alert sent!');
    }
  } catch (error) {
    console.error('Failed to send one or more alerts:', error);
  }

  // Gracefully disconnect clients (especially important for Discord)
  await notifier.destroyAll();
}

sendAlerts();
```

**Note on Discord Readiness**: The Discord client login is asynchronous. The `NotifierClient` attempts to log in upon instantiation. If you try to send a message immediately, the client might not be ready yet. The example above includes a simple `setTimeout` for demonstration. In a real application, you might want a more robust way to await client readiness, possibly by exposing an `onReady` event or a promise from the `DiscordSender` or `NotifierClient`.

## Running Tests

To run the included tests for this package:

```bash
# Navigate to this package directory (e.g., packages/notifier)
cd packages/notifier

# Install dependencies (if not already done for the monorepo)
# pnpm install

# Run tests
pnpm test
```

The tests use Jest and mock the actual API calls to avoid sending real notifications during testing. 