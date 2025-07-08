"use client"

import * as React from 'react';
import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { connect, request } from "@stacks/connect";
import { PostCondition } from '@stacks/connect/dist/types/methods';
import { listTokens, TokenCacheData } from "@repo/tokens";

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

// Interface for deploy contract options
interface DeployContractOptions {
    postConditions?: PostCondition[];
}

interface AppContextType {
    // Wallet state
    walletState: WalletState;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    signMessage: (message: string) => Promise<SignatureResponse>;
    deployContract: (contractCode: string, contractName: string, options?: DeployContractOptions) => Promise<DeploymentResponse>;

    // Token state
    authenticated: boolean;
    stxAddress: string | null;
    tokens: TokenCacheData[];
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
    const [tokens, setTokens] = useState<TokenCacheData[]>([]);
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
    const deployContract = async (contractCode: string, contractName: string, options?: DeployContractOptions): Promise<DeploymentResponse> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }

        try {
            console.log(`Deploying contract ${contractName}...`);

            // Log post conditions if provided
            if (options?.postConditions && options.postConditions.length > 0) {
                console.log("Deploying with post conditions:", options.postConditions);
            }

            console.log("Deploying contract with post conditions:", options?.postConditions);


            // Call the stx_deployContract method
            const response = await request('stx_deployContract', {
                name: contractName,
                clarityCode: contractCode,
                clarityVersion: 3,
                postConditionMode: 'allow',
                postConditions: options?.postConditions || [],
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

    // New function to fetch metadata
    const fetchTokens = useCallback(async () => {
        console.log("fetchTokens: Setting loading=true");
        setLoading(true);
        setTokensError(null);
        try {
            // Call listTokens from @repo/tokens
            const allTokens = await listTokens(); // Assuming listTokens fetches all, not just user's

            const uniqueTokens = allTokens.filter((token, index, self) =>
                index === self.findIndex((t) => t.contractId === token.contractId)
            );

            // Set the tokens state with the result
            setTokens(uniqueTokens);
        } catch (error) {
            console.error('Error fetching tokens via listTokens:', error);
            setTokensError('Failed to fetch tokens using shared client');
            console.log("fetchTokens: Set tokensError state.");
        } finally {
            setLoading(false);
            console.log("fetchTokens: Setting loading=false");
        }
    }, []);

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