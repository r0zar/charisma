import { NextRequest, NextResponse } from 'next/server';

import { dataLoader } from '@/lib/modules/storage/loader';
import { userDataStore } from '@/lib/modules/storage';

/**
 * GET /api/v1/user
 * Returns user data (settings, wallet, preferences)
 * Query params:
 * - userId: User ID (required for KV store)
 * - default: 'true' to use default state
 * - section: 'settings' | 'wallet' | 'preferences' to get specific section
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const useDefault = searchParams.get('default') === 'true';
    const section = searchParams.get('section') as 'settings' | 'wallet' | 'preferences' | null;

    // Check if user API is enabled
    if (!dataLoader.isApiEnabled('user')) {
      return NextResponse.json(
        {
          error: 'User API not enabled',
          message: 'User API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    console.log(`👤 User data request for user: ${userId.slice(0, 8)}...`);

    let userData;
    const dataSource = 'kv';

    // Try to get user data from KV store
    userData = await userDataStore.getUserData(userId);

    if (!userData) {
      return NextResponse.json(
        {
          error: 'User not found',
          message: `No user data found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    let responseData;

    if (section) {
      // Return specific section
      if (!userData[section]) {
        return NextResponse.json(
          {
            error: 'Invalid section',
            message: `Section '${section}' not found`,
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }
      responseData = {
        [section]: userData[section],
        source: dataSource,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Return all user data
      responseData = {
        ...userData,
        source: dataSource,
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/user
 * Update user data in KV store
 * Query params:
 * - userId: User ID (required)
 * - section: 'settings' | 'wallet' | 'preferences' to update specific section
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const section = searchParams.get('section') as 'settings' | 'wallet' | 'preferences' | null;

    // Check if user API is enabled
    if (!dataLoader.isApiEnabled('user')) {
      return NextResponse.json(
        {
          error: 'User API not enabled',
          message: 'User API feature is not enabled',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // For multi-user KV store, userId is required
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Missing userId',
          message: 'userId parameter is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    console.log(`👤 User data update for user: ${userId.slice(0, 8)}...`);

    let updatedUserData;

    if (section) {
      // Update specific section
      if (section === 'settings') {
        updatedUserData = await userDataStore.updateUserSettings(userId, body);
      } else if (section === 'preferences') {
        updatedUserData = await userDataStore.updateUserPreferences(userId, body);
      } else if (section === 'wallet') {
        updatedUserData = await userDataStore.updateWalletState(userId, body);
      } else {
        return NextResponse.json(
          {
            error: 'Invalid section',
            message: `Section '${section}' is not valid`,
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
    } else {
      // Update all user data
      updatedUserData = await userDataStore.updateUserData(userId, body);
    }

    if (!updatedUserData) {
      return NextResponse.json(
        {
          error: 'User not found',
          message: `No user data found for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...updatedUserData,
      source: 'kv',
      timestamp: new Date().toISOString(),
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating user data:', error);
    return NextResponse.json(
      {
        error: 'Failed to update user data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}