"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"
import { Footer } from "@/components/footer"

async function getLatestWinningNumbers() {
  try {
    const response = await fetch('/api/v1/lottery/latest-result')
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch latest results')
    }
    
    return result.data
  } catch (error) {
    console.error('Failed to get latest winning numbers:', error)
    throw new Error('Lottery drawing data not available. Please connect to the blockchain lottery contract to fetch the latest winning numbers.')
  }
}

async function getPastDraws() {
  try {
    const response = await fetch('/api/v1/lottery/results?limit=10')
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch past draws')
    }
    
    return result.data
  } catch (error) {
    console.error('Failed to get past draws:', error)
    throw new Error('Historical lottery data not available. Please connect to the blockchain lottery contract to fetch past drawing results.')
  }
}

export default function ResultsPage() {
  const [error, setError] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<any>(null)
  const [pastDraws, setPastDraws] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchResults = async () => {
    setLoading(true)
    setError(null)

    try {
      const [latest, past] = await Promise.all([
        getLatestWinningNumbers(),
        getPastDraws()
      ])
      setLatestResult(latest)
      setPastDraws(past)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lottery results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mounted) {
      fetchResults()
    }
  }, [mounted])

  const handleRetry = () => {
    fetchResults()
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="container mx-auto p-6 space-y-8 flex-1">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
              <Trophy className="h-10 w-10 text-primary" />
              Lottery Results
            </h1>
            <p className="text-muted-foreground text-lg">
              Latest draw results and historical data
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Loading Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="text-muted-foreground">Loading lottery results...</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="container mx-auto p-6 space-y-8 flex-1">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
              <Trophy className="h-10 w-10 text-primary" />
              Lottery Results
            </h1>
            <p className="text-muted-foreground text-lg">
              Latest draw results and historical data
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="border-destructive/20">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-destructive">
                  <Trophy className="h-5 w-5" />
                  Results Unavailable
                </CardTitle>
                <CardDescription>
                  Unable to load lottery drawing data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 space-y-4">
                  <div className="text-muted-foreground">
                    {error}
                  </div>
                  <Button variant="outline" onClick={handleRetry} size="lg">
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto p-6 space-y-8 flex-1">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <Trophy className="h-10 w-10 text-primary" />
            Lottery Results
          </h1>
          <p className="text-muted-foreground text-lg">
            Latest draw results and historical data
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Lottery Results ({pastDraws.length})
              </CardTitle>
              <CardDescription>
                Recent lottery draw results and winners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Compact List Header */}
                <div className="grid grid-cols-12 gap-4 px-3 py-2 text-sm font-medium text-muted-foreground border-b">
                  <div className="col-span-2">Draw</div>
                  <div className="col-span-4">Winning Numbers</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Winner</div>
                  <div className="col-span-2">Prize</div>
                </div>
                
                {/* Compact Results List */}
                {pastDraws.map((draw: any) => (
                  <div key={draw.id} className="grid grid-cols-12 gap-4 px-3 py-3 hover:bg-muted/50 rounded-lg border-b border-border/20">
                    {/* Draw ID */}
                    <div className="col-span-2">
                      <div className="font-mono text-sm">
                        #{draw.id.split('-').pop()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {draw.totalTicketsSold} tickets
                      </div>
                    </div>
                    
                    {/* Winning Numbers */}
                    <div className="col-span-4">
                      <div className="flex gap-1">
                        {draw.winningNumbers.map((number: number, index: number) => (
                          <div
                            key={index}
                            className="w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center"
                          >
                            {number}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Date */}
                    <div className="col-span-2">
                      <div className="text-sm">
                        {new Date(draw.drawDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(draw.drawDate).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                    
                    {/* Winner Info */}
                    <div className="col-span-2">
                      {draw.winners.length > 0 ? (
                        <div>
                          <div className="text-sm font-medium text-green-600">
                            {draw.winners[0].winnerCount} Winner{draw.winners[0].winnerCount !== 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            6 matches
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No winner
                        </div>
                      )}
                    </div>
                    
                    {/* Prize Amount */}
                    <div className="col-span-2">
                      {draw.winners.length > 0 ? (
                        <div>
                          <div className="text-sm font-medium">
                            {draw.winners[0].prizePerWinner.toLocaleString()} STONE
                          </div>
                          <div className="text-xs text-muted-foreground">
                            per winner
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {draw.jackpotAmount.toLocaleString()} STONE
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                <div className="text-center pt-4">
                  <Button variant="outline" onClick={handleRetry}>
                    Refresh Results
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}