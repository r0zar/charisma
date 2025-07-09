"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, ArrowLeft, Search } from "lucide-react"

export default function NotFound() {
  const handleGoBack = () => {
    if (typeof window !== "undefined") {
      window.history.back()
    }
  }
  return (
    <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
      <div className="flex flex-col gap-8 items-center text-center max-w-lg">
        {/* 404 Display */}
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-primary/20 select-none">404</h1>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary/20 mx-auto rounded-full" />
        </div>

        {/* Error Card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Search className="h-5 w-5" />
              Page Not Found
            </CardTitle>
            <CardDescription>
              The page you're looking for doesn't exist or has been moved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              This could happen if you typed the URL incorrectly, followed a broken link, 
              or the page has been removed from our site.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Link>
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleGoBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Helpful Links */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">You might be looking for:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="link" size="sm" asChild>
              <Link href="/docs">Documentation</Link>
            </Button>
            <span className="text-muted-foreground">•</span>
            <Button variant="link" size="sm" asChild>
              <Link href="/examples">Examples</Link>
            </Button>
            <span className="text-muted-foreground">•</span>
            <Button variant="link" size="sm" asChild>
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}