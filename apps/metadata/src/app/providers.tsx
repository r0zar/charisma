"use client"

import React, { createContext, useEffect, useState } from 'react';
import { TokenProvider } from "@/lib/context/token-context";
import { WalletContextState, SignatureResponse } from "@/components/wallet-connector";
import { connect, request } from "@stacks/connect";

// Create a Wallet context
interface WalletContextValue {
    walletState: WalletContextState;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    signMessage: (message: string) => Promise<SignatureResponse>;
}

const WalletContext = createContext<WalletContextValue>({
    walletState: { connected: false, address: "", publicKey: "" },
    connectWallet: async () => { },
    disconnectWallet: () => { },
    signMessage: async () => ({ signature: "", publicKey: "" }),
});

export const useWallet = () => React.useContext(WalletContext);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [walletState, setWalletState] = useState<WalletContextState>({
        connected: false,
        address: "",
        publicKey: ""
    });

    // Check if there's wallet info in localStorage on initial load
    useEffect(() => {
        try {
            const addresses = JSON.parse(localStorage.getItem('addresses') || '[]');
            if (addresses.length) {
                const mainnetAddress = addresses[2]?.address;
                const publicKey = addresses[2]?.publicKey || "";
                if (mainnetAddress) {
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
        try {
            const result = await connect();
            localStorage.setItem('addresses', JSON.stringify(result.addresses));

            const mainnetAddress = result.addresses[2].address;
            const publicKey = result.addresses[2].publicKey || "";

            setWalletState({
                connected: true,
                address: mainnetAddress,
                publicKey
            });
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    };

    // Function to disconnect wallet
    const disconnectWallet = () => {
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

    const value: WalletContextValue = {
        walletState,
        connectWallet,
        disconnectWallet,
        signMessage
    };

    return (
        <WalletContext.Provider value={value}>
            <TokenProvider
                walletState={walletState}
                signMessage={signMessage}
            >
                {children}
            </TokenProvider>
        </WalletContext.Provider>
    );
} 