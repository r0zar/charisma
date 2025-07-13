"use client";

import { connect, request } from "@stacks/connect";
import {
    buildSignatureHeaders,
    buildTimestampedSignatureHeaders,
    signedFetch,
    signedFetchWithTimestamp,
    type SignedMessage,
    type SignedMessageWithTimestamp,
    signMessage as blazeSignMessage,
    signMessageWithTimestamp,
    type TimestampedAuthOptions
} from "blaze-sdk";
import * as React from 'react';
import { createContext, type ReactNode,useContext, useEffect, useState } from 'react';

// Types
type Network = "stacks-mainnet" | "stacks-testnet" | "bitcoin-mainnet" | "bitcoin-testnet";
type LegacyNetwork = "mainnet" | "testnet"; // For backward compatibility

interface AddressInfo {
    address: string;
    publicKey: string;
    btcAddress?: string;
}

interface WalletState {
    connected: boolean;
    address: string;
    publicKey: string;
    addresses: {
        "stacks-mainnet"?: AddressInfo;
        "stacks-testnet"?: AddressInfo;
        "bitcoin-mainnet"?: AddressInfo;
        "bitcoin-testnet"?: AddressInfo;
        // Legacy support
        mainnet?: AddressInfo;
        testnet?: AddressInfo;
    };
}

interface SignatureResponse {
    signature: string;
    publicKey: string;
}

interface WalletSyncStatus {
    isBackendSynced: boolean;
    lastSyncAttempt: string | null;
    lastSyncSuccess: string | null;
    syncError: string | null;
    isSyncing: boolean;
}

interface WalletContextType {
    // Wallet state
    walletState: WalletState;
    network: Network;
    setNetwork: (network: Network) => void;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    signMessage: (message: string) => Promise<SignatureResponse>;
    authenticated: boolean;
    stxAddress: string | null;
    isConnecting: boolean;

    // Backend sync status
    syncStatus: WalletSyncStatus;
    retrySyncWithBackend: () => Promise<void>;

    // Enhanced auth functions
    signMessageBlaze: (message: string) => Promise<SignedMessage>;
    signMessageWithTimestamp: (message: string, options?: TimestampedAuthOptions) => Promise<SignedMessageWithTimestamp>;
    authenticatedFetch: (url: string, options?: RequestInit & { message: string }) => Promise<Response>;
    authenticatedFetchWithTimestamp: (url: string, options?: RequestInit & { message: string } & TimestampedAuthOptions) => Promise<Response>;
    buildAuthHeaders: (message: string) => Promise<Record<string, string>>;
    buildTimestampedAuthHeaders: (message: string, options?: TimestampedAuthOptions) => Promise<Record<string, string>>;
    getUserId: () => string;
}

const WalletContext = createContext<WalletContextType>({
    // Wallet state defaults
    walletState: {
        connected: false,
        address: "",
        publicKey: "",
        addresses: {}
    },
    network: "stacks-mainnet",
    setNetwork: () => { },
    connectWallet: async () => { },
    disconnectWallet: () => { },
    signMessage: async () => ({ signature: "", publicKey: "" }),
    authenticated: false,
    stxAddress: null,
    isConnecting: false,

    // Backend sync defaults
    syncStatus: {
        isBackendSynced: false,
        lastSyncAttempt: null,
        lastSyncSuccess: null,
        syncError: null,
        isSyncing: false
    },
    retrySyncWithBackend: async () => { },

    // Enhanced auth function defaults
    signMessageBlaze: async () => ({ signature: "", publicKey: "" }),
    signMessageWithTimestamp: async () => ({ signature: "", publicKey: "", timestamp: 0 }),
    authenticatedFetch: async () => new Response(),
    authenticatedFetchWithTimestamp: async () => new Response(),
    buildAuthHeaders: async () => ({}),
    buildTimestampedAuthHeaders: async () => ({}),
    getUserId: () => "",
});

