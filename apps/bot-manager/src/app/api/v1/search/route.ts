import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/core/service';
import { notificationService } from '@/lib/services/notifications/service';
import { searchService } from '@/lib/services/search';

/**
 * GET /api/v1/search
 * 
 * Global search endpoint that searches across all data types
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      console.warn(`❌ Unauthenticated search request`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to perform searches',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // No need to fetch wallet data anymore - using Clerk userId directly

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const maxResults = parseInt(searchParams.get('maxResults') || '10');
    const categories = searchParams.get('categories')?.split(',') || ['bot', 'notification', 'user', 'transaction'];

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        bots: [],
        notifications: [],
        users: [],
        transactions: [],
        totalResults: 0,
        query: query || '',
        searchTime: 0
      });
    }

    console.log(`🔍 Authenticated search request from user ${userId} for query: "${query}"`);

    // Load only user's own data for searching using Clerk userId
    const [userBots, userNotifications] = await Promise.all([
      botService.getAllBotsByClerkUserId(userId),
      notificationService.getUserNotifications(userId)
    ]);

    // User data for search (only current user) - minimal data since we use Clerk now
    const users = [{
      userId: userId,
      address: 'clerk-user', // Placeholder since we don't rely on wallet addresses anymore
      connectionMethod: undefined,
      network: undefined,
      lastActive: undefined
    }];

    // No user transactions in Clerk-based system
    const userTransactions: any[] = [];

    // Perform search on user's own data only
    const results = await searchService.search({
      query,
      options: {
        maxResults,
        categories: categories as any,
        fuzzyThreshold: 0.3,
        includeInactive: true
      }
    }, {
      bots: userBots,
      notifications: userNotifications,
      users,
      transactions: userTransactions
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('Search API error:', error);

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/search
 * 
 * Advanced search with more options
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      console.warn(`❌ Unauthenticated advanced search request`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to perform searches',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // No need to fetch wallet data anymore - using Clerk userId directly

    const body = await request.json();
    const { query, options = {} } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        bots: [],
        notifications: [],
        users: [],
        transactions: [],
        totalResults: 0,
        query: query || '',
        searchTime: 0
      });
    }

    console.log(`🔍 Authenticated advanced search request from user ${userId} (${userData.wallet.address}) for query: "${query}"`);

    // Load only user's own data for searching using Clerk userId
    const [userBots, userNotifications] = await Promise.all([
      botService.getAllBotsByClerkUserId(userId),
      notificationService.getUserNotifications(userId)
    ]);

    // User data for search (only current user) - minimal data since we use Clerk now
    const users = [{
      userId: userId,
      address: 'clerk-user', // Placeholder since we don't rely on wallet addresses anymore
      connectionMethod: undefined,
      network: undefined,
      lastActive: undefined
    }];

    // No user transactions in Clerk-based system
    const userTransactions: any[] = [];

    // Perform search on user's own data only
    const results = await searchService.search({
      query,
      options: {
        maxResults: options.maxResults || 10,
        categories: options.categories || ['bot', 'notification', 'user', 'transaction'],
        fuzzyThreshold: options.fuzzyThreshold || 0.3,
        includeInactive: options.includeInactive !== false
      }
    }, {
      bots: userBots,
      notifications: userNotifications,
      users,
      transactions: userTransactions
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('Search API error:', error);

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}