import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft, 
  Calendar, 
  Tag, 
  Shield, 
  Code, 
  Database, 
  ExternalLink,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react"
import { getContractRegistry } from "@/lib/contract-registry"
import type { ContractMetadata } from "@/lib/contract-registry"
import { TokenImage } from "@/components/TokenImage"
import { CodeDisplay } from "./CodeDisplay"
import { CopyButton } from "./CopyButton"

interface ContractDetailPageProps {
  params: Promise<{
    id: string
  }>
}

function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'valid':
        return { 
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          icon: CheckCircle
        }
      case 'pending':
        return { 
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          icon: Clock
        }
      case 'invalid':
        return { 
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
          icon: XCircle
        }
      case 'blocked':
        return { 
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
          icon: AlertTriangle
        }
      default:
        return { 
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
          icon: Shield
        }
    }
  }

  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <Badge className={config.color} variant="secondary">
      <Icon className="h-3 w-3 mr-1" />
      {status.toUpperCase()}
    </Badge>
  )
}

function TypeBadge({ type }: { type: string }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'token': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'nft': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'vault': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <Badge className={getTypeColor(type)} variant="secondary">
      {type.toUpperCase()}
    </Badge>
  )
}

async function getContract(contractId: string): Promise<ContractMetadata | null> {
  try {
    const registry = getContractRegistry()
    const contract = await registry.getContract(contractId)
    return contract
  } catch (error) {
    console.error('Failed to fetch contract:', error)
    return null
  }
}

export default async function ContractDetailPage({ params }: ContractDetailPageProps) {
  const { id } = await params
  const contractId = decodeURIComponent(id)
  const contract = await getContract(contractId)

  if (!contract) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <Button variant="ghost" asChild className="mb-6 hover:bg-primary/5">
            <Link href="/contracts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contracts
            </Link>
          </Button>

          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  {/* Token Image or Contract Icon */}
                  <TokenImage contract={contract} size={64} className="p-4 rounded-2xl" />
                  <div>
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      {contract.contractName || contract.contractId.split('.')[1] || 'Contract Details'}
                    </h1>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono">
                      <span className="break-all">{contract.contractId}</span>
                      <CopyButton text={contract.contractId} label="contract ID" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <TypeBadge type={contract.contractType} />
                <StatusBadge status={contract.validationStatus} />
              </div>
            </div>
            
            {contract.implementedTraits && contract.implementedTraits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contract.implementedTraits.map((trait) => (
                  <Badge key={trait} variant="outline" className="bg-card/50 backdrop-blur-sm border-border/50">
                    <Tag className="h-3 w-3 mr-1" />
                    {trait}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {contract.sourceCode && <TabsTrigger value="source">Source Code</TabsTrigger>}
              {contract.abi && <TabsTrigger value="abi">ABI</TabsTrigger>}
              {contract.tokenMetadata && <TabsTrigger value="token">Token Info</TabsTrigger>}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Database className="h-6 w-6 text-primary" />
                    Contract Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground">Contract Address</label>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted/50 border border-border/50 px-3 py-2 rounded-lg break-all font-mono">
                          {contract.contractAddress}
                        </code>
                        <CopyButton text={contract.contractAddress} label="address" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground">Contract Type</label>
                      <div className="mt-1">
                        <TypeBadge type={contract.contractType} />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground">Discovery Date</label>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{new Date(contract.discoveredAt).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground">Discovery Method</label>
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
                        <p className="text-sm font-medium capitalize">{contract.discoveryMethod?.replace('-', ' ')}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground">Validation Status</label>
                      <div className="mt-1">
                        <StatusBadge status={contract.validationStatus} />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground">Last Updated</label>
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
                        <p className="text-sm font-medium">{new Date(contract.lastUpdated).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {contract.sourceCode && (
              <TabsContent value="source">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      Source Code
                    </CardTitle>
                    <CardDescription>
                      Complete source code for this contract
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CodeDisplay 
                      code={contract.sourceCode} 
                      language="lisp"
                      showLineNumbers={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {contract.abi && (
              <TabsContent value="abi">
                <Card>
                  <CardHeader>
                    <CardTitle>Application Binary Interface (ABI)</CardTitle>
                    <CardDescription>
                      Contract functions and data structures
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CodeDisplay 
                      code={(() => {
                        try {
                          // If it's a string, try to parse it as JSON and re-format
                          if (typeof contract.abi === 'string') {
                            const parsed = JSON.parse(contract.abi)
                            return JSON.stringify(parsed, null, 2)
                          }
                          // If it's already an object, just stringify with formatting
                          return JSON.stringify(contract.abi, null, 2)
                        } catch (error) {
                          // If parsing fails, return the original string
                          return typeof contract.abi === 'string' ? contract.abi : JSON.stringify(contract.abi, null, 2)
                        }
                      })()}
                      language="json"
                      showLineNumbers={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {contract.tokenMetadata && (
              <TabsContent value="token">
                <Card>
                  <CardHeader>
                    <CardTitle>Token Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CodeDisplay 
                      code={(() => {
                        try {
                          // Ensure proper JSON formatting
                          if (typeof contract.tokenMetadata === 'string') {
                            const parsed = JSON.parse(contract.tokenMetadata)
                            return JSON.stringify(parsed, null, 2)
                          }
                          return JSON.stringify(contract.tokenMetadata, null, 2)
                        } catch (error) {
                          return typeof contract.tokenMetadata === 'string' ? contract.tokenMetadata : JSON.stringify(contract.tokenMetadata, null, 2)
                        }
                      })()}
                      language="json"
                      showLineNumbers={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild variant="outline" className="w-full justify-start h-11 rounded-xl border-border/50 bg-card/30 hover:bg-card/60">
                <Link href={`https://explorer.stacks.co/txid/${contract.contractId}?chain=mainnet`} target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Explorer
                </Link>
              </Button>
              
              <CopyButton 
                text={contract.contractId} 
                label="Copy Contract ID"
                className="w-full justify-start h-11 rounded-xl border-border/50 bg-card/30 hover:bg-card/60"
                variant="outline"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Contract ID
              </CopyButton>
            </CardContent>
          </Card>

          {contract.sourceMetadata && (
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code className="h-5 w-5 text-secondary" />
                  Source Metadata
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeDisplay 
                  code={(() => {
                    try {
                      // Ensure proper JSON formatting
                      if (typeof contract.sourceMetadata === 'string') {
                        const parsed = JSON.parse(contract.sourceMetadata)
                        return JSON.stringify(parsed, null, 2)
                      }
                      return JSON.stringify(contract.sourceMetadata, null, 2)
                    } catch (error) {
                      return typeof contract.sourceMetadata === 'string' ? contract.sourceMetadata : JSON.stringify(contract.sourceMetadata, null, 2)
                    }
                  })()}
                  language="json"
                  maxHeight="300px"
                  fontSize="0.75rem"
                />
              </CardContent>
            </Card>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}