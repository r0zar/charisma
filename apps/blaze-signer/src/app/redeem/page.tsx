'use client'

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { RedeemNoteForm } from '../../components/blaze-signer/welsh-credits/redeem-note-form';
import { STACKS_MAINNET } from '@stacks/network'; // Correct import name
import type { AddressEntry } from "@stacks/connect/dist/types/methods"; // Import type for localStorage data
import { connect } from "@stacks/connect"; // Import connect function
import { Button } from "@repo/ui/button"; // Assuming Button component exists
import { Loader2 } from "@repo/ui/icons"; // Assuming Loader icon exists

// Mock function/values - Replace with your actual implementation
const getNetwork = () => STACKS_MAINNET; // Use the correct instance
const handleSuccess = () => { alert('Redemption Successful!'); }; // Replace with your success handler

function RedeemPageContent() {
    const searchParams = useSearchParams();
    const sig = searchParams.get('sig') ?? undefined;
    const amount = searchParams.get('amount') ?? undefined;
    const uuid = searchParams.get('uuid') ?? undefined;

    // State for wallet details 
    const [isConnected, setIsConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const network = getNetwork();

    // Read from localStorage on component mount
    useEffect(() => {
        try {
            const storedAddresses = localStorage.getItem('addresses');
            if (storedAddresses) {
                const addresses: AddressEntry[] = JSON.parse(storedAddresses);
                // Assuming index 2 is mainnet, like in WalletConnector
                if (addresses.length > 2 && addresses[2]?.address) {
                    setWalletAddress(addresses[2].address);
                    setIsConnected(true);
                } else {
                    setIsConnected(false);
                    setWalletAddress(null);
                }
            } else {
                setIsConnected(false);
                setWalletAddress(null);
            }
        } catch (error) {
            console.error("Error reading wallet address from localStorage:", error);
            setIsConnected(false);
            setWalletAddress(null);
        }
    }, []);

    // Function to handle wallet connection
    const handleConnectWallet = async () => {
        setIsConnecting(true);
        try {
            const result = await connect();
            if (result.addresses && result.addresses.length > 2) {
                localStorage.setItem('addresses', JSON.stringify(result.addresses));
                const mainnetAddress = result.addresses[2].address;
                setWalletAddress(mainnetAddress);
                setIsConnected(true);
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            // Optionally show an error message to the user
        } finally {
            setIsConnecting(false);
        }
    };

    // Function to handle wallet disconnection
    const handleDisconnectWallet = () => {
        localStorage.removeItem('addresses');
        setWalletAddress(null);
        setIsConnected(false);
        // Note: We don't need to call onWalletUpdate here like in WalletConnector
    };

    // Basic validation for URL params
    if (!sig || !amount || !uuid) {
        return <p style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem', color: '#dc2626' }}>Missing required signature, amount, or UUID parameters in the URL.</p>;
    }

    return (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem' }}>
            <h1 style={{ fontSize: '1.5rem', lineHeight: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Redeem Note</h1>

            {/* Always render the wallet status/button container */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                {isConnected && walletAddress ? (
                    // Connected State UI
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f3f4f6', borderRadius: '0.375rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                {`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}
                            </span>
                        </div>
                        <Button variant="outline" onClick={handleDisconnectWallet}>
                            Disconnect
                        </Button>
                    </div>
                ) : (
                    // Disconnected State UI (Connect Button)
                    <Button
                        onClick={handleConnectWallet}
                        disabled={isConnecting}
                    >
                        {isConnecting ? (
                            <>
                                <Loader2 style={{ marginRight: '0.5rem', height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                                Connecting...
                            </>
                        ) : (
                            "Connect Wallet"
                        )}
                    </Button>
                )}
            </div>

            {/* Always render the form */}
            <RedeemNoteForm
                network={network}
                isWalletConnected={isConnected}
                onSuccess={handleSuccess}
                initialSignature={sig}
                initialAmount={amount}
                initialUuid={uuid}
                initialRecipient={walletAddress || ""}
                connectedWalletAddress={walletAddress}
            />
        </div>
    );
}

// Wrap with Suspense because useSearchParams() needs it
export default function RedeemPage() {
    return (
        <Suspense fallback={<div>Loading redemption form...</div>}>
            <RedeemPageContent />
        </Suspense>
    );
} 