import { NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/service';
import { notificationService } from '@/lib/services/notifications/service';
import { searchService } from '@/lib/services/search';
import { userService } from '@/lib/services/user/service';

/**
 * GET /api/v1/search
 * 
 * Global search endpoint that searches across all data types
 */
export async function GET(request: NextRequest) {
  try {
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

    // Load all data for searching
    const [bots, notifications, allUsersData] = await Promise.all([
      botService.scanAllBots(),
      notificationService.scanAllNotifications(),
      userService.getAllUsersData()
    ]);

    // Transform user data for search
    const users = allUsersData.map(userData => ({
      userId: userData.userId,
      address: userData.userData.wallet.address || '',
      connectionMethod: userData.userData.wallet.connectionMethod || undefined,
      network: userData.userData.wallet.network || undefined,
      lastActive: undefined // lastActive is not available in the current user data structure
    }));

    // Get all transactions from all users
    const allTransactions = allUsersData.flatMap(userData => 
      userData.userData.wallet.transactions || []
    );

    // Perform search
    const results = await searchService.search({
      query,
      options: {
        maxResults,
        categories: categories as any,
        fuzzyThreshold: 0.3,
        includeInactive: true
      }
    }, {
      bots,
      notifications,
      users,
      transactions: allTransactions
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

    // Load all data for searching
    const [bots, notifications, allUsersData] = await Promise.all([
      botService.scanAllBots(),
      notificationService.scanAllNotifications(),
      userService.getAllUsersData()
    ]);

    // Transform user data for search
    const users = allUsersData.map(userData => ({
      userId: userData.userId,
      address: userData.userData.wallet.address || '',
      connectionMethod: userData.userData.wallet.connectionMethod || undefined,
      network: userData.userData.wallet.network || undefined,
      lastActive: undefined // lastActive is not available in the current user data structure
    }));

    // Get all transactions from all users
    const allTransactions = allUsersData.flatMap(userData => 
      userData.userData.wallet.transactions || []
    );

    // Perform search
    const results = await searchService.search({
      query,
      options: {
        maxResults: options.maxResults || 10,
        categories: options.categories || ['bot', 'notification', 'user', 'transaction'],
        fuzzyThreshold: options.fuzzyThreshold || 0.3,
        includeInactive: options.includeInactive !== false
      }
    }, {
      bots,
      notifications,
      users,
      transactions: allTransactions
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