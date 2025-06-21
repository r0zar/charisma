'use client';

import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { connect } from '@stacks/connect';
import type { AddressEntry } from '@stacks/connect/dist/types/methods';

interface WalletContextType {
  connected: boolean;
  address: string;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  address: '',
  isConnecting: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Check for existing wallet connection on mount
  useEffect(() => {
    const addresses: AddressEntry[] = JSON.parse(localStorage.getItem('addresses') || '[]');
    if (addresses.length) {
      const mainnetAddress = addresses[2]?.address; // Index 2 is mainnet
      if (mainnetAddress) {
        setConnected(true);
        setAddress(mainnetAddress);
        console.log(`🔗 Wallet auto-connected: ${mainnetAddress}`);
      }
    }
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
        console.log(`🔗 Wallet connected: ${mainnetAddress}`);
      }
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Function to disconnect wallet
  const disconnectWallet = () => {
    localStorage.removeItem('addresses');
    setAddress('');
    setConnected(false);
    console.log('🔌 Wallet disconnected');
  };

  return (
    <WalletContext.Provider
      value={{
        connected,
        address,
        isConnecting,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}