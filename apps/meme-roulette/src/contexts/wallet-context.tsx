"use client"

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { connect } from "@stacks/connect";
import type { AddressEntry } from "@stacks/connect/dist/types/methods";
import { v4 as uuidv4 } from 'uuid';
import { signIntentWithWallet, IntentInput, MULTIHOP_CONTRACT_ID } from "blaze-sdk"; // Reverting to relative path
import { CHARISMA_SUBNET_CONTRACT } from '@repo/tokens';

// Default Charisma token contract (mainnet) – override in env if necessary
const CHARISMA_TOKEN_CONTRACT_ID =
    process.env.NEXT_PUBLIC_CHARISMA_CONTRACT_ID ||
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1';

// Define the mainnet CHA contract ID separately
const MAINNET_CHA_CONTRACT_ID =
    process.env.NEXT_PUBLIC_MAINNET_CHA_CONTRACT_ID ||
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';

interface WalletContextType {
    connected: boolean;
    address: string;
    isConnecting: boolean;
    stxBalance: string; // Native STX balance in micro-STX
    mainnetBalance: string; // Mainnet CHA pre-confirmation balance
    subnetBalance: string; // Subnet CHA pre-confirmation balance
    balanceLoading: boolean;
    subnetBalanceLoading: boolean;
    stxBalanceLoading: boolean;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    placeBet: (amount: number, tokenId: string) => Promise<{ success: boolean; uuid?: string; error?: string }>;
}

