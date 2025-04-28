import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpin } from '@/contexts/SpinContext';
import { useWallet } from '@/contexts/wallet-context';
import type { SpinFeedData } from '@/types/spin';

const API_STREAM_URL = '/api/stream';
const RECONNECT_DELAY = 5000; // 5 seconds
const OFFLINE_TIMEOUT = 10000; // 10 seconds

// Base result type
interface UseSpinFeedResult {
    data: SpinFeedData | null;
    isConnected: boolean;
    error: Error | null;
    // Add dev setter for connection only
    _devSetIsConnected?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useSpinFeed(): UseSpinFeedResult {
    const { actions } = useSpin();
    const { address } = useWallet();
    const { setFeedData, setCurrentUserId } = actions;
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [localData, setLocalData] = useState<SpinFeedData | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastMessageTimeRef = useRef<number>(Date.now());

    // Set the current user ID in the SpinContext whenever the address changes
    useEffect(() => {
        console.log(`[useSpinFeed] Setting current user ID: ${address || null}`);
        setCurrentUserId(address || null);
    }, [address, setCurrentUserId]);

    const connect = useCallback(() => {
        if (eventSourceRef.current) {
            console.warn('useSpinFeed: Attempted to connect when already connected or connecting.');
            return; // Avoid multiple connections
        }

        // Add user ID to API URL if available
        const apiUrl = address ? `${API_STREAM_URL}?userId=${address}` : API_STREAM_URL;

        console.log(`useSpinFeed: Attempting to connect to ${apiUrl}`);
        setError(null);

        const es = new EventSource(apiUrl);
        eventSourceRef.current = es;

        // Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        es.onopen = () => {
            console.log('useSpinFeed: SSE Connection opened');
            lastMessageTimeRef.current = Date.now(); // Reset timer on open
            // Connected state is set true on first message
            resetOfflineTimer(); // Start monitoring connection liveness
            setIsConnected(true);
            setError(null);
        };

        es.onmessage = (event) => {
            lastMessageTimeRef.current = Date.now(); // Update time on message
            if (!isConnected) {
                setIsConnected(true);
            }
            resetOfflineTimer(); // Reset offline timer as we got data

            try {
                const parsedData: SpinFeedData = JSON.parse(event.data);
                setFeedData(parsedData);
                setLocalData(parsedData);
                setError(null);
            } catch (e) {
                console.error('useSpinFeed: Failed to parse SSE data:', e);
                setError(e instanceof Error ? e : new Error('Failed to parse data'));
                setIsConnected(false);
            }
        };

        es.onerror = (err) => {
            console.error('useSpinFeed: SSE Error:', err);
            es.close(); // Close the errored connection
            eventSourceRef.current = null;
            // Don't immediately set to disconnected; let the offline timer decide
            setIsConnected(false);
            setError(err instanceof Error ? err : new Error('SSE connection error'));

            // Schedule reconnect attempt only if not already scheduled
            if (!reconnectTimeoutRef.current) {
                console.log(`useSpinFeed: Scheduling reconnect in ${RECONNECT_DELAY / 1000}s...`);
                reconnectTimeoutRef.current = setTimeout(() => {
                    reconnectTimeoutRef.current = null; // Clear self before calling connect
                    connect();
                }, RECONNECT_DELAY);
            }
            // Start offline timer immediately on error to detect prolonged failure
            startOfflineTimer();
        };
    }, [address]);

    // Timer to detect prolonged disconnection
    const startOfflineTimer = () => {
        if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current); // Clear existing timer

        offlineTimeoutRef.current = setTimeout(() => {
            const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
            // Check if still disconnected/no message received for OFFLINE_TIMEOUT duration
            if ((eventSourceRef.current?.readyState !== EventSource.OPEN) || (timeSinceLastMessage >= OFFLINE_TIMEOUT)) {
                if (isConnected) {
                    console.log(`useSpinFeed: Feed considered offline (no message for >${OFFLINE_TIMEOUT / 1000}s or connection closed).`);
                    setIsConnected(false);
                }
            }
        }, OFFLINE_TIMEOUT);
    };

    // Resets the offline timer - call when connection is confirmed or data received
    const resetOfflineTimer = () => {
        if (offlineTimeoutRef.current) {
            clearTimeout(offlineTimeoutRef.current);
            offlineTimeoutRef.current = null;
        }
        // Restart the timer to check again in the future
        startOfflineTimer();
    };

    useEffect(() => {
        connect(); // Initial connection

        // Cleanup on unmount
        return () => {
            console.log('useSpinFeed: Cleaning up SSE connection on unmount');
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (offlineTimeoutRef.current) {
                clearTimeout(offlineTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connect]); // Re-run effect if connect function identity changes (due to dependencies)

    // Return the base state 
    const result: UseSpinFeedResult = { data: localData, isConnected, error };

    // Conditionally add setter for connection status only
    if (process.env.NODE_ENV === 'development') {
        result._devSetIsConnected = setIsConnected;
    }

    return result;
}
