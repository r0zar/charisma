'use client'

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchCallReadOnlyFunction, stringAsciiCV, principalCV, ClarityType } from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network'; // Use appropriate network
import { BLAZE_SIGNER_CONTRACT, parseContract } from '../../constants/contracts'; // Import constant and parser

// Extracted component from the original verify page
export function VerifyContent() {
    const searchParams = useSearchParams();
    const uuid = searchParams.get('uuid');
    const originalContractParam = searchParams.get('contract'); // Get original contract from URL for display

    const [isLoading, setIsLoading] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (uuid) { // Only need UUID now
            const checkUuidStatus = async () => {
                setIsLoading(true);
                setVerificationStatus(null);
                setError(null);

                try {
                    // Use the hardcoded BLAZE_SIGNER_CONTRACT for the check
                    const [blazeAddress, blazeContractName] = parseContract(BLAZE_SIGNER_CONTRACT);

                    const result = await fetchCallReadOnlyFunction({
                        contractAddress: blazeAddress,
                        contractName: blazeContractName,
                        functionName: 'is-uuid-submitted',
                        functionArgs: [stringAsciiCV(uuid)],
                        network: STACKS_MAINNET, // Replace with dynamic network if needed
                        senderAddress: blazeAddress, // Use blaze address as sender
                    });

                    // Check the result type directly
                    if ('type' in result && result.type === ClarityType.BoolTrue) {
                        setVerificationStatus('Submitted');
                    } else if ('type' in result && result.type === ClarityType.BoolFalse) {
                        setVerificationStatus('Not Submitted');
                    } else {
                        // Handle unexpected response types (e.g., if the function returned an error response)
                        console.error("Unexpected result type from contract:", result);
                        throw new Error("Unexpected result type from contract");
                    }
                } catch (err: any) {
                    console.error("Error checking UUID status:", err);
                    setError(`Failed to check status: ${err.message || String(err)}`);
                } finally {
                    setIsLoading(false);
                }
            };

            checkUuidStatus();
        }
    }, [uuid]); // Dependency array only includes uuid

    // Function to determine status color and text
    const getStatusStyle = () => {
        if (isLoading) return { color: '#6b7280', text: 'Checking...' };
        if (error) return { color: '#dc2626', text: 'Error' };
        if (verificationStatus === 'Submitted') return { color: '#ea580c', text: 'Already Submitted' };
        if (verificationStatus === 'Not Submitted') return { color: '#16a34a', text: 'Ready to Submit' };
        return { color: '#6b7280', text: 'Waiting for details...' };
    };

    const statusInfo = getStatusStyle();

    return (
        <div className="w-full max-w-[500px] mx-auto my-8 px-4">
            <h1 className="text-2xl font-bold mb-8 text-center">Note Status Check</h1>

            {uuid ? (
                <div className="border border-border rounded-lg bg-card p-6 text-center">
                    {/* Main Status Display */}
                    <div className="mb-6">
                        <p className="text-xl font-semibold" style={{ color: statusInfo.color }}>
                            {statusInfo.text}
                        </p>
                        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
                        {verificationStatus === 'Submitted' &&
                            <p className="mt-1 text-sm text-orange-700">This note (UUID) has already been processed.</p>}
                        {verificationStatus === 'Not Submitted' &&
                            <p className="mt-1 text-sm text-green-700">This note (UUID) has not been submitted yet.</p>}
                    </div>

                    {/* Technical Details (Minimized) */}
                    <div className="pt-4 border-t border-border">
                        <details className="cursor-pointer">
                            <summary className="text-xs text-muted inline-block">Show Technical Details</summary>
                            <div className="mt-2 text-xs text-foreground font-mono break-words text-left bg-muted/50 p-2 rounded-md">
                                {originalContractParam && <p><strong>Original Target Contract:</strong> {originalContractParam}</p>}
                                <p className="mt-1"><strong>Checking Contract:</strong> {BLAZE_SIGNER_CONTRACT}</p>
                                <p className="mt-1"><strong>UUID:</strong> {uuid}</p>
                            </div>
                        </details>
                    </div>
                </div>
            ) : (
                // Improved error display for missing UUID
                <div className="w-full mx-auto my-8 p-6 text-center border border-destructive/20 bg-destructive/5 rounded-lg">
                    <h2 className="text-lg font-semibold text-destructive">Invalid Link</h2>
                    <p className="text-destructive/80 mt-2">The link is missing the required UUID parameter.</p>
                </div>
            )}
        </div>
    );
} 