const WalletContext = createContext<WalletContextType>({
    connected: false,
    address: '',
    isConnecting: false,
    stxBalance: '0',
    mainnetBalance: '0',
    subnetBalance: '0',
    balanceLoading: false,
    subnetBalanceLoading: false,
    stxBalanceLoading: false,
    connectWallet: async () => { },
    disconnectWallet: () => { },
    placeBet: async () => ({ success: false, error: 'Wallet not connected' })
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [address, setAddress] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [stxBalance, setStxBalance] = useState('0');
    const [mainnetBalance, setMainnetBalance] = useState('0');
    const [subnetBalance, setSubnetBalance] = useState('0');
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [subnetBalanceLoading, setSubnetBalanceLoading] = useState(false);
    const [stxBalanceLoading, setStxBalanceLoading] = useState(false);

    // Check for existing wallet connection
    useEffect(() => {
        const addresses: AddressEntry[] = JSON.parse(localStorage.getItem('addresses') || '[]');
        if (addresses.length) {
            const mainnetAddress = addresses[2]?.address;
            if (mainnetAddress) {
                setConnected(true);
                setAddress(mainnetAddress);
                // Fetch initial balances
                fetchMainnetBalance(mainnetAddress);
                fetchSubnetBalance(mainnetAddress);
                fetchStxBalance(mainnetAddress);
            }
        }
    }, []);

    // Function to connect wallet
    const connectWallet = async () => {
        console.log("[WalletContext] Attempting to connect...");
        setIsConnecting(true);
        try {
            console.log("[WalletContext] Calling connect() from @stacks/connect...");
            const result = await connect();
            console.log("[WalletContext] connect() success:", result);
            localStorage.setItem('addresses', JSON.stringify(result.addresses));

            const mainnetAddress = result.addresses[2]?.address;
            if (mainnetAddress) {
                console.log("[WalletContext] Found mainnet address:", mainnetAddress);
                setConnected(true);
                setAddress(mainnetAddress);
                // Fetch initial balances
                fetchMainnetBalance(mainnetAddress);
                fetchSubnetBalance(mainnetAddress);
                fetchStxBalance(mainnetAddress);
            } else {
                console.warn("[WalletContext] Mainnet address not found in connect() result index 2.");
            }
        } catch (error) {
            console.error("[WalletContext] Failed to connect wallet:", error);
        } finally {
            console.log("[WalletContext] Setting isConnecting to false.");
            setIsConnecting(false);
        }
    };

    // Function to disconnect wallet
    const disconnectWallet = () => {
        localStorage.removeItem('addresses');
        setAddress('');
        setConnected(false);
        setMainnetBalance('0');
        setSubnetBalance('0');
        setStxBalance('0');
    };

    // helper to fetch mainnet balance
    const fetchMainnetBalance = async (userAddress: string) => {
        console.log(`[WalletContext] Fetching Mainnet Charisma balance for ${userAddress}...`);
        if (!userAddress) return;
        setBalanceLoading(true);
        try {
            // For mainnet, we still use direct getUserTokenBalance or a similar specific API if needed
            // This example assumes getUserTokenBalance is appropriate for mainnet CHA
            // If mainnet CHA also needs an effective balance, a similar API endpoint would be needed for it.
            const { getUserTokenBalance: getMainnetBalance } = await import('@repo/balances'); // Dynamically import for mainnet
            const data = await getMainnetBalance(MAINNET_CHA_CONTRACT_ID, userAddress);
            setMainnetBalance(data.preconfirmationBalance);
        } catch (err) {
            console.error('Failed to fetch Mainnet Charisma balance:', err);
        } finally {
            setBalanceLoading(false);
        }
    };

    // helper to fetch subnet balance (now uses the new API endpoint)
    const fetchSubnetBalance = async (userAddress: string) => {
        if (!userAddress) return;
        setSubnetBalanceLoading(true);
        try {
            const response = await fetch(`/api/balance/effective-cha?userAddress=${encodeURIComponent(userAddress)}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fetch effective subnet balance' }));
                throw new Error(errorData.error || `API Error: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.success && result.data) {
                setSubnetBalance(result.data.effectiveSpendableBalance);
            } else {
                throw new Error(result.error || 'Invalid API response structure');
            }
        } catch (err: any) {
            console.error('Failed to fetch effective Subnet Charisma balance:', err.message || String(err));
            setSubnetBalance('0'); // Optionally reset or keep stale balance on error
        } finally {
            setSubnetBalanceLoading(false);
        }
    };

    // helper to fetch STX balance
    const fetchStxBalance = async (userAddress: string) => {
        if (!userAddress) return;
        setStxBalanceLoading(true);
        try {
            // Use Stacks API - adjust endpoint for mainnet/testnet if needed
            const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${userAddress}/stx`);
            if (!response.ok) {
                throw new Error(`STX Balance API Error: ${response.statusText}`);
            }
            const data = await response.json();
            setStxBalance(data.balance || '0'); // Balance is in micro-STX
        } catch (err) {
            console.error('Failed to fetch STX balance:', err);
            setStxBalance('0'); // Reset balance on error
        } finally {
            setStxBalanceLoading(false);
        }
    };

    // Whenever address changes (including after first mount), refresh balance
    useEffect(() => {
        if (connected && address) {
            fetchMainnetBalance(address);
            fetchSubnetBalance(address);
            fetchStxBalance(address);
        }
    }, [connected, address]);

    // New: placeBet implements off-chain signing and intent queuing
    const placeBet = async (amount: number, tokenId: string): Promise<{ success: boolean; uuid?: string; error?: string }> => {
        if (!connected || !address) {
            return { success: false, error: 'Wallet not connected' };
        }
        try {
            const uuid = uuidv4();

            const intentPayload = {
                contract: CHARISMA_SUBNET_CONTRACT, // Source CHA for the multi-hop (asset to be spent)
                intent: "TRANSFER_TOKENS",       // Describes the action (ensure backend expects this)
                amount: amount,                       // Amount of source CHA to use
                target: MULTIHOP_CONTRACT_ID,                      // Destination contract (the multihop contract)
                uuid: uuid,
                // opcode is optional in IntentInput, defaults to noneCV() if not provided in signIntentWithWallet
            };

            // signIntentWithWallet uses BLAZE_V1_DOMAIN internally
            const signedIntent = await signIntentWithWallet(intentPayload);

            const apiRequestBody = {
                signature: signedIntent.signature,
                publicKey: signedIntent.publicKey,
                uuid: uuid,
                recipient: address,
                sourceContract: CHARISMA_SUBNET_CONTRACT,
                destinationContract: tokenId,
                betAmount: amount.toString(),
                intentAction: "TRANSFER_TOKENS",
            };

            // Queue the signed intent on server
            const response = await fetch('/api/multihop/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiRequestBody),
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || 'Failed to queue intent');
            }

            // Successfully placed bet, now refresh the effective subnet balance
            if (address) { // Ensure address is still available
                fetchSubnetBalance(address);
            }

            return { success: true, uuid };
        } catch (error: any) {
            console.error('placeBet error:', error);
            return { success: false, error: error.message || String(error) };
        }
    };

    return (
        <WalletContext.Provider
            value={{
                connected,
                address,
                isConnecting,
                stxBalance,
                mainnetBalance,
                subnetBalance,
                balanceLoading,
                subnetBalanceLoading,
                stxBalanceLoading,
                connectWallet,
                disconnectWallet,
                placeBet
            }}
        >
            {children}
        </WalletContext.Provider>
    );
} 