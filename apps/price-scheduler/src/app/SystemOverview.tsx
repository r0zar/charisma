import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SystemStats {
  lastUpdateAge: number | null
  lastUpdate: number | null
  tokenCount: number
  arbitrageOpportunities: number
  estimatedStorageGB: number
  totalSnapshots: number
  status: 'healthy' | 'degraded' | 'error'
}

function formatDuration(ms: number | null) {
  if (!ms) return 'Never'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m ago`
  }
  return `${minutes}m ${seconds}s ago`
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy': return <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    case 'degraded': return <svg className="h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.262 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
    case 'error': return <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    default: return <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  }
}

function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend 
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: string
}) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold mb-2">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {subtitle && (
            <Badge variant="secondary" className="text-xs">
              {subtitle}
            </Badge>
          )}
          {trend && (
            <Badge variant="outline" className="text-xs">
              {trend}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

async function fetchSystemStats(): Promise<SystemStats> {
  try {
    const response = await fetch('/api/status')
    if (!response.ok) {
      return {
        lastUpdateAge: null,
        lastUpdate: null,
        tokenCount: 0,
        arbitrageOpportunities: 0,
        estimatedStorageGB: 0,
        totalSnapshots: 0,
        status: 'error'
      }
    }
    
    const data = await response.json()
    return {
      lastUpdateAge: data.lastUpdateAge || null,
      lastUpdate: data.lastUpdate || null,
      tokenCount: data.latestSnapshot?.tokenCount || 0,
      arbitrageOpportunities: data.latestSnapshot?.arbitrageOpportunities || 0,
      estimatedStorageGB: data.storage?.estimatedStorageGB || 0,
      totalSnapshots: data.storage?.totalSnapshots || 0,
      status: data.status || 'unknown'
    }
  } catch (error) {
    console.error('Failed to fetch system stats:', error)
    return {
      lastUpdateAge: null,
      lastUpdate: null,
      tokenCount: 0,
      arbitrageOpportunities: 0,
      estimatedStorageGB: 0,
      totalSnapshots: 0,
      status: 'error'
    }
  }
}

export default async function SystemOverview() {
  const stats = await fetchSystemStats()
  
  return (
    <section className="mb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">System Overview</h2>
        <p className="text-muted-foreground">
          Current status of the three-engine price discovery system
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Last Update"
          value={formatDuration(stats.lastUpdateAge)}
          subtitle={stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleTimeString() : undefined}
          icon={() => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        
        <StatsCard
          title="Tokens Priced"
          value={stats.tokenCount}
          subtitle="Last snapshot"
          icon={() => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        
        <StatsCard
          title="Arbitrage Opportunities"
          value={stats.arbitrageOpportunities}
          subtitle="Profitable trades"
          icon={() => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          trend={stats.arbitrageOpportunities > 0 ? "Active" : "None"}
        />
        
        <StatsCard
          title="Storage"
          value={`${stats.estimatedStorageGB.toFixed(2)} GB`}
          subtitle={`${stats.totalSnapshots} snapshots`}
          icon={() => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>}
        />
      </div>
    </section>
  )
}