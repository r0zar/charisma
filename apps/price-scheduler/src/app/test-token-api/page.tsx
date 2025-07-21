"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TokenInfo, TokenInfoCard } from '@/components/token-info'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, TestTube } from 'lucide-react'

const TEST_TOKENS = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope',
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.brc20-db20',
  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token'
]

export default function TestTokenApiPage() {
  const [testContract, setTestContract] = useState(TEST_TOKENS[0])
  const [bulkResults, setBulkResults] = useState<any>(null)
  const [singleResult, setSingleResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testSingleToken = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/tokens/metadata?contractId=${encodeURIComponent(testContract)}`)
      const result = await response.json()
      setSingleResult(result)
    } catch (error) {
      console.error('Single token test failed:', error)
      setSingleResult({ success: false, error: 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  const testBulkTokens = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/tokens/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contractIds: TEST_TOKENS })
      })
      const result = await response.json()
      setBulkResults(result)
    } catch (error) {
      console.error('Bulk token test failed:', error)
      setBulkResults({ success: false, error: 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Token API Integration Test
          </h1>
          <p className="text-muted-foreground">
            Test contract-registry integration for token metadata display
          </p>
        </div>

        {/* Single Token Test */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-primary" />
              Single Token Test
            </CardTitle>
            <CardDescription>
              Test fetching metadata for a single token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={testContract}
                onChange={(e) => setTestContract(e.target.value)}
                placeholder="Enter contract ID..."
                className="flex-1"
              />
              <Button onClick={testSingleToken} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Test
              </Button>
            </div>

            {/* Component Preview */}
            <div className="border rounded-lg p-4 bg-background/50">
              <div className="text-sm font-medium mb-3">Component Preview:</div>
              <TokenInfo contractId={testContract} showDetails={true} />
            </div>

            {/* API Response */}
            {singleResult && (
              <div className="border rounded-lg p-4 bg-background/50">
                <div className="text-sm font-medium mb-3 flex items-center gap-2">
                  API Response:
                  <Badge variant={singleResult.success ? "default" : "destructive"}>
                    {singleResult.success ? 'Success' : 'Error'}
                  </Badge>
                </div>
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {JSON.stringify(singleResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Test */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-primary" />
              Bulk Token Test
            </CardTitle>
            <CardDescription>
              Test fetching metadata for multiple tokens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testBulkTokens} disabled={loading} className="w-full">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Test {TEST_TOKENS.length} Tokens
            </Button>

            {/* Component Preview */}
            <div className="border rounded-lg p-4 bg-background/50">
              <div className="text-sm font-medium mb-3">Component Preview:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEST_TOKENS.slice(0, 2).map((contractId) => (
                  <TokenInfoCard
                    key={contractId}
                    contractId={contractId}
                    price={Math.random() * 10}
                    priceChange={(Math.random() - 0.5) * 20}
                    confidence={0.8 + Math.random() * 0.2}
                  />
                ))}
              </div>
            </div>

            {/* API Response */}
            {bulkResults && (
              <div className="border rounded-lg p-4 bg-background/50">
                <div className="text-sm font-medium mb-3 flex items-center gap-2">
                  API Response:
                  <Badge variant={bulkResults.success ? "default" : "destructive"}>
                    {bulkResults.success ? 'Success' : 'Error'}
                  </Badge>
                </div>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-96">
                  {JSON.stringify(bulkResults, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Results Summary */}
        {(singleResult || bulkResults) && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>Test Results Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Single Token API</div>
                  <Badge variant={singleResult?.success ? "default" : "outline"}>
                    {singleResult?.success ? 'Working' : 'Not Tested'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Bulk Token API</div>
                  <Badge variant={bulkResults?.success ? "default" : "outline"}>
                    {bulkResults?.success ? 'Working' : 'Not Tested'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Token Components</div>
                  <Badge variant="default">Rendered</Badge>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Contract Registry</div>
                  <Badge variant={singleResult?.success || bulkResults?.success ? "default" : "outline"}>
                    {singleResult?.success || bulkResults?.success ? 'Connected' : 'Unknown'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}