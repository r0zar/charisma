import { type AppState } from '@/schemas/app-state.schema';

/**
 * Default application state data
 * Used as fallback when main state fails to load
 */
export const defaultState: AppState = {
  "metadata": {
    "version": "1.0.0",
    "generatedAt": "2024-01-25T10:00:00Z",
    "profile": "development",
    "botCount": 3,
    "realistic": false
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
      "totalGas": 0,
      "totalValue": 0,
      "totalPnL": 0,
      "todayPnL": 0
    },
    "activities": []
  },
  "market": {
    "data": {
      "tokenPrices": {
        "STX": 0.5,
        "ALEX": 0.1,
        "DIKO": 0.05,
        "USDA": 1.0,
        "CHA": 0.01
      },
      "priceChanges": {
        "STX": 2.5,
        "ALEX": -1.2,
        "DIKO": 0.8,
        "USDA": 0.0,
        "CHA": 15.3
      },
      "marketCap": {
        "STX": 1000000000,
        "ALEX": 50000000,
        "DIKO": 25000000,
        "USDA": 100000000,
        "CHA": 10000000
      }
    },
    "analytics": {
      "totalValue": 0,
      "totalPnL": 0,
      "activeBots": 0,
      "successRate": 0,
      "volumeToday": 0,
      "bestPerformer": "none",
      "worstPerformer": "none",
      "avgGasUsed": 0,
      "totalTransactions": 0,
      "profitableDays": 0,
      "totalDays": 0,
      "timeRange": "24h",
      "chartData": []
    },
    "pools": []
  },
  "notifications": []
} as const;