'use client'

import React, { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function RedeemRedirectContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const sig = searchParams.get('sig')
    const amount = searchParams.get('amount')
    const uuid = searchParams.get('uuid')

    useEffect(() => {
        // Build new URL with search parameters
        let newPath = '/signer/redeem'
        const params = new URLSearchParams()
        if (sig) params.set('sig', sig)
        if (amount) params.set('amount', amount)
        if (uuid) params.set('uuid', uuid)

        const paramString = params.toString()
        if (paramString) {
            newPath += `?${paramString}`
        }

        // Redirect to the new path
        router.replace(newPath)
    }, [router, sig, amount, uuid])

    return null
}

export default function RedeemRedirect() {
    return (
        <Suspense fallback={null}>
            <RedeemRedirectContent />
        </Suspense>
    )
} 