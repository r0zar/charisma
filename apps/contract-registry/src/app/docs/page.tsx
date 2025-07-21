"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Copy, ExternalLink, Package, Server, Code2, Database, Search, Activity } from "lucide-react"
import { useState } from "react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  children: string
  language?: string
  title?: string
}

function CodeBlock({ children, language = "typescript", title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      {title && (
        <div className="flex items-center justify-between bg-muted px-4 py-2 rounded-t-md border-b border-foreground/10">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <Badge variant="outline" className="text-xs">
            {language}
          </Badge>
        </div>
      )}
      <div className="relative">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            borderRadius: title ? '0 0 0.375rem 0.375rem' : '0.375rem',
            fontSize: '0.875rem',
            lineHeight: '1.25rem',
          }}
          showLineNumbers={language !== 'bash'}
        >
          {children}
        </SyntaxHighlighter>
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-2 right-2 h-8 w-8 p-0 text-slate-400 hover:text-slate-50"
          onClick={copyToClipboard}
        >
          <Copy className="h-4 w-4" />
          <span className="sr-only">Copy code</span>
        </Button>
        {copied && (
          <div className="absolute top-2 right-12 bg-green-500 text-white px-2 py-1 rounded text-xs">
            Copied!
          </div>
        )}
      </div>
    </div>
  )
}

