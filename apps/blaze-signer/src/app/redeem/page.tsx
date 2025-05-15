'use client'

import React, { Suspense } from 'react'
import { RedeemPageContent } from '../../components/blaze-signer/redeem-content'

export default function RedeemPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div>}>
            <RedeemPageContent />
        </Suspense>
    )
} 