"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorDisplayProps {
  error: string
  onRetry: () => void
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const isServiceError = error.includes('Service') || error.includes('500')
  const isNetworkError = error.includes('fetch') || error.includes('network')
  
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Unable to Load Contract Registry Data</CardTitle>
        <CardDescription>
          {isServiceError 
            ? "The contract registry service is currently unavailable."
            : isNetworkError 
            ? "Network connection error. Please check your internet connection."
            : "There was an error loading the contract registry statistics."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-mono">{error}</p>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">This application requires real data from the contract registry service. No fallback data is provided.</p>
            <p>Please ensure the service is running and try again.</p>
          </div>
          
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </CardContent>
    </Card>
  )
}