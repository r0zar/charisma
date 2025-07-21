import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fetchHealthStats } from "@/lib/contract-registry"

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

function HealthBadge({ status }: { status: string }) {
  const variant = status === "healthy" ? "default" : status === "warning" ? "secondary" : "destructive"
  return <Badge variant={variant}>{status}</Badge>
}

export default async function HealthMonitoring() {
  const stats = await fetchHealthStats()

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Health Monitoring</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <HealthBadge status={stats.status} />
            <p className="text-xs text-muted-foreground mt-2">
              Last check: {new Date(stats.lastHealthCheck).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        
        <StatsCard
          title="API Response Time"
          value={`${stats.apiResponseTime}ms`}
          subtitle="Average response time"
        />
        <StatsCard
          title="Error Rate"
          value={`${Math.min(Math.max(stats.errorRate * 100, 0), 100).toFixed(2)}%`}
          subtitle="Last 24 hours"
        />
        <StatsCard
          title="Active Indices"
          value={1000}
          subtitle="KV storage keys"
        />
      </div>
    </section>
  )
}