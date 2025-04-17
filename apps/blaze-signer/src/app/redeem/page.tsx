'use client'

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { RedeemNoteForm } from '../../components/blaze-signer/welsh-credits/redeem-note-form';
import { STACKS_MAINNET } from '@stacks/network'; // Correct import name
import type { AddressEntry } from "@stacks/connect/dist/types/methods"; // Import type for localStorage data
import { connect } from "@stacks/connect"; // Import connect function
import { Button } from "@repo/ui/button"; // Assuming Button component exists
import { Loader2 } from "@repo/ui/icons"; // Assuming Loader icon exists
// Imports needed for status check
import { fetchCallReadOnlyFunction, stringAsciiCV, ClarityType } from '@stacks/transactions';
import { BLAZE_SIGNER_CONTRACT, parseContract } from '../../constants/contracts';

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

    // State for UUID status check
    const [isCheckingStatus, setIsCheckingStatus] = useState(true); // Start checking immediately
    const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);

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

    // Check UUID status on component mount or when UUID changes
    useEffect(() => {
        if (uuid) {
            const checkUuidStatus = async () => {
                setIsCheckingStatus(true);
                setIsAlreadySubmitted(false);
                setCheckError(null);
                try {
                    const [blazeAddress, blazeContractName] = parseContract(BLAZE_SIGNER_CONTRACT);
                    const result = await fetchCallReadOnlyFunction({
                        contractAddress: blazeAddress,
                        contractName: blazeContractName,
                        functionName: 'is-uuid-submitted',
                        functionArgs: [stringAsciiCV(uuid)],
                        network: STACKS_MAINNET,
                        senderAddress: blazeAddress,
                    });

                    if ('type' in result && result.type === ClarityType.BoolTrue) {
                        setIsAlreadySubmitted(true);
                    } else if ('type' in result && result.type === ClarityType.BoolFalse) {
                        setIsAlreadySubmitted(false);
                    } else {
                        throw new Error("Unexpected result type checking UUID status");
                    }
                } catch (err: any) {
                    console.error("Error checking UUID status on redeem page:", err);
                    setCheckError(`Failed to check note status: ${err.message || String(err)}`);
                } finally {
                    setIsCheckingStatus(false);
                }
            };
            checkUuidStatus();
        } else {
            // If no UUID, stop checking (or handle as invalid link)
            setIsCheckingStatus(false);
        }
    }, [uuid]); // Re-run if UUID changes

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
        return (
            <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '2rem', textAlign: 'center', border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#dc2626' }}>Invalid Link</h2>
                <p style={{ color: '#b91c1c', marginTop: '0.5rem' }}>The redemption link is missing required details (signature, amount, or UUID).</p>
            </div>
        );
    }

    // Show Loading state for status check
    if (isCheckingStatus) {
        return (
            <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '2rem', textAlign: 'center' }}>
                <Loader2 style={{ margin: '0 auto', height: '2rem', width: '2rem', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '1rem', color: '#4b5563' }}>Checking note status...</p>
            </div>
        );
    }

    // Show Error state for status check
    if (checkError) {
        return (
            <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '2rem', textAlign: 'center', border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#dc2626' }}>Status Check Failed</h2>
                <p style={{ color: '#b91c1c', marginTop: '0.5rem' }}>{checkError}</p>
            </div>
        );
    }

    // Show Already Submitted state
    if (isAlreadySubmitted) {
        return (
            <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '2rem', textAlign: 'center', border: '1px solid #fed7aa', backgroundColor: '#fffbeb', borderRadius: '0.5rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#c2410c', marginBottom: '1rem' }}>Note Already Redeemed</h1>
                <p style={{ color: '#9a3412' }}>This note (identified by its UUID) has already been submitted and redeemed. It cannot be redeemed again.</p>
                {/* Optional: Add a link to the verify page or transaction explorer */}
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '1rem' }}>
            {/* Wallet Connector Area - Top Right */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
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

            {/* Main Content Area */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#1e3a8a' }}>Collect Your WELSH!</h1>
                <p style={{ color: '#4b5563', fontSize: '1.1rem' }}>You're about to redeem a signed note to receive WELSH tokens.</p>
            </div>

            {/* Pass data to the form component */}
            <RedeemNoteForm
                network={network}
                isWalletConnected={isConnected}
                onSuccess={handleSuccess}
                initialSignature={sig}
                initialAmount={amount}
                initialUuid={uuid}
                initialRecipient={walletAddress || ""}
                connectedWalletAddress={walletAddress}
            // Add className or style prop if RedeemNoteForm supports it for outer container styling
            />

            {/* Explanation Section */}
            <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px dashed #cbd5e1', textAlign: 'center' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>How does this work? (It's like cashing a check!)</h4>
                <p style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: '1.6' }}>
                    The original sender of these tokens previously signed a secure, off-chain message (like writing a check or IOU) authorizing this specific transfer.
                    <br />
                    This note contains their cryptographic signature, proving they approved sending {amount || 'these'} WELSH tokens. Each note also includes a unique ID (UUID) to prevent it from being used more than once.
                    <br /><br />
                    You are now submitting this pre-authorized note to the Stacks blockchain (secured by Bitcoin) to claim the funds into the recipient address specified above. The system verifies the original sender's signature and checks the UUID to ensure the transaction is valid and hasn't already been processed.
                    <br /><br />
                    Since you're seeing this page, it means the note is ready to be redeemed – you're the first to cash this check!
                    <br /><br />
                    This "sign first, submit later" method allows for secure transfers without requiring the original sender to be online now, enabling cool features like off-chain payments and efficient processing.
                </p>
            </div>
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