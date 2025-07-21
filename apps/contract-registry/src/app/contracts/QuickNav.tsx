"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ArrowRight } from "lucide-react"

export function QuickNav() {
  const [address, setAddress] = useState("")
  const [isNavigating, setIsNavigating] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedAddress = address.trim()
    if (!trimmedAddress) return

    setIsNavigating(true)
    
    try {
      // Navigate to the contract detail page
      router.push(`/contracts/${encodeURIComponent(trimmedAddress)}`)
    } catch (error) {
      console.error("Navigation failed:", error)
      setIsNavigating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e as any)
    }
  }

  return (
    <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-2xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Quick Navigation:</span>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 w-full sm:w-auto">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter contract address (e.g., SP1ABC...DEF.my-contract)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 font-mono text-sm"
              disabled={isNavigating}
            />
            <Button 
              type="submit" 
              size="sm" 
              disabled={!address.trim() || isNavigating}
              className="flex-shrink-0"
            >
              {isNavigating ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span className="sr-only">Navigate to contract</span>
            </Button>
          </div>
        </form>
      </div>
      
      <div className="mt-2 text-xs text-muted-foreground">
        Enter a full contract identifier to jump directly to its details page
      </div>
    </div>
  )
}