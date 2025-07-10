import { BotActivity } from '@/types/bot';

// Activity API client types
export interface ActivityFilters {
  botId?: string;
  type?: BotActivity['type'];
  status?: BotActivity['status'];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityResponse {
  success: boolean;
  activities: BotActivity[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
  filters: ActivityFilters & { userId: string };
  timestamp: string;
}

export interface CreateActivityData {
  botId: string;
  type: BotActivity['type'];
  status: BotActivity['status'];
  description: string;
  txid?: string;
  amount?: number;
  token?: string;
  error?: string;
  blockHeight?: number;
  blockTime?: string;
}

export interface ActivityClient {
  getActivities(userId: string, filters?: ActivityFilters): Promise<ActivityResponse>;
  getActivity(userId: string, activityId: string): Promise<{ success: boolean; activity: BotActivity; timestamp: string }>;
  createActivity(userId: string, data: CreateActivityData): Promise<{ success: boolean; activity: BotActivity; timestamp: string }>;
  updateActivity(userId: string, activityId: string, data: Partial<CreateActivityData>): Promise<{ success: boolean; activity: BotActivity; timestamp: string }>;
  deleteActivity(userId: string, activityId: string): Promise<{ success: boolean; activityId: string; timestamp: string }>;
}

/**
 * Activity API client implementation
 */
export class ActivityAPIClient implements ActivityClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get activities with filtering and pagination
   */
  async getActivities(userId: string, filters: ActivityFilters = {}): Promise<ActivityResponse> {
    const searchParams = new URLSearchParams({
      userId,
      ...Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [key, String(value)])
      )
    });

    const response = await fetch(`${this.baseUrl}/activities?${searchParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch activities');
    }

    return response.json();
  }

  /**
   * Get a specific activity by ID
   */
  async getActivity(userId: string, activityId: string) {
    const response = await fetch(`${this.baseUrl}/activities/${activityId}?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch activity');
    }

    return response.json();
  }

  /**
   * Create a new activity
   */
  async createActivity(userId: string, data: CreateActivityData) {
    const response = await fetch(`${this.baseUrl}/activities?userId=${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create activity');
    }

    return response.json();
  }

  /**
   * Update an existing activity
   */
  async updateActivity(userId: string, activityId: string, data: Partial<CreateActivityData>) {
    const response = await fetch(`${this.baseUrl}/activities/${activityId}?userId=${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update activity');
    }

    return response.json();
  }

  /**
   * Delete an activity
   */
  async deleteActivity(userId: string, activityId: string) {
    const response = await fetch(`${this.baseUrl}/activities/${activityId}?userId=${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete activity');
    }

    return response.json();
  }
}

/**
 * Default activity API client instance
 */
export const activityApiClient = new ActivityAPIClient();

/**
 * Hook for using activity API with React
 */
export function useActivityAPI() {
  return activityApiClient;
}