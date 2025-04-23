"use client"

import * as React from 'react';
import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { TokenMetadata } from '@/lib/metadata-service';
import { connect, request } from "@stacks/connect";

// Types
interface WalletState {
    connected: boolean;
    address: string;
    publicKey: string;
}

interface SignatureResponse {
    signature: string;
    publicKey: string;
}

interface DeploymentResponse {
    txid: string;
}

interface AppContextType {
    // Wallet state
    walletState: WalletState;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    signMessage: (message: string) => Promise<SignatureResponse>;
    deployContract: (contractCode: string, contractName: string) => Promise<DeploymentResponse>;

    // Token state
    authenticated: boolean;
    stxAddress: string | null;
    tokens: TokenMetadata[];
    tokensError: string | null;
    loading: boolean;
    fetchTokens: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
    // Wallet state defaults
    walletState: { connected: false, address: "", publicKey: "" },
    connectWallet: async () => { },
    disconnectWallet: () => { },
    signMessage: async () => ({ signature: "", publicKey: "" }),
    deployContract: async () => ({ txid: "" }),

    // Token state defaults
    authenticated: false,
    stxAddress: null,
    tokens: [],
    tokensError: null,
    loading: false,
    fetchTokens: async () => { },
});

export function AppProvider({ children }: { children: ReactNode }) {
    // Wallet state
    const [walletState, setWalletState] = useState<WalletState>({
        connected: false,
        address: "",
        publicKey: ""
    });
    const [isConnecting, setIsConnecting] = useState(false);

    // Token state
    const [tokens, setTokens] = useState<TokenMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [tokensError, setTokensError] = useState<string | null>(null);

    // Debug wallet state changes
    useEffect(() => {
        console.log("AppContext walletState updated:", walletState);
    }, [walletState]);

    // Check if there's wallet info in localStorage on initial load
    useEffect(() => {
        try {
            const addresses = JSON.parse(localStorage.getItem('addresses') || '[]');
            if (addresses.length) {
                const mainnetAddress = addresses[2]?.address;
                const publicKey = addresses[2]?.publicKey || "";
                if (mainnetAddress) {
                    console.log("Setting wallet state from localStorage:", { mainnetAddress, publicKey });
                    setWalletState({
                        connected: true,
                        address: mainnetAddress,
                        publicKey
                    });
                }
            }
        } catch (error) {
            console.error("Error loading wallet state from localStorage:", error);
        }
    }, []);

    // Function to connect wallet using Stacks Connect
    const connectWallet = async () => {
        console.log("Starting wallet connection...");
        setIsConnecting(true);
        try {
            const result = await connect();
            console.log("Connect result:", result);
            localStorage.setItem('addresses', JSON.stringify(result.addresses));

            const mainnetAddress = result.addresses[2].address;
            const publicKey = result.addresses[2].publicKey || "";

            console.log("Setting wallet state after connection:", { mainnetAddress, publicKey });
            setWalletState({
                connected: true,
                address: mainnetAddress,
                publicKey
            });
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    // Function to disconnect wallet
    const disconnectWallet = () => {
        console.log("Disconnecting wallet...");
        localStorage.removeItem('addresses');
        setWalletState({
            connected: false,
            address: "",
            publicKey: ""
        });
    };

    // Function to sign a message using the wallet
    const signMessage = async (message: string): Promise<SignatureResponse> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }

        try {
            // Call the stx_signMessage method
            const response = await request('stx_signMessage', {
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

    // Function to deploy a contract using the wallet
    const deployContract = async (contractCode: string, contractName: string): Promise<DeploymentResponse> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }

        try {
            console.log(`Deploying contract ${contractName}...`);
            // Call the stx_deployContract method
            const response = await request('stx_deployContract', {
                name: contractName,
                clarityCode: contractCode,
                clarityVersion: 3
            });

            if (!response || !response.txid) {
                throw new Error('Failed to deploy contract with wallet');
            }

            console.log(`Contract deployment initiated with txid: ${response.txid}`);
            return {
                txid: response.txid
            };
        } catch (error) {
            console.error('Error deploying contract:', error);
            throw error;
        }
    };

    const fetchTokens = useCallback(async () => {
        console.log("fetchTokens called. Address:", walletState.address);
        if (!walletState.address) {
            console.log("fetchTokens aborted: No address.");
            return;
        }
        console.log("fetchTokens: Setting loading=true");
        setLoading(true);
        setTokensError(null);
        const apiUrl = `/api/v1/metadata/list?principal=${walletState.address}`;
        console.log("Fetching tokens from:", apiUrl);
        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            console.log("fetchTokens response status:", response.status);
            if (!response.ok) {
                const errorBody = await response.text();
                console.error("fetchTokens error response body:", errorBody);
                throw new Error(`Failed to fetch tokens (${response.status})`);
            }
            const data = await response.json();
            console.log("fetchTokens success. Data:", data);
            setTokens(data.metadata);
            console.log("fetchTokens: Set tokens state.");
        } catch (error) {
            console.error('Error fetching tokens:', error);
            setTokensError('Failed to fetch tokens');
            console.log("fetchTokens: Set tokensError state.");
        } finally {
            setLoading(false);
            console.log("fetchTokens: Setting loading=false");
        }
    }, [walletState.address]);

    // Fetch tokens whenever wallet state changes
    useEffect(() => {
        if (walletState.connected && walletState.address) {
            fetchTokens();
        }
    }, [walletState.connected, walletState.address, fetchTokens]);

    const contextValue: AppContextType = {
        walletState,
        connectWallet,
        disconnectWallet,
        signMessage,
        deployContract,
        authenticated: walletState.connected,
        stxAddress: walletState.address || null,
        tokens,
        tokensError,
        loading,
        fetchTokens,
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

export const useApp = () => useContext(AppContext); 