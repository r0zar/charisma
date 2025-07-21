"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, TestTube } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { listTokens, getTokenMetadataCached } from '@/lib/contract-registry-adapter'
import type { TokenCacheData } from '@/lib/contract-registry-adapter'

const TEST_TOKENS = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope',
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.brc20-db20'
]

export default function TestRegistryIntegrationPage() {
  const [allTokens, setAllTokens] = useState<TokenCacheData[]>([])
  const [singleToken, setSingleToken] = useState<TokenCacheData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testListTokens = async () => {
    setLoading(true)
    setError(null)
    try {
      const tokens = await listTokens()
      setAllTokens(tokens.slice(0, 10)) // Show first 10 tokens
      console.log('List tokens result:', tokens.length, 'tokens')
    } catch (err) {
      console.error('List tokens failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const testSingleToken = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getTokenMetadataCached(TEST_TOKENS[0])
      setSingleToken(token)
      console.log('Single token result:', token)
    } catch (err) {
      console.error('Single token failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Contract Registry Integration Test</h1>
          <p className="text-muted-foreground">
            Testing simple-swap with contract-registry adapter
          </p>
        </div>

        {error && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* List Tokens Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                List All Tokens
              </CardTitle>
              <CardDescription>
                Test fetching all tokens via contract-registry adapter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={testListTokens} disabled={loading} className="w-full">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Test List Tokens
              </Button>
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Results: {allTokens.length} tokens</div>
                {allTokens.slice(0, 5).map((token, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {token.contractId}
                      </div>
                    </div>
                    <Badge variant="outline">{token.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Single Token Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Single Token Lookup
              </CardTitle>
              <CardDescription>
                Test fetching individual token metadata
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={testSingleToken} disabled={loading} className="w-full">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Test Single Token
              </Button>
              
              {singleToken && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {singleToken.image && (
                      <img 
                        src={singleToken.image} 
                        alt={singleToken.symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    <div>
                      <div className="font-medium">{singleToken.symbol}</div>
                      <div className="text-sm text-muted-foreground">{singleToken.name}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Type: {singleToken.type}</div>
                    <div>Decimals: {singleToken.decimals}</div>
                    <div className="col-span-2 truncate">
                      Contract: {singleToken.contractId}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{allTokens.length}</div>
                <div className="text-sm text-muted-foreground">Tokens Loaded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {singleToken ? '✓' : '—'}
                </div>
                <div className="text-sm text-muted-foreground">Single Lookup</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {error ? '❌' : '✅'}
                </div>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {loading ? '⏳' : '🔁'}
                </div>
                <div className="text-sm text-muted-foreground">Loading</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}