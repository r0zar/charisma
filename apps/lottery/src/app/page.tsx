"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to lottery page immediately
    router.replace("/lottery")
  }, [router])

  // Show minimal loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-lg text-muted-foreground">Redirecting to lottery...</div>
      </div>
    </div>
  )
}