export function WalletProvider({ children }: { children: ReactNode }) {
    // Helper function to migrate legacy network names
    const migrateLegacyNetwork = (savedNetwork: string): Network => {
        switch (savedNetwork) {
            case "mainnet":
                return "stacks-mainnet";
            case "testnet":
                return "stacks-testnet";
            case "stacks-mainnet":
            case "stacks-testnet":
            case "bitcoin-mainnet":
            case "bitcoin-testnet":
                return savedNetwork as Network;
            default:
                return "stacks-mainnet";
        }
    };

    // Network state
    const [network, setNetworkState] = useState<Network>(() => {
        if (typeof window !== "undefined") {
            const savedNetwork = localStorage.getItem("wallet-network");
            return savedNetwork ? migrateLegacyNetwork(savedNetwork) : "stacks-mainnet";
        }
        return "stacks-mainnet";
    });

    // Wallet state
    const [walletState, setWalletState] = useState<WalletState>({
        connected: false,
        address: "",
        publicKey: "",
        addresses: {}
    });
    const [isConnecting, setIsConnecting] = useState(false);

    // Backend sync status
    const [syncStatus, setSyncStatus] = useState<WalletSyncStatus>({
        isBackendSynced: false,
        lastSyncAttempt: null,
        lastSyncSuccess: null,
        syncError: null,
        isSyncing: false
    });

    // Network switcher function
    const setNetwork = (newNetwork: Network) => {
        setNetworkState(newNetwork);
        localStorage.setItem("wallet-network", newNetwork);

        // Update current address when switching networks but preserve all addresses
        setWalletState(prev => {
            const targetNetwork = newNetwork;
            const targetAddress = prev.addresses[targetNetwork];
            return {
                ...prev,
                connected: !!targetAddress,
                address: targetAddress?.address || "",
                publicKey: targetAddress?.publicKey || ""
            };
        });

        // Load wallet state for the new network
        loadWalletStateForNetwork(newNetwork);
    };

    // Helper function to get storage key for network (maintain legacy compatibility)
    const getStorageKey = (network: Network): string => {
        // Map new network names to legacy storage keys for compatibility
        switch (network) {
            case "stacks-mainnet":
                return "addresses-mainnet";
            case "stacks-testnet":
                return "addresses-testnet";
            case "bitcoin-mainnet":
                return "addresses-bitcoin-mainnet";
            case "bitcoin-testnet":
                return "addresses-bitcoin-testnet";
            default:
                return `addresses-${network}`;
        }
    };

    // Helper function to detect if address is Bitcoin or Stacks
    const detectAddressType = (address: string): 'bitcoin' | 'stacks' | 'unknown' => {
        if (address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3') || 
            address.startsWith('tb1') || address.startsWith('m') || address.startsWith('n') || address.startsWith('2')) {
            return 'bitcoin';
        } else if (address.startsWith('ST') || address.startsWith('SP') || address.startsWith('SM')) {
            return 'stacks';
        }
        return 'unknown';
    };

    // Helper function to get Bitcoin addresses from original Stacks Connect data
    const getBitcoinAddressesFromOriginalData = (network: "mainnet" | "testnet") => {
        try {
            const storageKey = network === "mainnet" ? "addresses-mainnet" : "addresses-testnet";
            const originalData = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            return originalData.filter((addr: any) => addr.symbol === "BTC") || [];
        } catch (error) {
            console.error(`Error reading original data for ${network}:`, error);
            return [];
        }
    };

    // Helper function to detect Bitcoin network from address
    const detectBitcoinNetworkFromAddress = (address: string): "bitcoin-mainnet" | "bitcoin-testnet" | null => {
        // Bitcoin mainnet prefixes
        if (address.startsWith('bc1') || address.startsWith('1') || address.startsWith('3')) {
            return 'bitcoin-mainnet';
        }
        // Bitcoin testnet prefixes
        if (address.startsWith('tb1') || address.startsWith('m') || address.startsWith('n') || address.startsWith('2')) {
            return 'bitcoin-testnet';
        }
        return null;
    };

    // Helper function to detect network from Stacks address
    // ST = testnet, SP/SM = mainnet
    const detectStacksNetworkFromAddress = (address: string): "stacks-mainnet" | "stacks-testnet" => {
        if (address.startsWith('ST')) {
            return 'stacks-testnet';
        } else if (address.startsWith('SP') || address.startsWith('SM')) {
            return 'stacks-mainnet';
        }
        return 'stacks-mainnet'; // Default fallback
    };

    // Helper function to check if network is Bitcoin
    const isBitcoinNetwork = (network: Network): boolean => {
        return network === 'bitcoin-mainnet' || network === 'bitcoin-testnet';
    };

    // Helper function to check if network is Stacks
    const isStacksNetwork = (network: Network): boolean => {
        return network === 'stacks-mainnet' || network === 'stacks-testnet';
    };


    // Helper function to load wallet state for a specific network
    const loadWalletStateForNetwork = (targetNetwork: Network) => {
        try {
            const storageKey = getStorageKey(targetNetwork);
            const addresses = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (addresses.length) {
                let networkAddress = "";
                let publicKey = "";

                if (isStacksNetwork(targetNetwork)) {
                    // Handle Stacks networks - look for STX addresses
                    for (const addr of addresses) {
                        if (addr.address && detectAddressType(addr.address) === 'stacks') {
                            const detectedNetwork = detectStacksNetworkFromAddress(addr.address);
                            if (detectedNetwork === targetNetwork) {
                                networkAddress = addr.address;
                                publicKey = addr.publicKey || "";
                                break;
                            }
                        }
                    }

                    // Fallback to index-based approach for Stacks
                    if (!networkAddress) {
                        const addressIndex = targetNetwork === "stacks-mainnet" ? 2 : 1;
                        networkAddress = addresses[addressIndex]?.address;
                        publicKey = addresses[addressIndex]?.publicKey || "";
                    }

                    if (networkAddress) {
                        // Get associated BTC address
                        const btcAddress = addresses[0]?.address; // BTC typically at index 0

                        setWalletState(prev => ({
                            ...prev,
                            connected: targetNetwork === network ? true : prev.connected,
                            address: targetNetwork === network ? networkAddress : prev.address,
                            publicKey: targetNetwork === network ? publicKey : prev.publicKey,
                            addresses: {
                                ...prev.addresses,
                                [targetNetwork]: {
                                    address: networkAddress,
                                    publicKey,
                                    btcAddress: targetNetwork === "stacks-mainnet" ? btcAddress : addresses[1]?.address
                                }
                            }
                        }));
                    }
                } else if (isBitcoinNetwork(targetNetwork)) {
                    // For Bitcoin networks, get data from original Stacks Connect data
                    const bitcoinNetwork = targetNetwork === "bitcoin-mainnet" ? "mainnet" : "testnet";
                    const bitcoinAddresses = getBitcoinAddressesFromOriginalData(bitcoinNetwork);
                    
                    if (bitcoinAddresses.length > 0) {
                        // Get primary Bitcoin address (prefer taproot over segwit)
                        const taprootAddr = bitcoinAddresses.find((addr: any) => addr.type === "p2tr");
                        const segwitAddr = bitcoinAddresses.find((addr: any) => addr.type === "p2wpkh");
                        const primaryAddr = taprootAddr || segwitAddr || bitcoinAddresses[0];
                        
                        if (primaryAddr) {
                            networkAddress = primaryAddr.address;
                            publicKey = primaryAddr.publicKey || "";
                            
                            setWalletState(prev => ({
                                ...prev,
                                connected: targetNetwork === network ? true : prev.connected,
                                address: targetNetwork === network ? networkAddress : prev.address,
                                publicKey: targetNetwork === network ? publicKey : prev.publicKey,
                                addresses: {
                                    ...prev.addresses,
                                    [targetNetwork]: {
                                        address: networkAddress,
                                        publicKey
                                    }
                                }
                            }));
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error loading wallet state from localStorage for ${targetNetwork}:`, error);
        }
    };

    // Check if there's wallet info in localStorage on initial load
    useEffect(() => {
        // Load addresses for all supported networks
        loadWalletStateForNetwork("stacks-mainnet");
        loadWalletStateForNetwork("stacks-testnet");
        loadWalletStateForNetwork("bitcoin-mainnet");
        loadWalletStateForNetwork("bitcoin-testnet");
    }, []);

    // Switch active address when network changes
    useEffect(() => {
        setWalletState(prev => {
            const targetAddress = prev.addresses[network];
            return {
                ...prev,
                connected: !!targetAddress,
                address: targetAddress?.address || "",
                publicKey: targetAddress?.publicKey || ""
            };
        });
    }, [network]);

    // Function to connect wallet - handles both Stacks and Bitcoin networks
    const connectWallet = async () => {
        console.log(`Starting wallet connection for ${network}...`);
        setIsConnecting(true);
        try {
            if (isStacksNetwork(network)) {
                // Connect Stacks wallet using Stacks Connect
                const result = await connect();

                // Detect primary STX address and network
                let primaryAddress = "";
                let primaryPublicKey = "";
                let detectedNetwork = network;

                for (const addr of result.addresses) {
                    if (addr.address && detectAddressType(addr.address) === 'stacks') {
                        primaryAddress = addr.address;
                        primaryPublicKey = addr.publicKey || "";
                        detectedNetwork = detectStacksNetworkFromAddress(addr.address);
                        break;
                    }
                }

                // Use appropriate address index for networks (fallback to original logic if needed)
                const mainnetAddressIndex = 2;
                const testnetAddressIndex = 1;
                const mainnetAddress = result.addresses[mainnetAddressIndex]?.address || primaryAddress;
                const testnetAddress = result.addresses[testnetAddressIndex]?.address || primaryAddress;
                const mainnetPublicKey = result.addresses[mainnetAddressIndex]?.publicKey || primaryPublicKey;
                const testnetPublicKey = result.addresses[testnetAddressIndex]?.publicKey || primaryPublicKey;

                console.log('All wallet addresses from Stacks Connect:', result.addresses);
                
                // Get Bitcoin addresses from the result (they're already properly structured)
                const bitcoinAddresses = result.addresses.filter((addr: any) => addr.symbol === "BTC");
                const mainnetBtcAddresses = bitcoinAddresses.filter((addr: any) => addr.address.startsWith('bc1'));
                const testnetBtcAddresses = bitcoinAddresses.filter((addr: any) => addr.address.startsWith('tb1'));

                // Get primary Bitcoin addresses (prefer taproot over segwit)
                const mainnetTaproot = mainnetBtcAddresses.find((addr: any) => addr.type === "p2tr");
                const mainnetSegwit = mainnetBtcAddresses.find((addr: any) => addr.type === "p2wpkh");
                const mainnetBtcAddress = (mainnetTaproot || mainnetSegwit)?.address || "";

                const testnetTaproot = testnetBtcAddresses.find((addr: any) => addr.type === "p2tr");
                const testnetSegwit = testnetBtcAddresses.find((addr: any) => addr.type === "p2wpkh");
                const testnetBtcAddress = (testnetTaproot || testnetSegwit)?.address || "";

                // Store Stacks addresses using legacy storage keys for compatibility
                const stacksStorageKey = getStorageKey(detectedNetwork);
                localStorage.setItem(stacksStorageKey, JSON.stringify(result.addresses));
                localStorage.setItem("wallet-network", detectedNetwork);

                // If detected network is different from current, switch automatically
                if (detectedNetwork !== network) {
                    setNetworkState(detectedNetwork);
                }

                // Update Stacks network addresses in state
                setWalletState(prev => ({
                    ...prev,
                    connected: true,
                    address: primaryAddress,
                    publicKey: primaryPublicKey,
                    addresses: {
                        ...prev.addresses,
                        [detectedNetwork]: {
                            address: detectedNetwork === "stacks-mainnet" ? mainnetAddress : testnetAddress,
                            publicKey: detectedNetwork === "stacks-mainnet" ? mainnetPublicKey : testnetPublicKey,
                            btcAddress: detectedNetwork === "stacks-mainnet" ? mainnetBtcAddress : testnetBtcAddress
                        },
                        // Store Bitcoin addresses simply - using primary address
                        "bitcoin-mainnet": mainnetBtcAddress ? {
                            address: mainnetBtcAddress,
                            publicKey: (mainnetTaproot || mainnetSegwit)?.publicKey || ""
                        } : undefined,
                        "bitcoin-testnet": testnetBtcAddress ? {
                            address: testnetBtcAddress,
                            publicKey: (testnetTaproot || testnetSegwit)?.publicKey || ""
                        } : undefined
                    }
                }));

                // Sync wallet with backend for secure strategy execution
                try {
                    console.log('🔄 Syncing wallet with backend for secure bot execution...');
                    const syncResult = await syncWalletWithBackend(primaryAddress, primaryPublicKey);
                    
                    if (syncResult.success) {
                        console.log('✅ Backend wallet sync completed successfully');
                    } else {
                        console.warn('⚠️ Backend wallet sync failed:', syncResult.error);
                        // Continue with connection even if sync fails - user can retry later
                    }
                } catch (syncError) {
                    console.error('❌ Unexpected error during wallet sync:', syncError);
                    // Continue with connection even if sync fails
                }
            } else if (isBitcoinNetwork(network)) {
                // For now, Bitcoin connection would need separate implementation
                // This would integrate with Bitcoin-specific wallet providers
                console.log("Bitcoin wallet connection not yet implemented - use Stacks wallet connection which provides Bitcoin addresses");
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    // Function to disconnect wallet
    const disconnectWallet = () => {
        const storageKey = getStorageKey(network);
        localStorage.removeItem(storageKey);
        setWalletState(prev => ({
            ...prev,
            connected: false,
            address: "",
            publicKey: "",
            addresses: {
                ...prev.addresses,
                [network]: undefined
            }
        }));
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

    // Enhanced auth functions using blaze-sdk
    const signMessageBlaze = async (message: string): Promise<SignedMessage> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }
        return blazeSignMessage(message);
    };

    const signMessageWithTimestampImpl = async (message: string, options?: TimestampedAuthOptions): Promise<SignedMessageWithTimestamp> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }
        return signMessageWithTimestamp(message, options);
    };

    const authenticatedFetch = async (url: string, options?: RequestInit & { message: string }): Promise<Response> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }
        if (!options?.message) {
            throw new Error("Message is required for authenticated requests");
        }
        return signedFetch(url, options);
    };

    const authenticatedFetchWithTimestamp = async (url: string, options?: RequestInit & { message: string } & TimestampedAuthOptions): Promise<Response> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }
        if (!options?.message) {
            throw new Error("Message is required for authenticated requests");
        }
        return signedFetchWithTimestamp(url, options);
    };

    const buildAuthHeaders = async (message: string): Promise<Record<string, string>> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }
        const signed = await signMessageBlaze(message);
        return buildSignatureHeaders(signed);
    };

    const buildTimestampedAuthHeaders = async (message: string, options?: TimestampedAuthOptions): Promise<Record<string, string>> => {
        if (!walletState.connected) {
            throw new Error("Wallet not connected");
        }
        const signed = await signMessageWithTimestampImpl(message, options);
        return buildTimestampedSignatureHeaders(signed);
    };

    const getUserId = (): string => {
        return walletState.address || 'anonymous';
    };

    // Function to sync wallet with backend using STX message signing
    const syncWalletWithBackend = async (walletAddress: string, publicKey: string) => {
        const now = new Date().toISOString();
        
        try {
            console.log('🔐 Starting secure wallet sync with backend...');
            
            // Update sync status - started
            setSyncStatus(prev => ({
                ...prev,
                isSyncing: true,
                lastSyncAttempt: now,
                syncError: null
            }));
            
            // Generate verification message with timestamp to prevent replay attacks
            const timestamp = Date.now();
            const message = `Verify wallet ownership for user at ${timestamp}. Address: ${walletAddress}`;
            
            // Sign the verification message
            const signedMessage = await blazeSignMessage(message);
            
            console.log('📝 Signed verification message, syncing with backend...');
            
            // Call secure wallet sync API
            const response = await fetch('/api/v1/user/wallet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    message: message,
                    signature: signedMessage.signature,
                    publicKey: publicKey
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Failed to sync wallet with backend');
            }
            
            console.log('✅ Wallet sync successful:', result.message);
            
            // Update sync status - success
            setSyncStatus(prev => ({
                ...prev,
                isSyncing: false,
                isBackendSynced: true,
                lastSyncSuccess: now,
                syncError: null
            }));
            
            return { success: true, message: result.message };
            
        } catch (error) {
            console.error('❌ Wallet sync failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during wallet sync';
            
            // Update sync status - error
            setSyncStatus(prev => ({
                ...prev,
                isSyncing: false,
                isBackendSynced: false,
                syncError: errorMessage
            }));
            
            return { 
                success: false, 
                error: errorMessage
            };
        }
    };

    // Function to manually retry wallet sync
    const retrySyncWithBackend = async () => {
        if (!walletState.connected || !walletState.address || !walletState.publicKey) {
            console.warn('Cannot retry sync - wallet not connected');
            return;
        }
        
        await syncWalletWithBackend(walletState.address, walletState.publicKey);
    };

    const contextValue: WalletContextType = {
        walletState,
        network,
        setNetwork,
        connectWallet,
        disconnectWallet,
        signMessage,
        authenticated: walletState.connected,
        stxAddress: walletState.address || null,
        isConnecting,

        // Backend sync status
        syncStatus,
        retrySyncWithBackend,

        // Enhanced auth functions
        signMessageBlaze,
        signMessageWithTimestamp: signMessageWithTimestampImpl,
        authenticatedFetch,
        authenticatedFetchWithTimestamp,
        buildAuthHeaders,
        buildTimestampedAuthHeaders,
        getUserId,
    };

    return (
        <WalletContext.Provider value={contextValue}>
            {children}
        </WalletContext.Provider>
    );
}

export const useWallet = () => useContext(WalletContext);