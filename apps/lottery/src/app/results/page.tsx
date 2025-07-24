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

async function getWinningTickets(drawId: string) {
  try {
    const response = await fetch(`/api/v1/lottery/results/${drawId}/tickets`)
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      // If the endpoint doesn't exist, return empty array
      return []
    }
    
    return result.data || []
  } catch (error) {
    console.error('Failed to get winning tickets:', error)
    return []
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
  const [winningTickets, setWinningTickets] = useState<Record<string, any[]>>({})
  const [expandedDraws, setExpandedDraws] = useState<Set<string>>(new Set())
  
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

  const loadWinningTickets = async (drawId: string) => {
    if (winningTickets[drawId]) return // Already loaded
    
    try {
      const tickets = await getWinningTickets(drawId)
      setWinningTickets(prev => ({ ...prev, [drawId]: tickets }))
    } catch (err) {
      console.error('Failed to load winning tickets for draw:', drawId, err)
    }
  }

  const toggleExpandDraw = (drawId: string) => {
    const newExpanded = new Set(expandedDraws)
    if (newExpanded.has(drawId)) {
      newExpanded.delete(drawId)
    } else {
      newExpanded.add(drawId)
      loadWinningTickets(drawId) // Load tickets when expanding
    }
    setExpandedDraws(newExpanded)
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
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <CardTitle className="text-lg font-mono">
                                Draw #{draw.id.split('-').pop()}
                              </CardTitle>
                              <CardDescription>
                                {new Date(draw.drawDate).toLocaleDateString()} at {new Date(draw.drawDate).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })} • {draw.totalTicketsSold} tickets sold
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {draw.winners.length > 0 && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                {draw.winners[0].winnerCount} Winner{draw.winners[0].winnerCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpandDraw(draw.id)}
                            >
                              {expandedDraws.has(draw.id) ? 'Hide Details' : 'View Details'}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Winning Numbers or Format Info */}
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-2">
                              {lotteryFormat === 'traditional' ? 'Winning Numbers' : 'Lottery Format'}
                            </div>
                            {lotteryFormat === 'traditional' ? (
                              <div className="flex gap-1 flex-wrap">
                                {draw.winningNumbers.map((number: number, index: number) => (
                                  <div
                                    key={index}
                                    className="w-8 h-8 rounded-full bg-yellow-500 text-white text-sm font-bold flex items-center justify-center"
                                  >
                                    {number}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm">
                                <Badge variant="secondary">Simple Random Draw</Badge>
                                <div className="text-xs text-muted-foreground mt-1">
                                  One random ticket selected as winner
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Prize Information */}
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-2">Prize</div>
                            <div>
                              {typeof draw.jackpotAmount === 'object' ? (
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">{draw.jackpotAmount.title}</div>
                                  {draw.jackpotAmount.estimatedValue && (
                                    <div className="text-xs text-muted-foreground">
                                      Est. ${(draw.jackpotAmount.estimatedValue / 1000).toLocaleString()} USD
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-0 h-auto text-xs"
                                    onClick={() => window.open(draw.jackpotAmount.linkUrl, '_blank')}
                                  >
                                    View Prize <ExternalLink className="h-3 w-3 ml-1" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-sm font-medium">
                                  {draw.jackpotAmount.toLocaleString()} STONE
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Winner Summary */}
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-2">Winner Status</div>
                            <div>
                              {draw.winners.length > 0 ? (
                                <div className="text-sm">
                                  <div className="font-medium text-green-600">
                                    {draw.winners[0].winnerCount} Winner{draw.winners[0].winnerCount !== 1 ? 's' : ''}
                                  </div>
                                  {lotteryFormat === 'traditional' && (
                                    <div className="text-xs text-muted-foreground">
                                      {draw.winners[0].matchCount} number matches
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  No winner this draw
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Details - Winner Addresses */}
                        {expandedDraws.has(draw.id) && (
                          <div className="mt-6 pt-4 border-t border-border/40">
                            <div className="text-sm font-medium text-muted-foreground mb-3">
                              Winner Details
                            </div>
                            {winningTickets[draw.id] ? (
                              winningTickets[draw.id].length > 0 ? (
                                <div className="space-y-2">
                                  {winningTickets[draw.id].map((ticket: any, index: number) => (
                                    <div key={ticket.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                      <div className="flex items-center gap-3">
                                        <Trophy className="h-4 w-4 text-green-600" />
                                        <div>
                                          <div className="font-mono text-sm">#{ticket.id.slice(-6)}</div>
                                          <div className="text-xs text-muted-foreground">Winning Ticket</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-right">
                                          <div className="font-mono text-sm">{ticket.walletAddress}</div>
                                          <div className="text-xs text-muted-foreground">Winner Address</div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => copyToClipboard(ticket.walletAddress)}
                                          className="p-1 h-auto"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  No winning tickets found for this draw
                                </div>
                              )
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                Loading winner details...
                              </div>
                            )}
                          </div>
                        )}
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