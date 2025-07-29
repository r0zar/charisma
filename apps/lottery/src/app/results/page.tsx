"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trophy, ExternalLink, Copy } from "lucide-react"
import { Footer } from "@/components/footer"
import { getLotteryFormat } from "@/types/lottery"

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


function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

export default function ResultsPage() {
  const [error, setError] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<any>(null)
  const [pastDraws, setPastDraws] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Get lottery format
  const lotteryFormat = getLotteryFormat()

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
              <div className="space-y-4">
                {pastDraws.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No lottery draws found
                  </div>
                ) : (
                  pastDraws.map((draw: any) => (
                    <Card key={draw.id} className="border-border/40">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-2xl font-mono font-bold">
                              Draw #{draw.id}
                            </CardTitle>
                            <CardDescription className="text-base mt-1">
                              {new Date(draw.drawDate).toLocaleDateString()} at {new Date(draw.drawDate).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })} • {draw.totalTicketsSold} tickets sold
                            </CardDescription>
                          </div>
                          {draw.winners.length > 0 && (
                            <Badge variant="default" className="bg-green-100 text-green-800 text-lg py-2 px-4">
                              🏆 {draw.winners[0].winnerCount} Winner{draw.winners[0].winnerCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0 space-y-6">
                        {/* Prize Information - Always Visible */}
                        <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-primary mb-3">🎁 Prize Won</h3>
                          {typeof draw.jackpotAmount === 'object' ? (
                            <div className="space-y-3">
                              <div className="text-xl font-bold">{draw.jackpotAmount.title}</div>
                              {draw.jackpotAmount.estimatedValue && (
                                <div className="text-lg text-green-600 font-semibold">
                                  Estimated Value: ${(draw.jackpotAmount.estimatedValue / 1000).toLocaleString()} USD
                                </div>
                              )}
                              <Button
                                variant="outline"
                                size="lg"
                                className="mt-2"
                                onClick={() => window.open(draw.jackpotAmount.linkUrl, '_blank')}
                              >
                                View Prize Details <ExternalLink className="h-4 w-4 ml-2" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-xl font-bold">
                              {draw.jackpotAmount.toLocaleString()} STONE
                            </div>
                          )}
                        </div>

                        {/* Winner Information - Always Visible and Prominent */}
                        {draw.winners.length > 0 ? (
                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-green-800 mb-4">🏆 Winner Information</h3>
                            
                            {draw.winnerWalletAddress ? (
                              <div className="space-y-4">
                                <div>
                                  <div className="text-sm font-medium text-green-700 mb-2">STX Wallet Address:</div>
                                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                                    <span className="font-mono text-lg font-bold text-green-800 break-all">
                                      {draw.winnerWalletAddress}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => copyToClipboard(draw.winnerWalletAddress!)}
                                      className="flex-shrink-0"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                
                                {draw.winningTicketId && (
                                  <div>
                                    <div className="text-sm font-medium text-green-700 mb-2">Winning Ticket:</div>
                                    <div className="font-mono text-xl font-bold text-green-800">
                                      #{draw.winningTicketId}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-green-700">
                                {draw.winners[0].winnerCount} Winner{draw.winners[0].winnerCount !== 1 ? 's' : ''} Selected
                                {lotteryFormat === 'traditional' && (
                                  <div className="text-sm text-green-600 mt-1">
                                    {draw.winners[0].matchCount} number matches
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 text-center">
                            <div className="text-lg font-semibold text-gray-600">No Winner This Draw</div>
                            <div className="text-sm text-gray-500 mt-1">Prize rolls over to next draw</div>
                          </div>
                        )}

                        {/* Lottery Format Info */}
                        <div className="text-center pt-2 border-t border-border/20">
                          {lotteryFormat === 'traditional' ? (
                            <div>
                              <div className="text-sm font-medium text-muted-foreground mb-2">Winning Numbers</div>
                              <div className="flex gap-2 justify-center flex-wrap">
                                {draw.winningNumbers.map((number: number, index: number) => (
                                  <div
                                    key={index}
                                    className="w-10 h-10 rounded-full bg-yellow-500 text-white font-bold flex items-center justify-center"
                                  >
                                    {number}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Badge variant="secondary" className="text-base py-1 px-3">
                                Simple Random Draw
                              </Badge>
                              <div className="text-sm text-muted-foreground mt-1">
                                One random ticket selected as winner
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}

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