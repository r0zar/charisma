'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, ExternalLink } from 'lucide-react'
import { DrawCountdown } from './draw-countdown'
import { PhysicalJackpot, Jackpot } from '@/types/lottery'
import { Carousel } from '@/components/ui/carousel'

async function getCurrentJackpot(): Promise<PhysicalJackpot | Jackpot> {
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
  const [jackpot, setJackpot] = useState<PhysicalJackpot | Jackpot | null>(null)
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
      <div className="space-y-6 text-center py-12">
        <Badge variant="default" className="text-sm py-1 px-3">
          <Trophy className="h-4 w-4 mr-2" />
          Loading Jackpot
        </Badge>
        <div className="text-3xl font-bold">
          Loading...
        </div>
        <div className="text-muted-foreground">
          Fetching lottery data...
        </div>
      </div>
    )
  }

  if (jackpotError || drawTimeError) {
    return (
      <div className="space-y-6 text-center py-12">
        <Badge variant="destructive" className="text-sm py-1 px-3">
          <Trophy className="h-4 w-4 mr-2" />
          Jackpot Unavailable
        </Badge>

        {jackpotError && (
          <div className="text-muted-foreground text-sm">
            {jackpotError}
          </div>
        )}

        <div className="text-2xl font-bold text-destructive">
          Unable to Load Jackpot
        </div>

        {drawTimeError && (
          <div className="text-muted-foreground text-sm">
            {drawTimeError}
          </div>
        )}

        <Button variant="outline" onClick={handleRetry}>
          Retry Connection
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Jackpot Image with Countdown Overlay */}
      {jackpot && (
        <div className="w-full max-w-2xl mx-auto aspect-[4/3] rounded-xl overflow-hidden relative">
          <Carousel
            images={'imageUrls' in jackpot ? jackpot.imageUrls : [jackpot.imageUrl]}
            alt={jackpot.title}
            autoSlideInterval={5000}
            className="w-full h-full"
          />
          {/* Countdown Overlay */}
          {nextDrawDate && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-6 px-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-white font-medium">Next draw in:</p>
                <DrawCountdown targetDate={new Date(nextDrawDate)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Jackpot Details */}
      {jackpot && (
        <div className="space-y-4">
          <Badge variant="outline" className="text-sm py-1 px-3">
            <Trophy className="h-4 w-4 mr-2" />
            Current Jackpot
          </Badge>

          <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            {jackpot.title}
          </h2>

          {'description' in jackpot && jackpot.description && (
            <p className="text-lg text-muted-foreground">
              {jackpot.description}
            </p>
          )}
          {'estimatedValue' in jackpot && jackpot.estimatedValue && (
            <p className="text-lg text-muted-foreground">
              Estimated value: <span className="text-green-600 font-semibold">${(jackpot.estimatedValue / 1000).toLocaleString()} USD</span>
            </p>
          )}

          {'linkUrl' in jackpot && jackpot.linkUrl && (
            <Button
              variant="outline"
              onClick={() => window.open(jackpot.linkUrl, '_blank')}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Prize Details
            </Button>
          )}
        </div>
      )}

    </div>
  )
}