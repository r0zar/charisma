/**
 * React state management for real-time Blaze data
 * Replaces Zustand stores with useReducer
 */

import { PriceData, RealtimeBalanceData, TokenMetadata } from '../types';

// State interface
export interface BlazeState {
  // Prices
  prices: Record<string, PriceData>;
  pricesConnected: boolean;
  pricesLastUpdate: number;

  // Balances  
  balances: Record<string, RealtimeBalanceData>; // key: `${userId}:${contractId}`
  balancesConnected: boolean;
  balancesLastUpdate: number;

  // Metadata
  metadata: Record<string, TokenMetadata>;
  metadataConnected: boolean;
  metadataLastUpdate: number;
}

// Action types
export type BlazeAction =
  | { type: 'PRICE_UPDATE'; contractId: string; price: number; timestamp: number; source?: string }
  | { type: 'PRICE_BATCH'; prices: PriceData[] }
  | { type: 'PRICES_CONNECTION'; connected: boolean }
  
  | { type: 'BALANCE_UPDATE'; userId: string; contractId: string; balance: RealtimeBalanceData }
  | { type: 'BALANCES_CONNECTION'; connected: boolean }
  
  | { type: 'METADATA_UPDATE'; contractId: string; metadata: TokenMetadata }
  | { type: 'METADATA_CONNECTION'; connected: boolean };

// Initial state
export const initialState: BlazeState = {
  prices: {},
  pricesConnected: false,
  pricesLastUpdate: 0,

  balances: {},
  balancesConnected: false,
  balancesLastUpdate: 0,

  metadata: {},
  metadataConnected: false,
  metadataLastUpdate: 0,
};

// Reducer function
export function blazeReducer(state: BlazeState, action: BlazeAction): BlazeState {
  switch (action.type) {
    // Price actions
    case 'PRICE_UPDATE':
      return {
        ...state,
        prices: {
          ...state.prices,
          [action.contractId]: {
            contractId: action.contractId,
            price: action.price,
            timestamp: action.timestamp,
            source: action.source
          }
        },
        pricesLastUpdate: Date.now()
      };

    case 'PRICE_BATCH':
      const newPrices = { ...state.prices };
      action.prices.forEach(price => {
        newPrices[price.contractId] = price;
      });
      return {
        ...state,
        prices: newPrices,
        pricesLastUpdate: Date.now()
      };

    case 'PRICES_CONNECTION':
      return {
        ...state,
        pricesConnected: action.connected
      };


    // Balance actions
    case 'BALANCE_UPDATE': {
      const key = `${action.userId}:${action.contractId}`;
      return {
        ...state,
        balances: {
          ...state.balances,
          [key]: action.balance
        },
        balancesLastUpdate: Date.now()
      };
    }

    case 'BALANCES_CONNECTION':
      return {
        ...state,
        balancesConnected: action.connected
      };


    // Metadata actions
    case 'METADATA_UPDATE':
      return {
        ...state,
        metadata: {
          ...state.metadata,
          [action.contractId]: action.metadata
        },
        metadataLastUpdate: Date.now()
      };

    case 'METADATA_CONNECTION':
      return {
        ...state,
        metadataConnected: action.connected
      };


    default:
      return state;
  }
}

// Utility functions that can be used with the state
export const stateUtils = {
  getPrice: (state: BlazeState, contractId: string): number | undefined => {
    return state.prices[contractId]?.price;
  },

  formatPrice: (state: BlazeState, contractId: string): string => {
    const price = stateUtils.getPrice(state, contractId);
    if (price === undefined || price === null || isNaN(price)) return '$0.00';

    // Smart dynamic precision
    if (price === 0) return '$0.00';
    if (price < 0.000001) {
      return `$${price.toExponential(2)}`; // scientific notation for tiny values
    } else if (price < 0.01) {
      return `$${price.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')}`; // up to 8 decimals, trim trailing zeros
    } else if (price < 1) {
      return `$${price.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`; // up to 6 decimals
    } else if (price < 1000) {
      return `$${price.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`; // up to 4 decimals
    } else {
      // For large prices, use commas and 2 decimals
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  },

  getBalance: (state: BlazeState, userId: string, contractId: string): RealtimeBalanceData | undefined => {
    const key = `${userId}:${contractId}`;
    return state.balances[key];
  },

  getMetadata: (state: BlazeState, contractId: string): TokenMetadata | undefined => {
    return state.metadata[contractId];
  },

  isConnected: (state: BlazeState): boolean => {
    return state.pricesConnected && state.balancesConnected && state.metadataConnected;
  },

  getLastUpdate: (state: BlazeState): number => {
    return Math.max(state.pricesLastUpdate, state.balancesLastUpdate, state.metadataLastUpdate);
  }
};