"use client"

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { connect } from "@stacks/connect";
import type { AddressEntry } from "@stacks/connect/dist/types/methods";
import { getAccountBalances } from '@repo/polyglot';
import { AccountBalancesResponse } from '@repo/polyglot';
import { KraxelPriceData, listPrices } from '@/lib/contract-registry-adapter';

interface WalletContextType {
    connected: boolean;
    address: string;
    isConnecting: boolean;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    balances: AccountBalancesResponse;
    prices: any;
    // Multi-wallet support
    watchedAddresses: string[];
    addWatchedAddresses: (addresses: string[]) => void;
    removeWatchedAddress: (address: string) => void;
    clearWatchedAddresses: () => void;
    // Privacy settings
    privacyMode: boolean;
    togglePrivacyMode: () => void;
}

const WalletContext = createContext<WalletContextType>({
    connected: false,
    address: '',
    isConnecting: false,
    connectWallet: async () => { },
    disconnectWallet: () => { },
    balances: {
        stx: {
            balance: '0',
            total_sent: '0',
            total_received: '0'
        },
        fungible_tokens: {},
        non_fungible_tokens: {}
    },
    prices: {},
    // Multi-wallet support defaults
    watchedAddresses: [],
    addWatchedAddresses: () => { },
    removeWatchedAddress: () => { },
    clearWatchedAddresses: () => { },
    // Privacy settings defaults
    privacyMode: false,
    togglePrivacyMode: () => { },
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [address, setAddress] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [balances, setBalances] = useState<AccountBalancesResponse>({} as AccountBalancesResponse);
    const [prices, setPrices] = useState<KraxelPriceData>({} as KraxelPriceData);
    const [watchedAddresses, setWatchedAddresses] = useState<string[]>([]);
    const [privacyMode, setPrivacyMode] = useState(true);

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

    // Load watched addresses from localStorage
    useEffect(() => {
        const savedWatchedAddresses = localStorage.getItem('watchedAddresses');
        if (savedWatchedAddresses) {
            try {
                const parsed = JSON.parse(savedWatchedAddresses);
                if (Array.isArray(parsed)) {
                    setWatchedAddresses(parsed);
                }
            } catch (error) {
                console.warn('Failed to parse watched addresses from localStorage:', error);
            }
        }
    }, []);

    // Save watched addresses to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('watchedAddresses', JSON.stringify(watchedAddresses));
    }, [watchedAddresses]);

    // Load privacy mode from localStorage
    useEffect(() => {
        const savedPrivacyMode = localStorage.getItem('privacyMode');
        if (savedPrivacyMode !== null) {
            setPrivacyMode(savedPrivacyMode === 'true');
        }
    }, []);

    // Save privacy mode to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('privacyMode', privacyMode.toString());
    }, [privacyMode]);

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
    // useEffect(() => {
    //     const fetchPrices = async () => {
    //         const prices = await listPrices();
    //         if (prices) setPrices(prices);
    //     };
    //     fetchPrices();
    // }, []);

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

    // Multi-wallet management functions
    const addWatchedAddresses = (newAddresses: string[]) => {
        setWatchedAddresses(prev => {
            const combined = [...prev, ...newAddresses];
            // Remove duplicates while preserving order
            return combined.filter((addr, index) => combined.indexOf(addr) === index);
        });
    };

    const removeWatchedAddress = (addressToRemove: string) => {
        setWatchedAddresses(prev => prev.filter(addr => addr !== addressToRemove));
    };

    const clearWatchedAddresses = () => {
        setWatchedAddresses([]);
    };

    const togglePrivacyMode = () => {
        setPrivacyMode(prev => !prev);
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
                prices,
                watchedAddresses,
                addWatchedAddresses,
                removeWatchedAddress,
                clearWatchedAddresses,
                privacyMode,
                togglePrivacyMode
            }}
        >
            {children}
        </WalletContext.Provider>
    );
} 