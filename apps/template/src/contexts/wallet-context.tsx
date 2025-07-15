"use client";

import * as React from 'react';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { connect, request } from "@stacks/connect";

// Types
type Network = "mainnet" | "testnet";

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
        mainnet?: AddressInfo;
        testnet?: AddressInfo;
    };
}

interface SignatureResponse {
    signature: string;
    publicKey: string;
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
}

const WalletContext = createContext<WalletContextType>({
    // Wallet state defaults
    walletState: {
        connected: false,
        address: "",
        publicKey: "",
        addresses: {}
    },
    network: "mainnet",
    setNetwork: () => { },
    connectWallet: async () => { },
    disconnectWallet: () => { },
    signMessage: async () => ({ signature: "", publicKey: "" }),
    authenticated: false,
    stxAddress: null,
    isConnecting: false,
});

export function WalletProvider({ children }: { children: ReactNode }) {
    // Network state
    const [network, setNetworkState] = useState<Network>(() => {
        if (typeof window !== "undefined") {
            const savedNetwork = localStorage.getItem("wallet-network") as Network;
            return (savedNetwork === "mainnet" || savedNetwork === "testnet") ? savedNetwork : "mainnet";
        }
        return "mainnet";
    });

    // Wallet state
    const [walletState, setWalletState] = useState<WalletState>({
        connected: false,
        address: "",
        publicKey: "",
        addresses: {}
    });
    const [_isConnecting, setIsConnecting] = useState(false);

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

    // Helper function to get storage key for network
    const getStorageKey = (network: Network) => `addresses-${network}`;

    // Helper function to detect network from address
    // ST = testnet, SP/SM = mainnet
    const detectNetworkFromAddress = (address: string): Network => {
        if (address.startsWith('ST')) {
            return 'testnet';
        } else if (address.startsWith('SP') || address.startsWith('SM')) {
            return 'mainnet';
        }
        // Default to current network if we can't determine
        return network;
    };

    // Helper function to load wallet state for a specific network
    const loadWalletStateForNetwork = (targetNetwork: Network) => {
        try {
            const storageKey = getStorageKey(targetNetwork);
            const addresses = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (addresses.length) {
                // First try to find STX address by prefix detection
                let networkAddress = "";
                let publicKey = "";

                // Look for STX addresses that match the target network
                for (const addr of addresses) {
                    if (addr.address && (addr.address.startsWith('ST') || addr.address.startsWith('SP') || addr.address.startsWith('SM'))) {
                        const addrNetwork = detectNetworkFromAddress(addr.address);
                        if (addrNetwork === targetNetwork) {
                            networkAddress = addr.address;
                            publicKey = addr.publicKey || "";
                            break;
                        }
                    }
                }

                // Fallback to index-based approach if detection didn't work
                if (!networkAddress) {
                    const addressIndex = targetNetwork === "mainnet" ? 2 : 1;
                    networkAddress = addresses[addressIndex]?.address;
                    publicKey = addresses[addressIndex]?.publicKey || "";
                }

                if (networkAddress) {
                    // Try to get BTC address from the same stored data
                    const btcAddress = addresses[0]?.address; // Assuming BTC is at index 0

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
                                btcAddress: targetNetwork === "mainnet" ? btcAddress : addresses[1]?.address
                            }
                        }
                    }));
                }
            }
        } catch (error) {
            console.error(`Error loading wallet state from localStorage for ${targetNetwork}:`, error);
        }
    };

    // Check if there's wallet info in localStorage on initial load
    useEffect(() => {
        // Load addresses for both networks
        loadWalletStateForNetwork("mainnet");
        loadWalletStateForNetwork("testnet");
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

    // Function to connect wallet using Stacks Connect
    const connectWallet = async () => {
        console.log(`Starting wallet connection for ${network}...`);
        setIsConnecting(true);
        try {
            const result = await connect();

            // Detect primary STX address and network
            let primaryAddress = "";
            let primaryPublicKey = "";
            let detectedNetwork = network;

            for (const addr of result.addresses) {
                if (addr.address && (addr.address.startsWith('ST') || addr.address.startsWith('SP') || addr.address.startsWith('SM'))) {
                    primaryAddress = addr.address;
                    primaryPublicKey = addr.publicKey || "";
                    detectedNetwork = detectNetworkFromAddress(addr.address);
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

            // Get Bitcoin addresses for both networks
            const mainnetBtcAddress = result.addresses[0]?.address; // Index 0 is typically mainnet BTC
            const testnetBtcAddress = result.addresses[1]?.address; // Index 1 is typically testnet BTC

            // Only update the detected network's addresses in localStorage
            const storageKey = getStorageKey(detectedNetwork);
            localStorage.setItem(storageKey, JSON.stringify(result.addresses));
            localStorage.setItem("wallet-network", detectedNetwork);

            // If detected network is different from current, switch automatically
            if (detectedNetwork !== network) {
                setNetworkState(detectedNetwork);
            }

            // Update only the detected network's addresses in state
            setWalletState(prev => ({
                ...prev,
                connected: true,
                address: primaryAddress, // Always use prefix-detected STX address
                publicKey: primaryPublicKey, // Always use prefix-detected public key
                addresses: {
                    ...prev.addresses,
                    [detectedNetwork]: {
                        address: detectedNetwork === "mainnet" ? mainnetAddress : testnetAddress,
                        publicKey: detectedNetwork === "mainnet" ? mainnetPublicKey : testnetPublicKey,
                        btcAddress: detectedNetwork === "mainnet" ? mainnetBtcAddress : testnetBtcAddress
                    }
                }
            }));
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
    };

    return (
        <WalletContext.Provider value={contextValue}>
            {children}
        </WalletContext.Provider>
    );
}

export const useWallet = () => useContext(WalletContext);