function ApiEndpointCard({ method, endpoint, description, example }: {
  method: "GET" | "POST" | "PUT" | "DELETE"
  endpoint: string
  description: string
  example?: string
}) {
  const methodColors = {
    GET: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    POST: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    PUT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Badge className={methodColors[method]} variant="secondary">
            {method}
          </Badge>
          <code className="text-sm bg-muted px-2 py-1 rounded">{endpoint}</code>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {example && (
        <CardContent>
          <CodeBlock language="bash" title="Example Request">
            {example}
          </CodeBlock>
        </CardContent>
      )}
    </Card>
  )
}

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Contract Registry Documentation</h1>
        <p className="text-muted-foreground text-lg">
          Learn how to use the contract registry service via API endpoints and as an internal package.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="api">API Endpoints</TabsTrigger>
          <TabsTrigger value="package">Internal Package</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                What is Contract Registry?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                The Contract Registry is a comprehensive service for managing Stacks blockchain contracts with
                trait-aware capabilities. It provides contract discovery, analysis, storage, and fast lookups.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      API Service
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      RESTful API endpoints for external applications to interact with the registry.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Internal Package
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Direct TypeScript/JavaScript integration for workspace applications.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Key Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Contract Management</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Add, update, and remove contracts</li>
                    <li>• Bulk operations support</li>
                    <li>• Health checks and statistics</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Trait Analysis</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• SIP-010 token detection</li>
                    <li>• SIP-069 NFT analysis</li>
                    <li>• Custom trait validation</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Storage & Search</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Blob storage with compression</li>
                    <li>• Fast KV index lookups</li>
                    <li>• Trait-based discovery</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Monitoring</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Real-time health status</li>
                    <li>• Storage usage metrics</li>
                    <li>• Performance analytics</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                API Endpoints
              </CardTitle>
              <CardDescription>
                RESTful API endpoints for interacting with the contract registry service.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Statistics & Health</h3>

            <ApiEndpointCard
              method="GET"
              endpoint="/api/stats"
              description="Get comprehensive registry statistics including storage, discovery, and health metrics."
              example={`curl -X GET "http://localhost:3600/api/stats" \\
  -H "Accept: application/json"`}
            />

            <ApiEndpointCard
              method="GET"
              endpoint="/api/stats?type=registry"
              description="Get only registry-specific statistics (contract counts, types, validation status)."
              example={`curl -X GET "http://localhost:3600/api/stats?type=registry" \\
  -H "Accept: application/json"`}
            />

            <ApiEndpointCard
              method="GET"
              endpoint="/api/stats?type=storage"
              description="Get storage metrics including blob usage, compression ratios, and cache performance."
              example={`curl -X GET "http://localhost:3600/api/stats?type=storage" \\
  -H "Accept: application/json"`}
            />

            <ApiEndpointCard
              method="GET"
              endpoint="/api/stats?type=health"
              description="Get service health status, response times, and error rates."
              example={`curl -X GET "http://localhost:3600/api/stats?type=health" \\
  -H "Accept: application/json"`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Response Format</CardTitle>
              <CardDescription>
                All API endpoints return JSON with consistent error handling.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock language="typescript" title="Success Response">
                {`{
  "registry": {
    "totalContracts": 61,
    "contractsByType": {
      "token": 0,
      "nft": 0,
      "vault": 0,
      "unknown": 0
    },
    "validationStatus": {
      "valid": 0,
      "invalid": 0,
      "blocked": 0,
      "pending": 0
    },
    "recentAdditions": 0
  },
  "storage": {
    "blobStorage": {
      "totalSize": 1117192,
      "totalContracts": 61,
      "averageSize": 18315,
      "largestContract": {
        "contractId": "SP1ABC...vault",
        "size": 63552
      },
      "compressionRatio": 0.3
    }
  },
  "health": {
    "status": "healthy",
    "apiResponseTime": 525,
    "errorRate": 0
  }
}`}
              </CodeBlock>

              <CodeBlock language="typescript" title="Error Response (HTTP 500)">
                {`{
  "error": true,
  "message": "Service temporarily unavailable",
  "timestamp": 1640995200000,
  "responseTime": 150
}`}
              </CodeBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="package" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Internal Package Usage
              </CardTitle>
              <CardDescription>
                Use the contract registry directly in your TypeScript/JavaScript applications.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Installation</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock language="bash" title="Add to package.json">
                {`{
  "dependencies": {
    "@services/contract-registry": "workspace:*"
  }
}`}
              </CodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Basic Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock language="typescript" title="Initialize Registry">
                {`import { ContractRegistry } from '@services/contract-registry';

const registry = new ContractRegistry({
  serviceName: 'my-app',
  blobStoragePrefix: 'contracts/',
  indexTTL: 3600,
  enableAnalysis: true,
  enableDiscovery: true,
  analysisTimeout: 30000,
  blobStorage: {},
  indexManager: {},
  traitAnalyzer: {},
  discoveryEngine: {}
});`}
              </CodeBlock>

              <CodeBlock language="typescript" title="Get Statistics">
                {`// Get comprehensive stats
const stats = await registry.getStats();
console.log('Total contracts:', stats.totalContracts);
console.log('Token contracts:', stats.contractsByType.token);

// Check service health
const health = await registry.getHealth();
console.log('Service healthy:', health.healthy);`}
              </CodeBlock>

              <CodeBlock language="typescript" title="Contract Operations">
                {`// Add a contract
const result = await registry.addContract(
  'SP1ABC123DEF456.my-token'
);

if (result.success) {
  console.log('Contract added:', result.contractId);
  console.log('Analysis completed:', result.wasAnalyzed);
}

// Get contract metadata
const contract = await registry.getContract(
  'SP1ABC123DEF456.my-token'
);

if (contract) {
  console.log('Contract type:', contract.contractType);
  console.log('Implemented traits:', contract.implementedTraits);
}`}
              </CodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock language="typescript" title="Bulk Operations">
                {`// Add multiple contracts
const contractIds = [
  'SP1ABC123.token-a',
  'SP2DEF456.token-b',
  'SP3GHI789.nft-collection'
];

const bulkResult = await registry.addContracts(contractIds);
console.log('Success count:', bulkResult.successful);
console.log('Failed count:', bulkResult.failed);
console.log('Failed contracts:', bulkResult.failedContracts);`}
              </CodeBlock>

              <CodeBlock language="typescript" title="Search by Traits">
                {`// Search for SIP-010 tokens
const tokenContracts = await registry.searchContracts({
  traits: ['SIP010'],
  limit: 50
});

console.log('Found tokens:', tokenContracts.contracts.length);

// Search by contract type
const nftContracts = await registry.searchContracts({
  contractType: 'nft',
  limit: 25
});`}
              </CodeBlock>

              <CodeBlock language="typescript" title="Storage Statistics">
                {`// Get detailed storage info
const storageStats = await registry.getStorageStats();

console.log('Blob storage used:', storageStats.blobStorage.totalSize);
console.log('Average contract size:', storageStats.blobStorage.averageSize);
console.log('Compression ratio:', storageStats.blobStorage.compressionRatio);

// Monitor cache performance
const indexStats = await registry.getIndexStats();
console.log('Cache hit rate:', indexStats.hitRate);`}
              </CodeBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="examples" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Common Use Cases
              </CardTitle>
              <CardDescription>
                Real-world examples of using the contract registry service.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example 1: Token Registry Dashboard</CardTitle>
              <CardDescription>
                Build a dashboard showing all SIP-010 tokens in the registry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock language="typescript" title="Token Dashboard Component">
                {`import { useEffect, useState } from 'react';
import { ContractRegistry } from '@services/contract-registry';

export function TokenDashboard() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTokens() {
      const registry = new ContractRegistry({
        serviceName: 'token-dashboard',
        // ... config
      });

      try {
        const results = await registry.searchContracts({
          traits: ['SIP010'],
          limit: 100
        });
        
        setTokens(results.contracts);
      } catch (error) {
        console.error('Failed to load tokens:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTokens();
  }, []);

  if (loading) return <div>Loading tokens...</div>;

  return (
    <div>
      <h2>SIP-010 Tokens ({tokens.length})</h2>
      {tokens.map(token => (
        <div key={token.contractId}>
          <h3>{token.contractName}</h3>
          <p>Address: {token.contractAddress}</p>
          <p>Deployed: {new Date(token.deployedAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}`}
              </CodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example 2: Contract Analysis Service</CardTitle>
              <CardDescription>
                Analyze and categorize newly deployed contracts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock language="typescript" title="Contract Analyzer">
                {`import { ContractRegistry } from '@services/contract-registry';

export class ContractAnalyzer {
  private registry: ContractRegistry;

  constructor() {
    this.registry = new ContractRegistry({
      serviceName: 'contract-analyzer',
      enableAnalysis: true,
      enableDiscovery: true,
      // ... config
    });
  }

  async analyzeNewContract(contractId: string) {
    try {
      // Add contract with full analysis
      const result = await this.registry.addContract(contractId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add contract');
      }

      const contract = result.metadata;
      
      // Categorize based on traits
      const category = this.categorizeContract(contract);
      
      // Log analysis results
      console.log(\`Contract Analysis: \${contractId}\`);
      console.log(\`Type: \${contract.contractType}\`);
      console.log(\`Traits: \${contract.implementedTraits.join(', ')}\`);
      console.log(\`Category: \${category}\`);
      
      return {
        contractId,
        type: contract.contractType,
        traits: contract.implementedTraits,
        category,
        sourceSize: contract.sourceCode.length
      };
      
    } catch (error) {
      console.error(\`Analysis failed for \${contractId}:\`, error);
      throw error;
    }
  }

  private categorizeContract(contract: any): string {
    if (contract.implementedTraits.includes('SIP010')) {
      return 'Fungible Token';
    }
    if (contract.implementedTraits.includes('SIP069')) {
      return 'Non-Fungible Token';
    }
    if (contract.contractType === 'vault') {
      return 'DeFi Vault';
    }
    return 'Other Contract';
  }

  async getAnalysisStats() {
    const stats = await this.registry.getStats();
    
    return {
      totalAnalyzed: stats.totalContracts,
      typeBreakdown: stats.contractsByType,
      validationStatus: stats.contractsByStatus,
      avgAnalysisTime: stats.averageAnalysisTime
    };
  }
}`}
              </CodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example 3: Health Monitoring</CardTitle>
              <CardDescription>
                Monitor registry service health and performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock language="typescript" title="Health Monitor">
                {`import { ContractRegistry } from '@services/contract-registry';

export class RegistryHealthMonitor {
  private registry: ContractRegistry;
  private alertThresholds = {
    responseTime: 5000, // 5 seconds
    errorRate: 0.1,     // 10%
    storageUsage: 0.8   // 80%
  };

  constructor() {
    this.registry = new ContractRegistry({
      serviceName: 'health-monitor',
      // ... config
    });
  }

  async checkHealth(): Promise<HealthReport> {
    const [health, stats, storageStats] = await Promise.all([
      this.registry.getHealth(),
      this.registry.getStats(),
      this.registry.getStorageStats()
    ]);

    const report: HealthReport = {
      timestamp: Date.now(),
      healthy: health.healthy,
      alerts: []
    };

    // Check response time
    if (health.responseTime > this.alertThresholds.responseTime) {
      report.alerts.push({
        type: 'performance',
        message: \`High response time: \${health.responseTime}ms\`
      });
    }

    // Check error rate  
    if (health.errorRate > this.alertThresholds.errorRate) {
      report.alerts.push({
        type: 'reliability',
        message: \`High error rate: \${(health.errorRate * 100).toFixed(1)}%\`
      });
    }

    // Check storage usage
    const storageUsage = storageStats.blobStorage.totalSize / (512 * 1024 * 1024);
    if (storageUsage > this.alertThresholds.storageUsage) {
      report.alerts.push({
        type: 'capacity',
        message: \`High storage usage: \${(storageUsage * 100).toFixed(1)}%\`
      });
    }

    return report;
  }

  async monitorContinuously(intervalMs: number = 60000) {
    setInterval(async () => {
      try {
        const report = await this.checkHealth();
        
        if (report.alerts.length > 0) {
          console.warn('Registry Health Alerts:', report.alerts);
          // Send to alerting system
          await this.sendAlerts(report.alerts);
        } else {
          console.log('Registry health: OK');
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, intervalMs);
  }

  private async sendAlerts(alerts: Alert[]) {
    // Implementation for your alerting system
    // (email, Slack, PagerDuty, etc.)
  }
}

interface HealthReport {
  timestamp: number;
  healthy: boolean;
  alerts: Alert[];
}

interface Alert {
  type: 'performance' | 'reliability' | 'capacity';
  message: string;
}`}
              </CodeBlock>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}