#!/usr/bin/env node

/**
 * Create custom notifications for specific users
 * 
 * Usage:
 *   pnpm script scripts/create-notification.ts --userId=user123 --title="Test" --message="Hello"
 *   pnpm script scripts/create-notification.ts --template=bot_offline --userId=user123 --botName="MyBot"
 *   pnpm script scripts/create-notification.ts --batch=notifications.json
 */

import path from 'path';
import fs from 'fs';
import { notificationStore, isKVAvailable } from '../src/lib/kv-store';
import { 
  generateNotificationFromTemplate, 
  type NotificationEventType,
  type NotificationEventData,
  NOTIFICATION_TEMPLATES 
} from '../src/lib/notification-templates';
import { syncLogger as logger } from './logger';

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            const cleanValue = value.replace(/^["']|["']$/g, '');
            process.env[key.trim()] = cleanValue;
          }
        }
      }
      console.log(`ℹ️  Loaded environment variables from ${envPath}`);
    } else {
      console.warn(`⚠️  Environment file not found: ${envPath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to load environment file: ${error}`);
  }
}

interface CreateOptions {
  userId?: string;
  template?: NotificationEventType;
  title?: string;
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  batch?: string;
  templateData?: Record<string, any>;
}

interface BatchNotification {
  userId: string;
  template?: NotificationEventType;
  title?: string;
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  templateData?: Record<string, any>;
}

function parseArgs(): CreateOptions {
  const args = process.argv.slice(2);
  const options: CreateOptions = {};

  // Check for help first
  if (args.includes('--help') || args.includes('-h')) {
    logger.info(`
Create custom notifications for specific users

Usage:
  pnpm script scripts/create-notification.ts [options]

Basic Options:
  --userId=<string>       User ID to create notification for (required unless --batch)
  --title=<string>        Custom notification title
  --message=<string>      Custom notification message
  --type=<string>         Notification type (success|error|warning|info) [default: info]
  --priority=<string>     Priority level (high|medium|low) [default: medium]
  --category=<string>     Notification category [default: custom]

Template Options:
  --template=<string>     Use predefined template (see available templates below)
  --<key>=<value>         Template data variables (e.g., --botName="MyBot" --amount=100)

Batch Options:
  --batch=<file>          JSON file with array of notifications to create

Available Templates:
${Object.keys(NOTIFICATION_TEMPLATES).map(template => `  - ${template}: ${NOTIFICATION_TEMPLATES[template as NotificationEventType].titleTemplate}`).join('\n')}

Examples:
  # Create custom notification
  pnpm script scripts/create-notification.ts --userId=user123 --title="Welcome" --message="Welcome to the platform!" --type=success

  # Use template with data
  pnpm script scripts/create-notification.ts --userId=user123 --template=bot_offline --botName="TradingBot" --botId="bot-123"

  # Create high priority error notification
  pnpm script scripts/create-notification.ts --userId=user123 --title="Critical Error" --message="System failure detected" --type=error --priority=high

  # Batch create from JSON file
  pnpm script scripts/create-notification.ts --batch=notifications.json

Batch JSON Format:
[
  {
    "userId": "user123",
    "template": "bot_offline",
    "templateData": { "botName": "TradingBot", "botId": "bot-123" }
  },
  {
    "userId": "user456",
    "title": "Custom Alert",
    "message": "Something happened",
    "type": "warning",
    "priority": "high"
  }
]
`);
    process.exit(0);
  }

  for (const arg of args) {
    if (arg.startsWith('--userId=')) {
      options.userId = arg.split('=')[1];
    } else if (arg.startsWith('--template=')) {
      options.template = arg.split('=')[1] as NotificationEventType;
    } else if (arg.startsWith('--title=')) {
      options.title = arg.split('=')[1];
    } else if (arg.startsWith('--message=')) {
      options.message = arg.split('=')[1];
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1] as 'success' | 'error' | 'warning' | 'info';
    } else if (arg.startsWith('--priority=')) {
      options.priority = arg.split('=')[1] as 'high' | 'medium' | 'low';
    } else if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1];
    } else if (arg.startsWith('--batch=')) {
      options.batch = arg.split('=')[1];
    } else if (arg.startsWith('--')) {
      // Parse template data (e.g., --botName=MyBot --amount=100)
      const [key, value] = arg.slice(2).split('=');
      if (key && value) {
        if (!options.templateData) options.templateData = {};
        // Try to parse as number, otherwise keep as string
        const numValue = parseFloat(value);
        options.templateData[key] = isNaN(numValue) ? value : numValue;
      }
    }
  }

  return options;
}

