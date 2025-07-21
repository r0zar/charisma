import { fetchRegistryStats } from "@/lib/contract-registry"

function StatsCard({ title, value, subtitle, variant = "default" }: {
  title: string
  value: string | number
  subtitle?: string
  variant?: "default" | "success" | "warning" | "error"
}) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      // Ensure non-negative values
      const safeVal = Math.max(0, val)
      if (safeVal > 1000000) return `${(safeVal / 1000000).toFixed(1)}M`
      if (safeVal > 1000) return `${(safeVal / 1000).toFixed(1)}K`
      return safeVal.toLocaleString()
    }
    return val
  }

  // Safe percentage calculation with bounds checking
  const safePercentage = (value: number, total: number, decimalPlaces: number = 1) => {
    if (!total || total <= 0 || !value || value < 0) return '0.0'
    const percentage = (value / total) * 100
    return Math.min(Math.max(percentage, 0), 100).toFixed(decimalPlaces)
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

export default async function RegistryOverview() {
  const stats = await fetchRegistryStats()
  
  // Safe percentage calculation with bounds checking
  const safePercentage = (value: number, total: number, decimalPlaces: number = 1) => {
    if (!total || total <= 0 || !value || value < 0) return '0.0'
    const percentage = (value / total) * 100
    return Math.min(Math.max(percentage, 0), 100).toFixed(decimalPlaces)
  }

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Registry Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Contracts"
          value={stats.totalContracts}
          subtitle={`+${stats.recentAdditions} recently added`}
        />
        <StatsCard
          title="Token Contracts"
          value={stats.contractsByType.token}
          subtitle="SIP-010 implementations"
        />
        <StatsCard
          title="NFT Contracts"
          value={stats.contractsByType.nft}
          subtitle="SIP-009 implementations"
        />
        <StatsCard
          title="Vault Contracts"
          value={stats.contractsByType.vault}
          subtitle="Custom vault implementations"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Valid Contracts"
          value={stats.validationStatus.valid}
          subtitle={`${safePercentage(stats.validationStatus.valid, stats.totalContracts)}% of total`}
        />
        <StatsCard
          title="Pending Validation"
          value={stats.validationStatus.pending}
          subtitle="Awaiting analysis"
        />
        <StatsCard
          title="Invalid Contracts"
          value={stats.validationStatus.invalid}
          subtitle="Failed validation"
        />
        <StatsCard
          title="Blocked Contracts"
          value={stats.validationStatus.blocked}
          subtitle="Manually blocked"
        />
      </div>
    </section>
  )
}