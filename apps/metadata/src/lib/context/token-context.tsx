"use client"

import * as React from 'react';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { TokenMetadata } from '@/lib/metadata-service';

interface WalletState {
    connected: boolean;
    address: string;
    publicKey: string;
}

interface TokenContextType {
    authenticated: boolean;
    stxAddress: string | null;
    signMessage: (message: string) => Promise<{ signature: string; publicKey: string }>;
    tokens: TokenMetadata[];
    loading: boolean;
    fetchTokens: () => Promise<void>;
}

const TokenContext = createContext<TokenContextType>({
    authenticated: false,
    stxAddress: null,
    signMessage: async () => ({ signature: '', publicKey: '' }),
    tokens: [],
    loading: false,
    fetchTokens: async () => { },
});

interface TokenProviderProps {
    children: ReactNode;
    walletState: WalletState;
    signMessage?: (message: string) => Promise<{ signature: string; publicKey: string }>;
}

export function TokenProvider({ children, walletState, signMessage: externalSignMessage }: TokenProviderProps) {
    const [tokens, setTokens] = useState<TokenMetadata[]>([]);
    const [loading, setLoading] = useState(false);

    // Create a default signMessage function if not provided
    const defaultSignMessage = async (message: string) => {
        try {
            // Default implementation for when wallet integration is not available
            const response = await (window as any).btc?.request('stx_signMessage', {
                message
            });

            if (!response || !response.signature || !response.publicKey) {
                throw new Error('Failed to sign message with wallet');
            }

            return {
                signature: response.signature,
                publicKey: response.publicKey
            };
        } catch (error) {
            console.error('Error signing message:', error);
            throw error;
        }
    };

    // Use external signMessage if provided, otherwise use default
    const signMessage = externalSignMessage || defaultSignMessage;

    const fetchTokens = async () => {
        if (!walletState.connected || !walletState.address) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/v1/metadata/list?address=${walletState.address}`);
            if (response.ok) {
                const data = await response.json();
                setTokens(data);
            } else {
                // If API is not ready, use an empty array
                setTokens([]);
            }
        } catch (error) {
            console.error('Failed to fetch tokens:', error);
            // On error, use empty array
            setTokens([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch tokens whenever wallet state changes
    useEffect(() => {
        if (walletState.connected && walletState.address) {
            console.log("Wallet connected, fetching tokens:", walletState);
            fetchTokens();
        }
    }, [walletState.connected, walletState.address]);

    return (
        <TokenContext.Provider
            value={{
                authenticated: walletState.connected,
                stxAddress: walletState.address || null,
                signMessage,
                tokens,
                loading,
                fetchTokens,
            }}
        >
            {children}
        </TokenContext.Provider>
    );
}

export const useTokenContext = () => useContext(TokenContext); 