/**
 * localStorage utilities for swap token preferences
 */

import { TokenCacheData } from '@repo/tokens';

// LocalStorage keys for token preferences
export const STORAGE_KEYS = {
    FROM_TOKEN: 'charisma_swap_from_token',
    TO_TOKEN: 'charisma_swap_to_token',
    CONDITION_TOKEN: 'charisma_swap_condition_token',
    BASE_TOKEN: 'charisma_swap_base_token',
    MODE: 'charisma_swap_mode',
    USE_SUBNET_FROM: 'charisma_swap_use_subnet_from',
    USE_SUBNET_TO: 'charisma_swap_use_subnet_to',
} as const;

// Helper functions for localStorage
export const saveToStorage = (key: string, value: any) => {
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (err) {
        console.warn('Failed to save to localStorage:', err);
    }
};

export const loadFromStorage = (key: string) => {
    try {
        if (typeof window !== 'undefined') {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        }
    } catch (err) {
        console.warn('Failed to load from localStorage:', err);
    }
    return null;
};

// Token preference types
interface TokenPreference {
    contractId: string;
    symbol: string;
    type: string;
}

interface SwapPreferences {
    fromToken?: TokenPreference;
    toToken?: TokenPreference;
    conditionToken?: TokenPreference;
    baseToken?: TokenPreference;
    mode?: 'swap' | 'order';
    useSubnetFrom?: boolean;
    useSubnetTo?: boolean;
}

// Save all token preferences at once
export const saveSwapPreferences = (preferences: SwapPreferences) => {
    const { fromToken, toToken, conditionToken, baseToken, mode, useSubnetFrom, useSubnetTo } = preferences;
    
    if (fromToken) {
        saveToStorage(STORAGE_KEYS.FROM_TOKEN, {
            contractId: fromToken.contractId,
            symbol: fromToken.symbol,
            type: fromToken.type
        });
    }
    if (toToken) {
        saveToStorage(STORAGE_KEYS.TO_TOKEN, {
            contractId: toToken.contractId,
            symbol: toToken.symbol,
            type: toToken.type
        });
    }
    if (conditionToken) {
        saveToStorage(STORAGE_KEYS.CONDITION_TOKEN, {
            contractId: conditionToken.contractId,
            symbol: conditionToken.symbol,
            type: conditionToken.type
        });
    }
    if (baseToken) {
        saveToStorage(STORAGE_KEYS.BASE_TOKEN, {
            contractId: baseToken.contractId,
            symbol: baseToken.symbol,
            type: baseToken.type
        });
    }
    if (mode !== undefined) {
        saveToStorage(STORAGE_KEYS.MODE, mode);
    }
    if (useSubnetFrom !== undefined) {
        saveToStorage(STORAGE_KEYS.USE_SUBNET_FROM, useSubnetFrom);
    }
    if (useSubnetTo !== undefined) {
        saveToStorage(STORAGE_KEYS.USE_SUBNET_TO, useSubnetTo);
    }
};

// Load basic preferences (mode and subnet toggles) immediately on mount
export const loadBasicPreferences = () => {
    return {
        mode: loadFromStorage(STORAGE_KEYS.MODE),
        useSubnetFrom: loadFromStorage(STORAGE_KEYS.USE_SUBNET_FROM),
        useSubnetTo: loadFromStorage(STORAGE_KEYS.USE_SUBNET_TO),
    };
};

// Load token preferences from localStorage
export const loadTokenPreferences = (selectedTokens: TokenCacheData[]) => {
    const savedFromToken = loadFromStorage(STORAGE_KEYS.FROM_TOKEN);
    const savedToToken = loadFromStorage(STORAGE_KEYS.TO_TOKEN);
    const savedConditionToken = loadFromStorage(STORAGE_KEYS.CONDITION_TOKEN);
    const savedBaseToken = loadFromStorage(STORAGE_KEYS.BASE_TOKEN);

    // Find tokens in current token list that match saved preferences
    const fromToken = savedFromToken ? 
        selectedTokens.find(t => t.contractId === savedFromToken.contractId) : null;
    const toToken = savedToToken ? 
        selectedTokens.find(t => t.contractId === savedToToken.contractId) : null;
    const conditionToken = savedConditionToken ? 
        selectedTokens.find(t => t.contractId === savedConditionToken.contractId) : null;
    const baseToken = savedBaseToken ? 
        selectedTokens.find(t => t.contractId === savedBaseToken.contractId) : null;

    return {
        fromToken,
        toToken,
        conditionToken,
        baseToken
    };
};

// Clear all token preferences from localStorage
export const clearTokenPreferences = () => {
    try {
        if (typeof window !== 'undefined') {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
        }
    } catch (err) {
        console.warn('Failed to clear localStorage preferences:', err);
    }
};