function validateOptions(options: CreateOptions): void {
  if (options.batch) {
    // Batch mode validation
    if (!fs.existsSync(options.batch)) {
      logger.error(`Batch file not found: ${options.batch}`);
      process.exit(1);
    }
    return;
  }

  // Single notification validation
  if (!options.userId) {
    logger.error('--userId is required for single notification creation');
    process.exit(1);
  }

  if (!options.template && (!options.title || !options.message)) {
    logger.error('Either --template or both --title and --message are required');
    process.exit(1);
  }

  if (options.template && !NOTIFICATION_TEMPLATES[options.template]) {
    logger.error(`Invalid template: ${options.template}`);
    logger.error(`Available templates: ${Object.keys(NOTIFICATION_TEMPLATES).join(', ')}`);
    process.exit(1);
  }

  if (options.type && !['success', 'error', 'warning', 'info'].includes(options.type)) {
    logger.error('Invalid --type value. Must be: success, error, warning, or info');
    process.exit(1);
  }

  if (options.priority && !['high', 'medium', 'low'].includes(options.priority)) {
    logger.error('Invalid --priority value. Must be: high, medium, or low');
    process.exit(1);
  }
}

async function createSingleNotification(options: CreateOptions): Promise<void> {
  if (!options.userId) throw new Error('userId is required');

  let notificationData;

  if (options.template) {
    // Use template
    const templateData: NotificationEventData = {
      userId: options.userId,
      ...options.templateData
    };

    try {
      notificationData = generateNotificationFromTemplate(options.template, templateData, options.userId);
      logger.info(`Using template: ${options.template}`);
      logger.info(`Template data: ${JSON.stringify(templateData, null, 2)}`);
    } catch (error) {
      logger.error(`Failed to generate notification from template: ${error}`);
      throw error;
    }
  } else {
    // Create custom notification
    notificationData = {
      type: options.type || 'info',
      title: options.title!,
      message: options.message!,
      timestamp: new Date().toISOString(),
      read: false,
      priority: options.priority || 'medium',
      category: options.category || 'custom',
      metadata: {
        userId: options.userId,
        createdBy: 'script'
      }
    };
  }

  try {
    const created = await notificationStore.createNotification(options.userId, notificationData);
    logger.success(`✅ Created notification: ${created.id}`);
    logger.info(`   Title: ${created.title}`);
    logger.info(`   Type: ${created.type} | Priority: ${created.priority}`);
    logger.info(`   Message: ${created.message}`);
  } catch (error) {
    logger.error(`Failed to create notification: ${error}`);
    throw error;
  }
}

async function createBatchNotifications(batchFile: string): Promise<void> {
  let batchData: BatchNotification[];

  try {
    const fileContent = fs.readFileSync(batchFile, 'utf8');
    batchData = JSON.parse(fileContent);
  } catch (error) {
    logger.error(`Failed to read or parse batch file: ${error}`);
    throw error;
  }

  if (!Array.isArray(batchData)) {
    logger.error('Batch file must contain an array of notifications');
    throw new Error('Invalid batch file format');
  }

  logger.info(`📦 Processing batch of ${batchData.length} notifications...`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < batchData.length; i++) {
    const notification = batchData[i];
    
    try {
      logger.info(`\n📝 Creating notification ${i + 1}/${batchData.length} for user ${notification.userId}...`);
      
      const options: CreateOptions = {
        userId: notification.userId,
        template: notification.template,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        category: notification.category,
        templateData: notification.templateData
      };

      validateOptions(options);
      await createSingleNotification(options);
      successCount++;
      
    } catch (error) {
      logger.error(`Failed to create notification ${i + 1}: ${error}`);
      failureCount++;
    }
  }

  logger.info(`\n📊 Batch creation complete:`);
  logger.success(`✅ Success: ${successCount} notifications created`);
  if (failureCount > 0) {
    logger.error(`❌ Failed: ${failureCount} notifications failed`);
  }
}

async function main() {
  loadEnvFile();

  const options = parseArgs();

  logger.info('📧 Custom Notification Creator');

  // Check KV store status
  logger.info('🔍 Checking KV store status...');
  const kvAvailable = await isKVAvailable();
  if (!kvAvailable) {
    logger.error('KV store is not available. Please check your configuration.');
    logger.error('Make sure you have:');
    logger.error('- KV_REST_API_URL environment variable set');
    logger.error('- KV_REST_API_TOKEN environment variable set');
    logger.error('- Valid Vercel KV credentials');
    process.exit(1);
  }

  logger.success('KV store is available');

  // Validate options
  validateOptions(options);

  try {
    if (options.batch) {
      await createBatchNotifications(options.batch);
    } else {
      logger.info(`Creating notification for user: ${options.userId}`);
      await createSingleNotification(options);
    }

    logger.success('🎉 Notification creation complete!');
  } catch (error) {
    logger.error(`Operation failed: ${error}`);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});