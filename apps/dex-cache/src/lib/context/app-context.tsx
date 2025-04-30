"use client"

import * as React from 'react';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { connect, request } from "@stacks/connect";

// Define the admin auth message
const ADMIN_AUTH_MESSAGE = "dex-cache-admin-access";

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

interface AppContextType {
    // Wallet state
    walletState: WalletState;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    signMessage: (message: string) => Promise<SignatureResponse>;
    authenticated: boolean;
    stxAddress: string | null;
    // New function for admin-authenticated fetch
    fetchWithAdminAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AppContext = createContext<AppContextType>({
    // Wallet state defaults
    walletState: { connected: false, address: "", publicKey: "" },
    connectWallet: async () => { },
    disconnectWallet: () => { },
    signMessage: async () => ({ signature: "", publicKey: "" }),
    authenticated: false,
    stxAddress: null,
    // Default for new function
    fetchWithAdminAuth: async () => new Response(null, { status: 500, statusText: "Context not ready" }),
});

export function AppProvider({ children }: { children: ReactNode }) {
    // Wallet state
    const [walletState, setWalletState] = useState<WalletState>({
        connected: false,
        address: "",
        publicKey: ""
    });
    const [isConnecting, setIsConnecting] = useState(false);

    // Debug wallet state changes
    useEffect(() => {
        console.log("AppContext walletState updated:", walletState);
    }, [walletState]);

    // Check if there's wallet info in localStorage on initial load
    useEffect(() => {
        try {
            const addresses = JSON.parse(localStorage.getItem('addresses') || '[]');
            if (addresses.length) {
                // Assuming mainnet is index 2, adjust if needed
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

            // Assuming mainnet is index 2, adjust if needed
            const mainnetAddress = result.addresses[2]?.address;
            const publicKey = result.addresses[2]?.publicKey || "";

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

    // Function to sign an arbitrary message using the wallet
    const signMessage = async (message: string): Promise<SignatureResponse> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }

        try {
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

    // New function: Signs admin message and wraps fetch
    const fetchWithAdminAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
        if (!walletState.connected) {
            throw new Error("Admin action requires connected wallet.");
        }

        console.log("Attempting admin-authenticated fetch...");
        try {
            // Sign the predefined admin message
            const signatureResult = await signMessage(ADMIN_AUTH_MESSAGE);

            if (!signatureResult || !signatureResult.signature || !signatureResult.publicKey) {
                throw new Error("Failed to obtain admin signature from wallet.");
            }

            // Prepare headers
            const headers = new Headers(options.headers);
            headers.set('x-public-key', signatureResult.publicKey);
            headers.set('x-signature', signatureResult.signature);

            console.log(`Executing fetch to ${url} with admin auth headers.`);
            // Execute fetch with augmented headers
            return await fetch(url, {
                ...options,
                headers,
            });

        } catch (error) {
            console.error("Error during admin-authenticated fetch:", error);
            // Rethrow or handle appropriately (e.g., return a custom Response)
            if (error instanceof Error) {
                throw new Error(`Admin Auth Fetch Error: ${error.message}`);
            }
            throw new Error("Unknown error during admin-authenticated fetch.");
        }
    };

    const contextValue: AppContextType = {
        walletState,
        connectWallet,
        disconnectWallet,
        signMessage,
        authenticated: walletState.connected,
        stxAddress: walletState.address || null,
        fetchWithAdminAuth, // Add the new function to the context value
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

export const useApp = () => useContext(AppContext); 