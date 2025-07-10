import { NextRequest, NextResponse } from 'next/server';

import { getCurrentEnvironment, getDebugInfo, getEnvConfig, isClientSide,isServerSide } from '@/lib/infrastructure/config/env';
import { AppMetadataSchema } from '@/schemas/app-metadata.schema';

/**
 * GET /api/v1/metadata
 * Returns live app metadata based on environment configuration
 * No longer uses KV store - returns real-time environment config
 */
export async function GET(request: NextRequest) {
  try {
    // Get live environment configuration
    const envConfig = getEnvConfig();
    const debugInfo = getDebugInfo();
    const environment = getCurrentEnvironment();
    
    // Construct app metadata from live environment
    const appMetadata = {
      // Environment information
      environment,
      
      // Data loading configuration
      loadingConfig: envConfig.loadingConfig,
      
      // API configuration
      apiBaseUrl: envConfig.apiBaseUrl,
      apiTimeout: envConfig.apiTimeout,
      
      // Cache configuration
      cacheEnabled: envConfig.cacheEnabled,
      cacheTtl: envConfig.cacheTtl,
      
      // Debug configuration
      debugDataLoading: envConfig.debugDataLoading,
      logDataSources: envConfig.logDataSources,
      
      // Feature flags
      featureFlags: {
        enableApiMetadata: envConfig.enableApiMetadata,
        enableApiUser: envConfig.enableApiUser,
        enableApiBots: envConfig.enableApiBots,
        enableApiMarket: envConfig.enableApiMarket,
        enableApiNotifications: envConfig.enableApiNotifications,
      },
      
      // Runtime information
      isServer: isServerSide(),
      isClient: isClientSide(),
      timestamp: new Date().toISOString(),
    };
    
    // Validate the metadata against schema
    const validation = AppMetadataSchema.safeParse(appMetadata);
    if (!validation.success) {
      console.error('App metadata validation failed:', validation.error);
      return NextResponse.json(
        { 
          error: 'Invalid metadata structure',
          message: 'App metadata failed schema validation',
          validationErrors: validation.error.errors,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(validation.data, {
      status: 200,
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching app metadata:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch app metadata',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}