'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, ExternalLink } from 'lucide-react'
import { DrawCountdown } from './draw-countdown'
import { PhysicalJackpot } from '@/types/lottery'

async function getCurrentJackpot(): Promise<PhysicalJackpot> {
  try {
    const response = await fetch('/api/v1/lottery/jackpot')
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch jackpot')
    }
    
    return result.data.jackpot
  } catch (error) {
    console.error('Failed to get current jackpot:', error)
    throw new Error('Current jackpot data not available. Please connect to the blockchain lottery contract to fetch the current jackpot information.')
  }
}

async function getNextDrawTime(): Promise<string> {
  try {
    const response = await fetch('/api/v1/lottery/draw-time')
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch draw time')
    }
    
    return result.data.nextDrawDate
  } catch (error) {
    console.error('Failed to get next draw time:', error)
    throw new Error('Next draw time not available. Please connect to the blockchain lottery contract to fetch the next draw schedule.')
  }
}

export function JackpotSection() {
  const [jackpotError, setJackpotError] = useState<string | null>(null)
  const [drawTimeError, setDrawTimeError] = useState<string | null>(null)
  const [jackpot, setJackpot] = useState<PhysicalJackpot | null>(null)
  const [nextDrawDate, setNextDrawDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    setJackpotError(null)
    setDrawTimeError(null)

    try {
      const jackpotItem = await getCurrentJackpot()
      setJackpot(jackpotItem)
    } catch (err) {
      setJackpotError(err instanceof Error ? err.message : 'Failed to fetch jackpot information')
    }

    try {
      const drawTime = await getNextDrawTime()
      setNextDrawDate(drawTime)
    } catch (err) {
      setDrawTimeError(err instanceof Error ? err.message : 'Failed to fetch next draw time')
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRetry = () => {
    fetchData()
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 glow-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary animate-pulse"></div>
        
        <CardContent className="text-center py-8 relative z-10">
          <div className="space-y-4">
            <Badge variant="default" className="text-lg py-2 px-4 glow-secondary">
              <Trophy className="h-5 w-5 mr-2" />
              Loading Jackpot
            </Badge>
            <div className="text-5xl font-bold text-primary font-vegas-numbers">
              Loading...
            </div>
            <div className="text-muted-foreground">
              Fetching lottery data...
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (jackpotError || drawTimeError) {
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-destructive/20 glow-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary animate-pulse"></div>
        
        <CardContent className="text-center py-8 relative z-10">
          <div className="space-y-4">
            <Badge variant="destructive" className="text-lg py-2 px-4">
              <Trophy className="h-5 w-5 mr-2" />
              Jackpot Unavailable
            </Badge>
            
            {jackpotError && (
              <div className="text-muted-foreground text-sm mb-2">
                {jackpotError}
              </div>
            )}
            
            <div className="text-3xl font-bold text-destructive font-vegas-numbers">
              Unable to Load Jackpot
            </div>
            
            {drawTimeError && (
              <>
                <div className="text-muted-foreground">
                  Next draw time:
                </div>
                <div className="text-muted-foreground text-sm">
                  {drawTimeError}
                </div>
              </>
            )}
            
            <Button variant="outline" onClick={handleRetry} className="mt-4">
              Retry Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 glow-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 animate-pulse"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary animate-pulse"></div>
      
      <CardContent className="py-8 relative z-10">
        <div className="space-y-6">
          <div className="text-center">
            <Badge variant="default" className="text-lg py-2 px-4 glow-secondary">
              <Trophy className="h-5 w-5 mr-2" />
              Current Jackpot Prize
            </Badge>
          </div>
          
          {jackpot && (
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Jackpot Image */}
              <div className="flex-shrink-0">
                <img 
                  src={jackpot.imageUrl} 
                  alt={jackpot.title}
                  className="w-48 h-36 object-cover rounded-lg border-2 border-primary/20"
                />
              </div>
              
              {/* Jackpot Details */}
              <div className="flex-1 text-center md:text-left space-y-3">
                <h3 className="text-3xl font-bold text-primary font-vegas-numbers">
                  {jackpot.title}
                </h3>
                
                {jackpot.estimatedValue && (
                  <div className="text-lg text-muted-foreground">
                    Estimated value: {jackpot.estimatedValue.toLocaleString()} STONE
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  onClick={() => window.open(jackpot.linkUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Details
                </Button>
              </div>
            </div>
          )}
          
          <div className="text-center space-y-2">
            <div className="text-muted-foreground">
              Next draw in:
            </div>
            {nextDrawDate && <DrawCountdown targetDate={new Date(nextDrawDate)} />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}