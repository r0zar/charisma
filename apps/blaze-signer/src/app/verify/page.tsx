'use client'

import React, { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function VerifyRedirectContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const uuid = searchParams.get('uuid')
    const contract = searchParams.get('contract')

    useEffect(() => {
        // Build new URL with search parameters
        let newPath = '/signer/verify'
        const params = new URLSearchParams()
        if (uuid) params.set('uuid', uuid)
        if (contract) params.set('contract', contract)

        const paramString = params.toString()
        if (paramString) {
            newPath += `?${paramString}`
        }

        // Redirect to the new path
        router.replace(newPath)
    }, [router, uuid, contract])

    return null
}

export default function VerifyRedirect() {
    return (
        <Suspense fallback={null}>
            <VerifyRedirectContent />
        </Suspense>
    )
} 