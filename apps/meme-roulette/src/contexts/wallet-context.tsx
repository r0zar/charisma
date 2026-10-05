"use client"

import React, { createContext, useState, useContext, useEffect, ReactNode, useRef } from 'react';
import { connect, request } from "@stacks/connect";
import type { AddressEntry } from "@stacks/connect/dist/types/methods";
import { v4 as uuidv4 } from 'uuid';
import { signIntentWithWallet, MULTIHOP_CONTRACT_ID, MULTIHOP_V2_CONTRACT_ID, getBalances, watchBalances, type BalanceSheet } from "blaze-sdk";
import { CHA_SUBNET_V1, CHA_SUBNET_V2, type ChaSubnet } from '@/lib/roulette/subnets';
import { fetchQuote, Router, loadVaults, buildSwapTransaction, Route } from 'dexterity-sdk';
import type { PublicBet } from '@/lib/roulette/types';

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
    /** playable CHA: Blaze v1 and v2 subnet balances together */
    subnetBalance: string;
    /** the two subnet balances behind it (micro-CHA) */
    subnetBalances: { v1: string; v2: string };
    balanceLoading: boolean;
    subnetBalanceLoading: boolean;
    stxBalanceLoading: boolean;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    /** sign a bet for `tokenId` with `amount` micro-CHA and hand it to the game; throws the server's reason */
    placeBet: (amount: bigint, tokenId: string, subnet: ChaSubnet) => Promise<PublicBet>;
    /** move `amount` micro-CHA from Blaze v1 to v2: one signature, the game pays the fee; returns the txid */
    upgradeToV2: (amount: bigint) => Promise<string>;
    refreshBalances: () => void;
    getQuote: (from: string, to: string, amount: number) => Promise<{ success: boolean; quote?: any; error?: string }>;
    swapTokens: (route: Route) => Promise<any>;
}

const WalletContext = createContext<WalletContextType>({
    connected: false,
    address: '',
    isConnecting: false,
    stxBalance: '0',
    mainnetBalance: '0',
    subnetBalance: '0',
    subnetBalances: { v1: '0', v2: '0' },
    balanceLoading: false,
    subnetBalanceLoading: false,
    stxBalanceLoading: false,
    connectWallet: async () => { },
    disconnectWallet: () => { },
    placeBet: async () => { throw new Error('Wallet not connected'); },
    upgradeToV2: async () => { throw new Error('Wallet not connected'); },
    refreshBalances: () => { },
    getQuote: async () => ({ success: false, error: 'Failed to get quote' }),
    swapTokens: async () => ({ success: false, error: 'Wallet not connected' })
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [address, setAddress] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    // Instant balances (blaze-sdk watchBalances): pushed the moment anything changes, each one what's ready to use,
    // so this round's bets and any open orders are already set aside
    const [sheet, setSheet] = useState<BalanceSheet | null>(null);
    /** A token's ready-to-use balance; null while it isn't known (not read yet, or the chain couldn't be read) */
    const readyOf = (token: string): string | null => (!sheet ? null : sheet.tokens[token] ? sheet.tokens[token].ready : '0');
    const [mainnetReady, v1Ready, v2Ready, stxReady] = [MAINNET_CHA_CONTRACT_ID, CHA_SUBNET_V1, CHA_SUBNET_V2, '.stx'].map(readyOf);
    const stxBalance = stxReady ?? '0';
    const mainnetBalance = mainnetReady ?? '0';
    const subnetBalances = { v1: v1Ready ?? '0', v2: v2Ready ?? '0' };
    const subnetBalance = (BigInt(subnetBalances.v1) + BigInt(subnetBalances.v2)).toString();
    const balanceLoading = mainnetReady === null;
    const subnetBalanceLoading = v1Ready === null || v2Ready === null;
    const stxBalanceLoading = stxReady === null;

    const quoteRef = useRef<any>(null);
    const routerRef = useRef<Router>(new Router({
        maxHops: 4,
        defaultSlippage: 0.05,
        routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop',
    }));

    const router = routerRef.current;

    useEffect(() => {
        loadVaults(router);
    }, []);

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
        setSheet(null);
    };

    // One live stream for the connected wallet's balances
    useEffect(() => {
        if (!connected || !address) return;
        return watchBalances(address, setSheet, { onProblem: problem => console.error('[WalletContext] Balances:', problem.message) });
    }, [connected, address]);

    // a bet is a signed TRANSFER_TOKENS intent for one CHA subnet, targeted at the multihop router
    const placeBet = async (amount: bigint, tokenId: string, subnet: ChaSubnet): Promise<PublicBet> => {
        if (!connected || !address) throw new Error('Connect your wallet first');
        const uuid = uuidv4();
        const signed = await signIntentWithWallet({
            contract: subnet,
            intent: 'TRANSFER_TOKENS',
            amount: Number(amount),
            target: MULTIHOP_CONTRACT_ID,
            uuid,
        });
        const response = await fetch('/api/bets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature: signed.signature.replace(/^0x/, ''), uuid, user: address, tokenId, amount: amount.toString(), subnet }),
        });
        const payload = await response.json().catch(() => ({ error: `The game answered ${response.status}` }));
        if (!response.ok) throw new Error(payload.error ?? `The game answered ${response.status}`);
        return payload.bet as PublicBet;
    };

    // the upgrade is a v1 TRANSFER_TOKENS intent for x-multihop-v2; the game routes it v1 → v2 and pays the fee
    const upgradeToV2 = async (amount: bigint): Promise<string> => {
        if (!connected || !address) throw new Error('Connect your wallet first');
        const uuid = uuidv4();
        const signed = await signIntentWithWallet({ contract: CHA_SUBNET_V1, intent: 'TRANSFER_TOKENS', amount: Number(amount), target: MULTIHOP_V2_CONTRACT_ID, uuid });
        const response = await fetch('/api/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature: signed.signature.replace(/^0x/, ''), uuid, user: address, amount: amount.toString() }),
        });
        const payload = await response.json().catch(() => ({ error: `The game answered ${response.status}` }));
        if (!response.ok) throw new Error(payload.error ?? `The game answered ${response.status}`);
        return payload.txid as string;
    };

    /** Reads the balances once more; the live stream already keeps them current, so this is rarely needed */
    const refreshBalances = () => {
        if (!address) return;
        getBalances(address).then(setSheet, error => console.error('[WalletContext] Balances:', error.message));
    };

    const getQuote = async (from: string, to: string, amount: number) => {
        try {
            const response = await fetchQuote(from, to, amount);
            quoteRef.current = response as any;
            console.log('getQuote response:', response);
            return { success: true, quote: response };
        } catch (error: any) {
            console.error('getQuote error:', error);
            return { success: false, error: error.message || String(error) };
        }
    };

    const swapTokens = async (route: Route) => {
        try {
            console.log('swapTokens route:', route);
            const txCfg = await buildSwapTransaction(router, route, address);
            const response = await request('stx_callContract', { ...txCfg, address });
            return response;
        } catch (error: any) {
            console.error('executeSwap error:', error);
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
                subnetBalances,
                balanceLoading,
                subnetBalanceLoading,
                stxBalanceLoading,
                connectWallet,
                disconnectWallet,
                placeBet,
                upgradeToV2,
                refreshBalances,
                getQuote,
                swapTokens
            }}
        >
            {children}
        </WalletContext.Provider>
    );
} 