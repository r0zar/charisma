'use client'

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchCallReadOnlyFunction, stringAsciiCV, principalCV, ClarityType } from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network'; // Use appropriate network
import { BLAZE_SIGNER_CONTRACT, parseContract } from '../../constants/contracts'; // Import constant and parser

// Assume the BLAZE_SIGNER_CONTRACT has this function signature:
// (define-read-only (is-uuid-submitted (uuid (string-ascii 64))) (response bool uint))

function VerifyContent() {
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
        <div style={{ maxWidth: '500px', margin: '2rem auto', padding: '1rem' }}>
            {/* Optional: Wallet connector area could go here if needed */}

            <h1 style={{ fontSize: '1.75rem', lineHeight: '2rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>Note Status Check</h1>

            {uuid ? (
                <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: '#ffffff', padding: '1.5rem', textAlign: 'center' }}>
                    {/* Main Status Display */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: '600', color: statusInfo.color }}>
                            {statusInfo.text}
                        </p>
                        {error && <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#b91c1c' }}>{error}</p>}
                        {verificationStatus === 'Submitted' && <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#9a3412' }}>This note (UUID) has already been processed.</p>}
                        {verificationStatus === 'Not Submitted' && <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#166534' }}>This note (UUID) has not been submitted yet.</p>}
                    </div>

                    {/* Technical Details (Minimized) */}
                    <div style={{ paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                        <details style={{ cursor: 'pointer' }}>
                            <summary style={{ fontSize: '0.75rem', color: '#6b7280', display: 'inline-block' }}>Show Technical Details</summary>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#4b5563', fontFamily: 'monospace', overflowWrap: 'break-word', textAlign: 'left', backgroundColor: '#f9fafb', padding: '0.5rem', borderRadius: '0.25rem' }}>
                                {originalContractParam && <p><strong>Original Target Contract:</strong> {originalContractParam}</p>}
                                <p style={{ marginTop: '0.25rem' }}><strong>Checking Contract:</strong> {BLAZE_SIGNER_CONTRACT}</p>
                                <p style={{ marginTop: '0.25rem' }}><strong>UUID:</strong> {uuid}</p>
                            </div>
                        </details>
                    </div>
                </div>
            ) : (
                // Improved error display for missing UUID
                <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '2rem', textAlign: 'center', border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#dc2626' }}>Invalid Link</h2>
                    <p style={{ color: '#b91c1c', marginTop: '0.5rem' }}>The link is missing the required UUID parameter.</p>
                </div>
            )}
        </div>
    );
}

// Wrap with Suspense because useSearchParams() needs it
export default function VerifyPage() {
    return (
        <Suspense fallback={<div>Loading verification details...</div>}>
            <VerifyContent />
        </Suspense>
    );
} 