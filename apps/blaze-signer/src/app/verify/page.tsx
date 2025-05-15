'use client'

import React, { Suspense } from 'react'
import { VerifyContent } from '../../components/blaze-signer/verify-content'

export default function VerifyPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div>}>
            <VerifyContent />
        </Suspense>
    )
} 