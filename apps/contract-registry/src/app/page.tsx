import { Suspense } from "react"
import RegistryOverview from "./RegistryOverview"
import StorageMetrics from "./StorageMetrics"
import DiscoveryAnalytics from "./DiscoveryAnalytics"
import HealthMonitoring from "./HealthMonitoring"
import { RegistryLoading, StorageLoading, DiscoveryLoading, HealthLoading } from "./DashboardLoading"

export default async function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Contract Registry Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor stats and metrics for the contract registry service
          <span className="ml-2 text-xs">
            • Last updated: {new Date().toLocaleTimeString()}
          </span>
        </p>
      </div>

      {/* Registry Statistics - Stream independently */}
      <Suspense fallback={<RegistryLoading />}>
        <RegistryOverview />
      </Suspense>

      {/* Storage Metrics - Stream independently */}
      <Suspense fallback={<StorageLoading />}>
        <StorageMetrics />
      </Suspense>

      {/* Discovery Analytics - Stream independently */}
      <Suspense fallback={<DiscoveryLoading />}>
        <DiscoveryAnalytics />
      </Suspense>

      {/* Health Monitoring - Stream independently */}
      <Suspense fallback={<HealthLoading />}>
        <HealthMonitoring />
      </Suspense>
    </div>
  )
}