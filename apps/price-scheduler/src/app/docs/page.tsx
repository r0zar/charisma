'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import Link from 'next/link';

export default function UnifiedDocsPage() {
  return (
    <main className="flex min-h-screen flex-col p-8">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Price Service Documentation</h1>
          <p className="text-muted-foreground">Three-Engine Architecture • Comprehensive Price Discovery</p>
        </div>

        {/* Unified Documentation Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="readme">README</TabsTrigger>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    📖 README
                    <Badge variant="outline">User Guide</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Complete user guide covering setup, configuration, and usage examples for the three-engine price service architecture.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div>• Quick start and basic setup</div>
                    <div>• Engine configuration guides</div>
                    <div>• API reference and examples</div>
                    <div>• Migration and troubleshooting</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🏗️ ARCHITECTURE
                    <Badge variant="outline">Technical</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Technical architecture documentation covering the three-engine design, data flow, and implementation details.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div>• Directory structure and layers</div>
                    <div>• Engine coordination patterns</div>
                    <div>• Data flow and storage</div>
                    <div>• Deployment requirements</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Architecture Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Architecture Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 p-6 rounded-lg font-mono text-sm">
                  <pre>{`
┌─────────────────────────────────────────┐
│           Price Service                 │
│            Orchestrator                 │
├─────────────────────────────────────────┤
│  • Intelligent engine selection        │
│  • Arbitrage analysis                  │
│  • Caching & health monitoring         │
│  • Unified API interface               │
└─────────────┬───────────────────────────┘
              │
     ┌────────┼────────┐
     │        │        │
┌────▼───┐ ┌──▼──┐ ┌───▼────┐
│Oracle  │ │CPMM │ │Intrinsic│
│Engine  │ │Engine│ │ Engine │
└────────┘ └─────┘ └────────┘
                  `}</pre>
                </div>
              </CardContent>
            </Card>

            {/* Key Features */}
            <Card>
              <CardHeader>
                <CardTitle>Key Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">🔮 Oracle Engine</h3>
                    <p className="text-sm text-muted-foreground">
                      External market price feeds for BTC via Kraken and CoinGecko APIs
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">📊 CPMM Engine</h3>
                    <p className="text-sm text-muted-foreground">
                      Market price discovery through AMM pools and liquidity analysis
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">💎 Intrinsic Value Engine</h3>
                    <p className="text-sm text-muted-foreground">
                      Redeemable asset valuation for stablecoins, sBTC, and LP tokens
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="readme" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📖 README
                  <Badge variant="outline">User Guide</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MarkdownRenderer filePath="README.md" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="architecture" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🏗️ ARCHITECTURE
                  <Badge variant="outline">Technical</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MarkdownRenderer filePath="ARCHITECTURE.md" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Navigation */}
        <div className="flex justify-center gap-4">
          <Link href="/">
            <Button variant="outline">
              ← Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}