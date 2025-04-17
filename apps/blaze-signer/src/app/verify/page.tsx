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

    return (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem' }}>
            <h1 style={{ fontSize: '1.5rem', lineHeight: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Verify UUID Status</h1>
            {uuid ? (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', backgroundColor: '#f9fafb' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {originalContractParam && <p><strong>Original Target Contract:</strong> {originalContractParam}</p>} {/* Display original contract */}
                        <p><strong>UUID:</strong> {uuid}</p>
                        <p><strong>Checking Contract:</strong> {BLAZE_SIGNER_CONTRACT}</p> {/* Show which contract is being checked */}
                        <div style={{ marginTop: '1rem' }}>
                            <h3 style={{ fontWeight: '600' }}>Status:</h3>
                            {isLoading && <p>Checking status...</p>}
                            {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}
                            {verificationStatus && (
                                <p style={{
                                    fontWeight: 'bold',
                                    color: verificationStatus === 'Submitted' ? '#ea580c' : '#16a34a'
                                }}>
                                    {verificationStatus}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <p style={{ color: '#dc2626' }}>Missing UUID parameter in the URL.</p>
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