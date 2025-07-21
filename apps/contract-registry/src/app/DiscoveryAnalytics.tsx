
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fetchDiscoveryStats } from "@/lib/contract-registry"
import { DiscoveryMethodsChart, TraitDistributionChart } from './components/DiscoveryCharts'

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


export default async function DiscoveryAnalytics() {
  const stats = await fetchDiscoveryStats()

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Discovery Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Success Rate"
          value={`${Math.min(Math.max(stats.successRate * 100, 0), 100).toFixed(1)}%`}
          subtitle="Discovery operations"
        />
        <StatsCard
          title="Avg Discovery Time"
          value={`${Math.max(0, (stats.avgDiscoveryTime / 1000)).toFixed(1)}s`}
          subtitle="Per contract analysis"
        />
        <StatsCard
          title="Trait Search"
          value={stats.contractsByMethod["trait-search"] || 0}
          subtitle="Primary discovery method"
        />
        <StatsCard
          title="SIP Standards"
          value={(stats.traitDistribution.SIP010 || 0) + (stats.traitDistribution.SIP069 || 0)}
          subtitle="Standards-compliant contracts"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>Discovery Methods</CardTitle>
            <CardDescription>How contracts were discovered</CardDescription>
          </CardHeader>
          <CardContent>
            <DiscoveryMethodsChart data={stats.contractsByMethod} />
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>Trait Distribution</CardTitle>
            <CardDescription>Implemented trait standards</CardDescription>
          </CardHeader>
          <CardContent>
            <TraitDistributionChart data={stats.traitDistribution} />
          </CardContent>
        </Card>
      </div>
    </section>
  )
}