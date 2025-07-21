"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import Link from "next/link"

export default function SystemActions() {
  const [triggering, setTriggering] = useState(false)

  const handleManualTrigger = async () => {
    setTriggering(true)
    try {
      const response = await fetch('/api/trigger', { method: 'POST' })
      const result = await response.json()
      console.log('Manual trigger result:', result)
      
      // Show success message or handle result
      if (response.ok) {
        // Optionally show a success toast
        console.log('Price update triggered successfully')
      }
    } catch (error) {
      console.error('Manual trigger failed:', error)
    } finally {
      setTriggering(false)
    }
  }

  const handleTestBlobUpload = async () => {
    try {
      const response = await fetch('/api/test-blob', { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        alert(`Blob URL discovered!\n\nFull URL: ${result.fullUrl}\n\nBase URL: ${result.baseUrl}\n\nAdd this to your .env.local:\nBLOB_BASE_URL="${result.baseUrl}/"`)
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Test blob upload failed:', error)
      alert('Test blob upload failed - check console')
    }
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button 
            onClick={handleManualTrigger}
            disabled={triggering}
            className="w-full justify-start hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
            size="lg"
          >
            {triggering ? (
              <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            ) : (
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            )}
            {triggering ? 'Triggering...' : 'Manual Price Update'}
          </Button>
          
          <Button 
            onClick={handleTestBlobUpload}
            variant="outline"
            className="w-full justify-start hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80"
            size="lg"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            Test Blob Storage
          </Button>
          
          <Link href="/history" className="w-full">
            <Button 
              variant="outline" 
              className="w-full justify-start hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80" 
              size="lg"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              View Price History
            </Button>
          </Link>
          
          <Link href="/series" className="w-full">
            <Button 
              variant="outline" 
              className="w-full justify-start hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80" 
              size="lg"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Price Series Analysis
            </Button>
          </Link>
          
          <Link href="/api/status" className="w-full">
            <Button 
              variant="outline" 
              className="w-full justify-start hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80" 
              size="lg"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              API Status Endpoint
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}