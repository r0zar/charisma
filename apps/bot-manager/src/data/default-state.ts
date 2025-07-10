import { type AppState } from '@/schemas/app-state.schema';

/**
 * Default application state data
 * Used as fallback when main state fails to load
 */
export const defaultState: AppState = {
  "metadata": {
    "environment": "development",
    "loadingConfig": "static",
    "apiBaseUrl": "http://localhost:3420/api/v1",
    "apiTimeout": 30000,
    "cacheEnabled": true,
    "cacheTtl": 300000,
    "debugDataLoading": false,
    "logDataSources": false,
    "featureFlags": {
      "enableApiMetadata": false,
      "enableApiUser": false,
      "enableApiBots": false,
      "enableApiMarket": false,
      "enableApiNotifications": false
    },
    "isServer": false,
    "isClient": false,
    "timestamp": "2024-01-25T10:00:00.000Z"
  },
  "user": {
    "settings": {
      "general": {
        "isDarkMode": false,
        "compactMode": false,
        "autoRefresh": true
      },
      "network": {
        "network": "mainnet",
        "rpcEndpoint": "https://stacks-node-api.mainnet.stacks.co"
      },
      "botDefaults": {
        "defaultStrategy": "yield-farming"
      },
      "notifications": {
        "trade": true,
        "error": true,
        "status": false,
        "performance": true,
        "security": true
      },
      "notificationChannel": "browser",
      "security": {
        "apiKey": "sk-1234567890abcdef1234567890abcdef12345678",
        "autoLockTimeout": "30",
        "requireConfirmation": true
      },
      "advanced": {
        "debugMode": false,
        "performanceMonitoring": true
      }
    },
    "wallet": {
      "isConnected": false,
      "address": null,
      "network": "mainnet",
      "balance": {
        "stx": 0,
        "tokens": []
      },
      "transactions": [],
      "connectionMethod": null
    },
    "preferences": {
      "sidebarCollapsed": false,
      "theme": "light",
      "skin": "default",
      "language": "en",
      "timezone": "America/New_York",
      "dateFormat": "ISO",
      "numberFormat": "US"
    }
  },
  "bots": {
    "list": [],
    "stats": {
      "totalBots": 0,
      "activeBots": 0,
      "pausedBots": 0,
      "errorBots": 0,
    },
  },
  // Market data removed
  "notifications": []
} as const;