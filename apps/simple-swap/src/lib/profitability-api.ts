/**
 * API client for fetching real profitability data from tx-monitor
 */

import { ProfitabilityData, TimeRange } from '@/types/profitability';

// Re-export types for convenience
export type { ProfitabilityData, TimeRange };

const TX_MONITOR_BASE_URL = process.env.NEXT_PUBLIC_TX_MONITOR_URL || 'http://localhost:3012';

export interface ProfitabilityApiResponse {
  success: boolean;
  data: ProfitabilityData;
  metadata: {
    activityId: string;
    timeRange: TimeRange;
    calculatedAt: string;
  };
}

export interface BulkProfitabilityApiResponse {
  success: boolean;
  data: Record<string, ProfitabilityData | { error: string }>;
  metadata: {
    total: number;
    calculated: number;
    errors: number;
    timestamp: string;
  };
}

/**
 * Fetch profitability data for a single activity
 */
export async function fetchActivityProfitability(
  activityId: string,
  timeRange: TimeRange = 'ALL'
): Promise<ProfitabilityData | null> {
  try {
    const url = `${TX_MONITOR_BASE_URL}/api/v1/activities/${activityId}/profitability?timeRange=${timeRange}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: timeRange === 'ALL' ? 300 : 60, // Cache for 5 minutes for all data, 1 minute for recent
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Activity ${activityId} not found`);
        return null;
      }
      if (response.status === 400) {
        console.warn(`Profitability data not available for activity ${activityId}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: ProfitabilityApiResponse = await response.json();
    return result.data;
  } catch (error) {
    console.error(`Error fetching profitability for activity ${activityId}:`, error);
    return null;
  }
}

/**
 * Fetch profitability data for multiple activities
 */
export async function fetchBulkActivityProfitability(
  activityIds: string[],
  includeChartData: boolean = false
): Promise<Record<string, ProfitabilityData | null>> {
  try {
    if (activityIds.length === 0) {
      return {};
    }

    // Split into chunks of 50 for API limits
    const chunks: string[][] = [];
    for (let i = 0; i < activityIds.length; i += 50) {
      chunks.push(activityIds.slice(i, i + 50));
    }

    const allResults: Record<string, ProfitabilityData | null> = {};

    // Process chunks in parallel
    await Promise.allSettled(
      chunks.map(async (chunk) => {
        const url = `${TX_MONITOR_BASE_URL}/api/v1/activities/profitability/bulk`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            activityIds: chunk,
            includeChartData,
          }),
          next: {
            revalidate: 60, // Cache for 1 minute
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: BulkProfitabilityApiResponse = await response.json();
        
        // Process results
        for (const [activityId, data] of Object.entries(result.data)) {
          if ('error' in data) {
            console.warn(`Error for activity ${activityId}:`, data.error);
            allResults[activityId] = null;
          } else {
            allResults[activityId] = data;
          }
        }
      })
    );

    return allResults;
  } catch (error) {
    console.error('Error fetching bulk profitability data:', error);
    
    // Return null for all requested activities on error
    const errorResults: Record<string, null> = {};
    for (const id of activityIds) {
      errorResults[id] = null;
    }
    return errorResults;
  }
}

/**
 * Check if profitability data is available for an activity
 * (lighter weight check than fetching full data)
 */
export async function checkProfitabilityAvailability(activityId: string): Promise<boolean> {
  try {
    const url = `${TX_MONITOR_BASE_URL}/api/v1/activities/${activityId}/profitability`;
    
    const response = await fetch(url, {
      method: 'HEAD', // Only check headers, don't fetch body
      next: {
        revalidate: 300, // Cache availability for 5 minutes
      },
    });

    return response.ok;
  } catch (error) {
    console.error(`Error checking profitability availability for ${activityId}:`, error);
    return false;
  }
}

