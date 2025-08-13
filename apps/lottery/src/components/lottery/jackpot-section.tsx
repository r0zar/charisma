'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, ExternalLink } from 'lucide-react'
import { DrawCountdown } from './draw-countdown'
import { PhysicalJackpot } from '@/types/lottery'
import { Carousel } from '@/components/ui/carousel'

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

      <CardContent className="py-6 sm:py-12 px-4 sm:px-8 relative z-10">
        <div className="space-y-6 sm:space-y-8">

          {jackpot && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12 lg:gap-16 items-center min-h-[300px] sm:min-h-[400px]">
              {/* Jackpot Image Carousel - Enhanced */}
              <div className="flex justify-center lg:justify-start order-1 lg:order-1">
                <div className="w-full max-w-xs sm:max-w-md lg:max-w-lg aspect-[4/3]">
                  <Carousel 
                    images={jackpot.imageUrls || []}
                    alt={jackpot.title}
                    autoSlideInterval={5000}
                    className="w-full h-full border-2 border-primary/30 shadow-2xl rounded-xl overflow-hidden"
                  />
                </div>
              </div>

              {/* Jackpot Details - Enhanced */}
              <div className="space-y-4 sm:space-y-6 lg:space-y-8 text-center lg:text-left order-2 lg:order-2">
                <div className="space-y-3 sm:space-y-4">
                  <Badge variant="outline" className="text-sm sm:text-lg py-1 sm:py-2 px-2 sm:px-4 glow-secondary border-primary/30">
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                    Current Jackpot
                  </Badge>
                  
                  <h3 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary font-vegas-numbers leading-tight px-2 sm:px-0">
                    {jackpot.title}
                  </h3>

                  {jackpot.estimatedValue && (
                    <div className="text-lg sm:text-2xl lg:text-3xl text-muted-foreground font-medium px-2 sm:px-0">
                      Estimated value: <span className="text-green-600 font-bold">${(jackpot.estimatedValue / 1000).toLocaleString()} USD</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 sm:gap-4 pt-2 sm:pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2 px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-lg hover:bg-primary/10 hover:border-primary/50 transition-all"
                    onClick={() => window.open(jackpot.linkUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
                    View Prize Details
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Countdown Section - Enhanced */}
          <div className="text-center space-y-3 sm:space-y-4 pt-6 sm:pt-8 border-t border-primary/20">
            <div className="text-muted-foreground font-medium text-lg sm:text-xl">
              Next draw in:
            </div>
            {nextDrawDate && (
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg p-4 sm:p-6">
                <DrawCountdown targetDate={new Date(nextDrawDate)} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}