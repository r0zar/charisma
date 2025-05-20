"use client"

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { connect } from "@stacks/connect";
import type { AddressEntry } from "@stacks/connect/dist/types/methods";
import { getAccountBalances } from '@repo/polyglot';
import { AccountBalancesResponse } from '@repo/polyglot';
import { KraxelPriceData, listPrices } from '@repo/tokens';

interface WalletContextType {
    connected: boolean;
    address: string;
    isConnecting: boolean;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    balances: any;
    prices: any;
}

const WalletContext = createContext<WalletContextType>({
    connected: false,
    address: '',
    isConnecting: false,
    connectWallet: async () => { },
    disconnectWallet: () => { },
    balances: {},
    prices: {},
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [address, setAddress] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [balances, setBalances] = useState<AccountBalancesResponse>({} as AccountBalancesResponse);
    const [prices, setPrices] = useState<KraxelPriceData>({} as KraxelPriceData);

    // Check for existing wallet connection
    useEffect(() => {
        const addresses: AddressEntry[] = JSON.parse(localStorage.getItem('addresses') || '[]');
        if (addresses.length) {
            const mainnetAddress = addresses[2]?.address;
            if (mainnetAddress) {
                setConnected(true);
                setAddress(mainnetAddress);
            }
        }
    }, []);

    // get wallet balaces
    useEffect(() => {
        if (!address) return;
        const fetchBalances = async () => {
            const balances = await getAccountBalances(address);
            if (balances) setBalances(balances);
        };
        fetchBalances();
    }, [address]);

    // get wallet prices
    useEffect(() => {
        const fetchPrices = async () => {
            const prices = await listPrices();
            if (prices) setPrices(prices);
        };
        fetchPrices();
    }, []);

    // Function to connect wallet
    const connectWallet = async () => {
        setIsConnecting(true);
        try {
            const result = await connect();
            localStorage.setItem('addresses', JSON.stringify(result.addresses));

            const mainnetAddress = result.addresses[2]?.address;
            if (mainnetAddress) {
                setConnected(true);
                setAddress(mainnetAddress);
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    // Function to disconnect wallet
    const disconnectWallet = () => {
        localStorage.removeItem('addresses');
        setAddress('');
        setConnected(false);
    };

    return (
        <WalletContext.Provider
            value={{
                connected,
                address,
                isConnecting,
                connectWallet,
                disconnectWallet,
                balances,
                prices
            }}
        >
            {children}
        </WalletContext.Provider>
    );
} 