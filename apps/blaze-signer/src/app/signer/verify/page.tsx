'use client'

import React, { Suspense } from 'react';
import { VerifyContent } from '../../../components/blaze-signer/verify-content';

// Wrap with Suspense because useSearchParams() needs it
export default function VerifyPage() {
    return (
        <Suspense fallback={<div>Loading verification details...</div>}>
            <VerifyContent />
        </Suspense>
    );
} 