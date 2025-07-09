import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code, Database, Zap, Clock, CheckCircle, XCircle, Activity, ExternalLink, Copy } from 'lucide-react';
import Link from 'next/link';
import { ApiTester } from '@/components/ApiTester';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Database className="w-4 h-4" />
            API Documentation
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Transaction Monitor API
          </h1>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            A lightweight, queue-based service for monitoring transaction statuses on the Stacks blockchain. 
            Real-time status checks with automatic fallback to background monitoring.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/dashboard">
              <Button size="lg" className="w-full sm:w-auto">
                <Activity className="w-4 h-4 mr-2" />
                View Dashboard
              </Button>
            </Link>
            <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
              <a href="https://github.com/charisma-ai/tx-monitor" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                GitHub
              </a>
            </Button>
          </div>
        </div>

        {/* Quick Start */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Quick Start</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Get started with the Transaction Monitor API in seconds
          </p>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-3">1. Add transactions to the monitoring queue</h3>
              <div className="bg-muted border rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm"><code>{`curl -X POST https://tx-monitor.charisma.ai/api/v1/queue/add \\
  -H "Content-Type: application/json" \\
  -d '{"txids": ["0x123abc..."]}'`}</code></pre>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3">2. Check transaction status in real-time</h3>
              <div className="bg-muted border rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm"><code>{`curl https://tx-monitor.charisma.ai/api/v1/status/0x123abc...`}</code></pre>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3">3. Monitor queue statistics</h3>
              <div className="bg-muted border rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm"><code>{`curl https://tx-monitor.charisma.ai/api/v1/queue/stats`}</code></pre>
              </div>
            </div>
          </div>
        </section>

        {/* API Endpoints */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Code className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">API Endpoints</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            All endpoints are available under the <code className="bg-muted px-2 py-1 rounded text-sm">/api/v1</code> namespace
          </p>

          <div className="space-y-12">
            {/* Queue Management */}
            <div>
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Queue Management
              </h3>
              
              <div className="space-y-8">
                <div className="border rounded-lg p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                    <Badge variant="outline" className="w-fit">POST</Badge>
                    <code className="text-sm bg-muted px-2 py-1 rounded">/api/v1/queue/add</code>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Add one or more transaction IDs to the monitoring queue
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Request Body:</h4>
                      <div className="bg-muted border rounded p-4 overflow-x-auto">
                        <pre className="text-sm"><code>{`{
  "txids": ["0x123abc...", "0x456def..."]
}`}</code></pre>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                    <Badge variant="outline" className="w-fit">GET</Badge>
                    <code className="text-sm bg-muted px-2 py-1 rounded">/api/v1/queue/stats</code>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Get queue statistics and health metrics
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Response:</h4>
                      <div className="bg-muted border rounded p-4 overflow-x-auto">
                        <pre className="text-sm"><code>{`{
  "queueSize": 15,
  "processingHealth": "healthy",
  "totalProcessed": 247,
  "totalSuccessful": 232,
  "totalFailed": 15
}`}</code></pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Status */}
            <div>
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Transaction Status
              </h3>
              
              <div className="border rounded-lg p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                  <Badge variant="outline" className="w-fit">GET</Badge>
                  <code className="text-sm bg-muted px-2 py-1 rounded">/api/v1/status/{`{txid}`}</code>
                </div>
                <p className="text-muted-foreground mb-4">
                  Get real-time transaction status. Waits up to 30 seconds for confirmation if not cached. 
                  Returns 404 if transaction not found after timeout (likely never broadcasted).
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Response:</h4>
                    <div className="bg-muted border rounded p-4 overflow-x-auto">
                      <pre className="text-sm"><code>{`{
  "txid": "0x123abc...",
  "status": "success",
  "blockHeight": 142847,
  "blockTime": 1703123456,
  "fromCache": false,
  "checkedAt": 1703123500000
}`}</code></pre>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Cache Headers:</h4>
                    <div className="bg-muted border rounded p-4 overflow-x-auto">
                      <pre className="text-sm"><code>{`Cache-Control: public, max-age=3600, stale-while-revalidate=86400
ETag: "success-1703123500000"
X-Cache-Status: HIT`}</code></pre>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Error Response (404):</h4>
                    <div className="bg-muted border rounded p-4 overflow-x-auto">
                      <pre className="text-sm"><code>{`{
  "success": false,
  "error": "Transaction not found",
  "message": "Transaction ID not found on blockchain"
}`}</code></pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Caching Strategy */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Caching Strategy</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Intelligent HTTP caching to optimize performance and reduce blockchain API calls
          </p>
          
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold">Confirmed Transactions</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Immutable data cached for maximum efficiency
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Cache TTL:</span>
                  <code className="bg-muted px-2 py-1 rounded">1 hour</code>
                </div>
                <div className="flex justify-between">
                  <span>Stale while revalidate:</span>
                  <code className="bg-muted px-2 py-1 rounded">24 hours</code>
                </div>
                <div className="flex justify-between">
                  <span>ETag support:</span>
                  <code className="bg-muted px-2 py-1 rounded">Yes</code>
                </div>
              </div>
            </div>
            
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold">Pending Transactions</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Frequently changing data with short cache times
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Cache TTL:</span>
                  <code className="bg-muted px-2 py-1 rounded">30 seconds</code>
                </div>
                <div className="flex justify-between">
                  <span>Stale while revalidate:</span>
                  <code className="bg-muted px-2 py-1 rounded">5 minutes</code>
                </div>
                <div className="flex justify-between">
                  <span>Must revalidate:</span>
                  <code className="bg-muted px-2 py-1 rounded">Yes</code>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Transaction Statuses */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Code className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Transaction Statuses</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Understanding the different transaction states
          </p>
          
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <code className="text-sm bg-muted px-2 py-1 rounded">success</code>
              </div>
              <p className="text-muted-foreground">
                Transaction successfully confirmed on the blockchain
              </p>
            </div>
            
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <XCircle className="w-5 h-5 text-red-500" />
                <code className="text-sm bg-muted px-2 py-1 rounded">abort_by_response</code>
              </div>
              <p className="text-muted-foreground">
                Transaction failed due to contract execution error
              </p>
            </div>
            
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <XCircle className="w-5 h-5 text-red-500" />
                <code className="text-sm bg-muted px-2 py-1 rounded">abort_by_post_condition</code>
              </div>
              <p className="text-muted-foreground">
                Transaction failed due to post-condition check failure
              </p>
            </div>
            
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="w-5 h-5 text-yellow-500" />
                <code className="text-sm bg-muted px-2 py-1 rounded">pending</code>
              </div>
              <p className="text-muted-foreground">
                Transaction is still being processed by the network
              </p>
            </div>
            
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <XCircle className="w-5 h-5 text-gray-500" />
                <code className="text-sm bg-muted px-2 py-1 rounded">not_found</code>
              </div>
              <p className="text-muted-foreground">
                Transaction not found after 30 seconds - likely never broadcasted
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Key Features</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Why choose Transaction Monitor for your blockchain monitoring needs
          </p>

          <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <div className="border rounded-lg p-6">
              <Zap className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-3">Real-time Monitoring</h3>
              <p className="text-muted-foreground">
                Get instant status updates with 30-second real-time checks. Automatic fallback to background monitoring for pending transactions.
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <Database className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-3">Queue-based Processing</h3>
              <p className="text-muted-foreground">
                Efficient queue management with automatic cleanup. Handles thousands of transactions with minimal resource usage.
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <Activity className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-3">Smart Caching</h3>
              <p className="text-muted-foreground">
                Intelligent HTTP caching based on transaction status. Confirmed transactions cached for 1 hour, pending for 30 seconds.
              </p>
            </div>
          </div>
        </section>

        {/* Integration Examples */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Code className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Integration Examples</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Common patterns for integrating with the Transaction Monitor API
          </p>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">JavaScript/TypeScript</h3>
              <div className="bg-muted border rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm"><code>{`async function monitorTransaction(txid: string) {
  // Add to queue for monitoring
  await fetch('/api/v1/queue/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txids: [txid] })
  });

  // Check status immediately
  const response = await fetch(\`/api/v1/status/\${txid}\`);
  const { data } = await response.json();
  
  return data.status; // 'success', 'pending', etc.
}`}</code></pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Python</h3>
              <div className="bg-muted border rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm"><code>{`import requests

def monitor_transaction(txid):
    # Add to queue
    requests.post('/api/v1/queue/add', 
                  json={'txids': [txid]})
    
    # Check status
    response = requests.get(f'/api/v1/status/{txid}')
    return response.json()['data']['status']`}</code></pre>
              </div>
            </div>
          </div>
        </section>

        {/* API Tester */}
        <ApiTester />
      </div>
  );
}