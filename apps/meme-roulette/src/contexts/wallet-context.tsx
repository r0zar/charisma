"use client"

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { connect } from "@stacks/connect";
import type { AddressEntry } from "@stacks/connect/dist/types/methods";
import { getUserTokenBalance } from '@repo/balances';

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
            const data = await getUserTokenBalance(MAINNET_CHA_CONTRACT_ID, userAddress);
            setMainnetBalance(data.preconfirmationBalance);
        } catch (err) {
            console.error('Failed to fetch Mainnet Charisma balance:', err);
        } finally {
            setBalanceLoading(false);
        }
    };

    // helper to fetch subnet balance
    const fetchSubnetBalance = async (userAddress: string) => {
        if (!userAddress) return;
        setSubnetBalanceLoading(true);
        try {
            const data = await getUserTokenBalance(CHARISMA_TOKEN_CONTRACT_ID, userAddress);
            setSubnetBalance(data.preconfirmationBalance);
        } catch (err) {
            console.error('Failed to fetch Subnet Charisma balance:', err);
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
            }}
        >
            {children}
        </WalletContext.Provider>
    );
} 