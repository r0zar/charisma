import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fetchStorageStats } from "@/lib/contract-registry"

function StatsCard({ title, value, subtitle }: {
  title: string
  value: string | number
  subtitle?: string
}) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      const safeVal = Math.max(0, val)
      if (safeVal > 1000000) return `${(safeVal / 1000000).toFixed(1)}M`
      if (safeVal > 1000) return `${(safeVal / 1000).toFixed(1)}K`
      return safeVal.toLocaleString()
    }
    return val
  }

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

export default async function StorageMetrics() {
  const stats = await fetchStorageStats()

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Storage Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Storage Used"
          value={`${Math.max(0, (stats.blobStorage.totalSize / (1024 * 1024))).toFixed(0)}MB`}
          subtitle={`Across ${stats.blobStorage.totalContracts} contracts`}
        />
        <StatsCard
          title="Average Contract Size"
          value={`${Math.max(0, (stats.blobStorage.averageSize / 1024)).toFixed(0)}KB`}
          subtitle="Per contract (compressed)"
        />
        <StatsCard
          title="Charged Contracts"
          value={stats.blobStorage.largeContractCount || 0}
          subtitle="Over 512MB (incur costs)"
        />
        <StatsCard
          title="Cache Hit Rate"
          value={`${Math.min(Math.max(stats.indexStorage.cacheHitRate * 100, 0), 100).toFixed(1)}%`}
          subtitle="Index performance"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.blobStorage.largestContract && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>Largest Contract</CardTitle>
              <CardDescription>Contract consuming the most storage space</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                  {stats.blobStorage.largestContract.contractId}
                </code>
                <Badge variant={stats.blobStorage.largestContract.size > 512 * 1024 * 1024 ? "destructive" : "outline"}>
                  {(stats.blobStorage.largestContract.size / (1024 * 1024)).toFixed(1)}MB
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
        
        {stats.blobStorage.oversizedContracts && stats.blobStorage.oversizedContracts.length > 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-destructive">Oversized Contracts</CardTitle>
              <CardDescription>Contracts over 1GB (may cause performance issues)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {stats.blobStorage.oversizedContracts.slice(0, 5).map((contract, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <code className="bg-muted px-2 py-1 rounded font-mono text-xs break-all flex-1 mr-2">
                      {contract.contractId}
                    </code>
                    <Badge variant="destructive" className="flex-shrink-0">
                      {(contract.size / (1024 * 1024)).toFixed(1)}MB
                    </Badge>
                  </div>
                ))}
                {stats.blobStorage.oversizedContracts.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{stats.blobStorage.oversizedContracts.length - 5} more oversized contracts
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}