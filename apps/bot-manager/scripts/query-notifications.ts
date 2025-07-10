#!/usr/bin/env node

/**
 * Query and list notifications from KV store with filtering and export options
 * 
 * Usage:
 *   pnpm script scripts/query-notifications.ts --userId=user123
 *   pnpm script scripts/query-notifications.ts --userId=user123 --unread-only --format=json
 *   pnpm script scripts/query-notifications.ts --userId=user123 --type=error --export=errors.json
 */

import path from 'path';
import fs from 'fs';
import { notificationStore, isKVAvailable } from '../src/lib/kv-store';
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

interface QueryOptions {
  userId: string;
  unreadOnly: boolean;
  type?: string;
  priority?: string;
  category?: string;
  limit: number;
  offset: number;
  format: 'table' | 'json' | 'csv';
  export?: string;
  stats: boolean;
}

function parseArgs(): QueryOptions {
  const args = process.argv.slice(2);
  const options: QueryOptions = {
    userId: '',
    unreadOnly: false,
    limit: 50,
    offset: 0,
    format: 'table',
    stats: false
  };

  for (const arg of args) {
    if (arg.startsWith('--userId=')) {
      options.userId = arg.split('=')[1];
    } else if (arg === '--unread-only') {
      options.unreadOnly = true;
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1];
    } else if (arg.startsWith('--priority=')) {
      options.priority = arg.split('=')[1];
    } else if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]) || 50;
    } else if (arg.startsWith('--offset=')) {
      options.offset = parseInt(arg.split('=')[1]) || 0;
    } else if (arg.startsWith('--format=')) {
      const format = arg.split('=')[1];
      if (['table', 'json', 'csv'].includes(format)) {
        options.format = format as 'table' | 'json' | 'csv';
      } else {
        logger.error('Invalid format. Must be: table, json, or csv');
        process.exit(1);
      }
    } else if (arg.startsWith('--export=')) {
      options.export = arg.split('=')[1];
    } else if (arg === '--stats') {
      options.stats = true;
    } else if (arg === '--help' || arg === '-h') {
      logger.info(`
Query and list notifications from KV store

Usage:
  pnpm script scripts/query-notifications.ts [options]

Options:
  --userId=<string>       User ID to query notifications for (required)
  --unread-only           Show only unread notifications
  --type=<string>         Filter by notification type (success|error|warning|info)
  --priority=<string>     Filter by priority (high|medium|low)
  --category=<string>     Filter by category
  --limit=<number>        Maximum number of notifications to retrieve [default: 50]
  --offset=<number>       Number of notifications to skip [default: 0]
  --format=<string>       Output format (table|json|csv) [default: table]
  --export=<file>         Export results to file
  --stats                 Show statistics and summary
  --help, -h              Show this help message

Examples:
  # List all notifications for a user (table format)
  pnpm script scripts/query-notifications.ts --userId=user123

  # Show only unread error notifications
  pnpm script scripts/query-notifications.ts --userId=user123 --unread-only --type=error

  # Export high priority notifications to JSON
  pnpm script scripts/query-notifications.ts --userId=user123 --priority=high --format=json --export=high_priority.json

  # Get statistics summary
  pnpm script scripts/query-notifications.ts --userId=user123 --stats

  # Show first 10 notifications in CSV format
  pnpm script scripts/query-notifications.ts --userId=user123 --limit=10 --format=csv
`);
      process.exit(0);
    }
  }

  if (!options.userId) {
    logger.error('--userId is required');
    process.exit(1);
  }

  // Validate type if provided
  if (options.type && !['success', 'error', 'warning', 'info'].includes(options.type)) {
    logger.error('Invalid --type value. Must be: success, error, warning, or info');
    process.exit(1);
  }

  // Validate priority if provided
  if (options.priority && !['high', 'medium', 'low'].includes(options.priority)) {
    logger.error('Invalid --priority value. Must be: high, medium, or low');
    process.exit(1);
  }

  return options;
}

function formatTableOutput(notifications: any[]): void {
  if (notifications.length === 0) {
    logger.info('No notifications found.');
    return;
  }

  // Table headers
  const headers = ['ID', 'Type', 'Priority', 'Title', 'Status', 'Created'];
  const columnWidths = [8, 8, 8, 40, 6, 12];

  // Print header
  const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ');
  const separator = columnWidths.map(width => '-'.repeat(width)).join('-+-');
  
  console.log(headerRow);
  console.log(separator);

  // Print rows
  notifications.forEach(notification => {
    const row = [
      notification.id.slice(-8),
      notification.type,
      notification.priority,
      notification.title.length > 37 ? notification.title.slice(0, 37) + '...' : notification.title,
      notification.read ? 'Read' : 'Unread',
      new Date(notification.timestamp).toLocaleDateString()
    ];

    const formattedRow = row.map((cell, i) => String(cell).padEnd(columnWidths[i])).join(' | ');
    console.log(formattedRow);
  });

  console.log(`\nShowing ${notifications.length} notifications`);
}

function formatJsonOutput(notifications: any[], options: QueryOptions): string {
  const output = {
    userId: options.userId,
    filters: {
      unreadOnly: options.unreadOnly,
      type: options.type,
      priority: options.priority,
      category: options.category,
      limit: options.limit,
      offset: options.offset
    },
    count: notifications.length,
    notifications: notifications,
    timestamp: new Date().toISOString()
  };

  return JSON.stringify(output, null, 2);
}

