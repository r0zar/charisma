'use client'

import React, { Suspense } from 'react';
import { RedeemPageContent } from '../../../components/blaze-signer/redeem-content';

// Wrap with Suspense because useSearchParams() needs it
export default function RedeemPage() {
    return (
        <Suspense fallback={<div>Loading redemption form...</div>}>
            <RedeemPageContent />
        </Suspense>
    );
} 