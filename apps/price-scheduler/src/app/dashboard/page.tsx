'use client'

import { redirect } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardRedirect() {
  useEffect(() => {
    // Client-side redirect as a fallback
    window.location.href = '/'
  }, [])
  
  // Server-side redirect
  redirect('/')
}