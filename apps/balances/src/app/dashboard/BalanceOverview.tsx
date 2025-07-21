import { getServiceStats, getSnapshots } from "@/lib/actions"

type BalanceStats = {
  totalCollections: number
  totalSnapshots: number
  totalSize: number
  activeAddresses: number
  trackedContracts: number
  cacheHitRate: number
  compressionRatio: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

async function fetchBalanceStats(): Promise<BalanceStats> {
  try {
    const [serviceStats, snapshotsResult] = await Promise.all([
      getServiceStats(),
      getSnapshots()
    ])
    
    const snapshots = snapshotsResult?.snapshots || []
    const totalSize = Array.isArray(snapshots) 
      ? snapshots.reduce((sum: number, s: any) => sum + (s.size || 0), 0) 
      : 0
    
    return {
      totalCollections: serviceStats?.totalSnapshots || 0,
      totalSnapshots: snapshots?.length || 0,
      totalSize: totalSize,
      activeAddresses: serviceStats?.totalAddresses || 0,
      trackedContracts: serviceStats?.totalTokens || 0,
      cacheHitRate: serviceStats?.cacheHitRate || 0,
      compressionRatio: 0.73
    }
  } catch (error) {
    console.error('Failed to fetch balance stats:', error)
    return {
      totalCollections: 0,
      totalSnapshots: 0,
      totalSize: 0,
      activeAddresses: 0,
      trackedContracts: 0,
      cacheHitRate: 0,
      compressionRatio: 0
    }
  }
}

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

export default async function BalanceOverview() {
  const stats = await fetchBalanceStats()
  
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Balance Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Collections"
          value={stats.totalCollections}
          subtitle={`${stats.activeAddresses} addresses tracked`}
        />
        <StatsCard
          title="Snapshots Created"
          value={stats.totalSnapshots}
          subtitle={formatBytes(stats.totalSize)}
        />
        <StatsCard
          title="Cache Hit Rate"
          value={formatPercentage(stats.cacheHitRate)}
          subtitle="Performance metric"
        />
        <StatsCard
          title="Storage Efficiency"
          value={formatPercentage(stats.compressionRatio)}
          subtitle="Compression ratio"
        />
      </div>
    </section>
  )
}