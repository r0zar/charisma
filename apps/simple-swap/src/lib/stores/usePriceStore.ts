import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { usePartySocket } from 'partysocket/react';
import { useEffect, useCallback, useRef, useMemo } from 'react';

interface PriceData {
    contractId: string;
    price: number;
    timestamp: number;
}

interface PriceStore {
    // State - read-only from client perspective
    prices: Record<string, PriceData>;
    isConnected: boolean;
    lastUpdate: number;
    subscribedTokens: Set<string>;

    // Read-only actions
    getPrice: (contractId: string) => number | undefined;
    formatPrice: (contractId: string) => string;

    // Subscription management
    addSubscription: (contractIds: string[]) => void;
    removeSubscription: (contractIds: string[]) => void;

    // Internal state updates
    _updatePrice: (contractId: string, price: number, timestamp: number) => void;
    _setConnectionStatus: (connected: boolean) => void;
}

const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

export const usePriceStore = create<PriceStore>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        prices: {},
        isConnected: false,
        lastUpdate: 0,
        subscribedTokens: new Set(),

        // Read-only getters
        getPrice: (contractId) => {
            return get().prices[contractId]?.price;
        },

        formatPrice: (contractId) => {
            const price = get().getPrice(contractId);
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

        // Subscription management (now just manages local state)
        addSubscription: (contractIds) => {
            const { subscribedTokens } = get();
            const newSubscriptions = new Set(subscribedTokens);
            contractIds.forEach(id => newSubscriptions.add(id));
            set({ subscribedTokens: newSubscriptions });
        },

        removeSubscription: (contractIds) => {
            const { subscribedTokens } = get();
            const newSubscriptions = new Set(subscribedTokens);
            contractIds.forEach(id => newSubscriptions.delete(id));
            set({ subscribedTokens: newSubscriptions });
        },

        // Internal update methods
        _updatePrice: (contractId, price, timestamp) => {
            set((state) => ({
                prices: {
                    ...state.prices,
                    [contractId]: { contractId, price, timestamp }
                },
                lastUpdate: Date.now()
            }));
        },

        _setConnectionStatus: (connected) => {
            set({ isConnected: connected });
        }
    }))
);

// React hook for managing PartySocket connection and price subscriptions
export const usePriceConnection = (contractIds: string[] = []) => {
    const store = usePriceStore();

    // SOLUTION 1: Memoize the contractIds to prevent unnecessary re-renders
    const stableContractIds = useMemo(() => {
        // Sort and create a stable reference only when values actually change
        return [...contractIds].sort();
    }, [contractIds.join(',')]); // Use join as dependency to check actual values

    // Create PartySocket connection using the React hook
    const socket = usePartySocket({
        host: PARTY_HOST,
        room: 'prices',
        onOpen: () => {
            console.log('✅ Connected to price server');
            store._setConnectionStatus(true);
        },
        onClose: () => {
            console.log('🔌 Disconnected from price server');
            store._setConnectionStatus(false);
        },
        onError: (error) => {
            console.error('Price server connection error:', error);
            store._setConnectionStatus(false);
        },
        onMessage: (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'PRICE_UPDATE':
                        store._updatePrice(data.contractId, data.price, data.timestamp);
                        break;

                    case 'PRICE_BATCH':
                        data.prices.forEach((price: PriceData) => store._updatePrice(price.contractId, price.price, price.timestamp));
                        break;

                    case 'ERROR':
                        console.error('Price server error:', data.message);
                        break;
                }
            } catch (error) {
                console.error('Error parsing price message:', error);
            }
        }
    });

    // Subscription management
    const subscribeToTokens = (tokenIds: string[]) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'SUBSCRIBE',
                contractIds: tokenIds,
                clientId: socket.id || 'unknown'
            }));
            console.log(`📊 Subscribed to: ${tokenIds.join(', ')}`);
        }
        store.addSubscription(tokenIds);
    };

    const unsubscribeFromTokens = (tokenIds: string[]) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'UNSUBSCRIBE',
                contractIds: tokenIds,
                clientId: socket.id || 'unknown'
            }));
            console.log(`📊 Unsubscribed from: ${tokenIds.join(', ')}`);
        }
        store.removeSubscription(tokenIds);
    };

    // Use a ref to track the last subscribed contract IDs
    const lastContractIds = useRef<string[]>([]);

    // Auto-subscribe to provided contract IDs
    useEffect(() => {
        // Only proceed if socket is connected and contract IDs have changed
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }

        // Compare current contractIds with last ones
        const hasChanged =
            stableContractIds.length !== lastContractIds.current.length ||
            !stableContractIds.every((id, index) => id === lastContractIds.current[index]);

        if (!hasChanged) {
            return;
        }

        // Unsubscribe from old contract IDs
        if (lastContractIds.current.length > 0) {
            unsubscribeFromTokens(lastContractIds.current);
        }

        // Subscribe to new contract IDs
        if (stableContractIds.length > 0) {
            subscribeToTokens(stableContractIds);
        }

        // Update the ref
        lastContractIds.current = stableContractIds;

        // Cleanup function for component unmount
        return () => {
            if (stableContractIds.length > 0) {
                unsubscribeFromTokens(stableContractIds);
            }
        };
    }, [stableContractIds, socket?.readyState]);

    return {
        socket,
        isConnected: store.isConnected,
        subscribeToTokens,
        unsubscribeFromTokens,
        // Expose store methods for convenience
        getPrice: store.getPrice,
        formatPrice: store.formatPrice,
        prices: store.prices,
        lastUpdate: store.lastUpdate
    };
};

// Hook for components that only need to read price data (no connection management)
export const usePriceData = (contractIds?: string[]) => {
    const store = usePriceStore();

    if (contractIds) {
        const prices = contractIds.reduce((acc, id) => {
            const price = store.getPrice(id);
            if (price !== undefined) {
                acc[id] = price;
            }
            return acc;
        }, {} as Record<string, number>);

        return {
            prices,
            formatPrice: store.formatPrice,
            isConnected: store.isConnected,
            lastUpdate: store.lastUpdate
        };
    }

    return {
        prices: store.prices,
        getPrice: store.getPrice,
        formatPrice: store.formatPrice,
        isConnected: store.isConnected,
        lastUpdate: store.lastUpdate
    };
};