function formatCsvOutput(notifications: any[]): string {
  if (notifications.length === 0) {
    return 'id,type,priority,title,message,status,category,created,updated\n';
  }

  const headers = ['id', 'type', 'priority', 'title', 'message', 'status', 'category', 'created', 'updated'];
  const csvRows = [headers.join(',')];

  notifications.forEach(notification => {
    const row = [
      notification.id,
      notification.type,
      notification.priority,
      `"${notification.title.replace(/"/g, '""')}"`, // Escape quotes
      `"${notification.message.replace(/"/g, '""')}"`,
      notification.read ? 'read' : 'unread',
      notification.category,
      notification.createdAt,
      notification.updatedAt
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

async function showStatistics(userId: string): Promise<void> {
  try {
    const counts = await notificationStore.getNotificationCounts(userId);
    const allNotifications = await notificationStore.getNotifications(userId, { limit: 1000 });

    logger.info('\n📊 Notification Statistics:');
    logger.info(`Total notifications: ${counts.total}`);
    logger.info(`Unread notifications: ${counts.unread}`);
    logger.info(`Read notifications: ${counts.total - counts.unread}`);

    // Type breakdown
    logger.info('\n📈 By Type:');
    Object.entries(counts.byType).forEach(([type, count]) => {
      logger.info(`  ${type}: ${count}`);
    });

    // Priority breakdown
    logger.info('\n⚡ By Priority:');
    Object.entries(counts.byPriority).forEach(([priority, count]) => {
      logger.info(`  ${priority}: ${count}`);
    });

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    allNotifications.notifications.forEach(n => {
      categoryBreakdown[n.category] = (categoryBreakdown[n.category] || 0) + 1;
    });

    if (Object.keys(categoryBreakdown).length > 0) {
      logger.info('\n📂 By Category:');
      Object.entries(categoryBreakdown).forEach(([category, count]) => {
        logger.info(`  ${category}: ${count}`);
      });
    }

    // Recent activity (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentNotifications = allNotifications.notifications.filter(n => 
      new Date(n.timestamp) > weekAgo
    );

    logger.info(`\n📅 Recent Activity (last 7 days): ${recentNotifications.length} notifications`);

    // Oldest and newest
    if (allNotifications.notifications.length > 0) {
      const sorted = [...allNotifications.notifications].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      logger.info(`\n⏰ Oldest notification: ${new Date(sorted[0].timestamp).toLocaleString()}`);
      logger.info(`⏰ Newest notification: ${new Date(sorted[sorted.length - 1].timestamp).toLocaleString()}`);
    }

  } catch (error) {
    logger.error(`Failed to generate statistics: ${error}`);
  }
}

async function main() {
  loadEnvFile();

  const options = parseArgs();

  logger.info('🔍 Notification Query Tool');
  logger.info(`Querying notifications for user: ${options.userId}`);

  // Show filters if any
  const filters = [];
  if (options.unreadOnly) filters.push('unread only');
  if (options.type) filters.push(`type: ${options.type}`);
  if (options.priority) filters.push(`priority: ${options.priority}`);
  if (options.category) filters.push(`category: ${options.category}`);
  
  if (filters.length > 0) {
    logger.info(`Filters: ${filters.join(', ')}`);
  }

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

  try {
    // Show statistics if requested
    if (options.stats) {
      await showStatistics(options.userId);
      if (!options.export && options.format === 'table') {
        return; // Exit early for stats-only queries
      }
    }

    // Build query filters
    const queryFilters: any = {
      limit: options.limit,
      offset: options.offset
    };

    if (options.type) queryFilters.type = options.type;
    if (options.category) queryFilters.category = options.category;
    if (options.unreadOnly) queryFilters.read = false;

    // Query notifications
    const result = await notificationStore.getNotifications(options.userId, queryFilters);
    let notifications = result.notifications;

    // Apply client-side filtering for priority (if KV store doesn't support it)
    if (options.priority) {
      notifications = notifications.filter(n => n.priority === options.priority);
    }

    if (!options.stats) {
      logger.info(`Found ${notifications.length} notifications (total available: ${result.total})`);
    }

    // Format and display output
    let output: string = '';

    switch (options.format) {
      case 'table':
        if (!options.export) {
          formatTableOutput(notifications);
        } else {
          // For table export, convert to a readable text format
          output = notifications.map(n => 
            `${n.id} | ${n.type} | ${n.priority} | ${n.title} | ${n.read ? 'Read' : 'Unread'} | ${new Date(n.timestamp).toLocaleString()}\n${n.message}\n---`
          ).join('\n\n');
        }
        break;
      
      case 'json':
        output = formatJsonOutput(notifications, options);
        if (!options.export) {
          console.log(output);
        }
        break;
      
      case 'csv':
        output = formatCsvOutput(notifications);
        if (!options.export) {
          console.log(output);
        }
        break;
    }

    // Export to file if requested
    if (options.export && output) {
      try {
        fs.writeFileSync(options.export, output, 'utf8');
        logger.success(`✅ Exported ${notifications.length} notifications to: ${options.export}`);
      } catch (error) {
        logger.error(`Failed to export to file: ${error}`);
        process.exit(1);
      }
    }

    // Show pagination info
    if (result.hasMore) {
      logger.info(`\n📄 Pagination: Showing ${options.offset + 1}-${options.offset + notifications.length} of ${result.total}`);
      logger.info(`Next page: Add --offset=${options.offset + options.limit} to see more`);
    }

    logger.success('🎉 Query complete!');

  } catch (error) {
    logger.error(`Query failed: ${error}`);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});