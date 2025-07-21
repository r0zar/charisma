import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import BalanceOverview from "./BalanceOverview"
import SnapshotActivity from "./SnapshotActivity"
import ServiceStatus from "./ServiceStatus"
import RecentOperations from "./RecentOperations"

function OverviewLoading() {
  return (
    <div className="mb-8">
      <div className="mb-6">
        <div className="h-7 bg-muted/50 rounded w-80 animate-pulse mb-2" />
        <div className="h-4 bg-muted/30 rounded w-96 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 bg-muted/50 rounded w-24" />
              <div className="h-8 w-8 bg-muted/50 rounded-lg" />
            </div>
            <div className="h-8 bg-muted/50 rounded w-16 mb-2" />
            <div className="h-4 bg-muted/30 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityLoading() {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 mb-8">
      <div className="space-y-4 mb-6">
        <div className="h-6 bg-muted/50 rounded w-48 animate-pulse" />
        <div className="h-4 bg-muted/30 rounded w-72 animate-pulse" />
      </div>
      <div className="h-[300px] bg-muted/20 rounded-lg animate-pulse" />
    </div>
  )
}

function OperationsLoading() {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
      <div className="space-y-4 mb-6">
        <div className="h-6 bg-muted/50 rounded w-40 animate-pulse" />
        <div className="h-4 bg-muted/30 rounded w-64 animate-pulse" />
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-5 bg-muted/50 rounded w-16 animate-pulse" />
                <div className="h-5 bg-muted/50 rounded w-16 animate-pulse" />
              </div>
              <div className="h-4 bg-muted/30 rounded w-72 animate-pulse" />
            </div>
            <div className="h-6 bg-muted/50 rounded w-12 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusLoading() {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <div className="space-y-4 mb-6">
            <div className="h-6 bg-muted/50 rounded w-32 animate-pulse" />
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="h-4 bg-muted/50 rounded w-24 animate-pulse" />
                <div className="h-4 bg-muted/50 rounded w-12 animate-pulse" />
              </div>
            ))}
          </div>
          {i === 2 && (
            <div className="mt-4 h-32 bg-muted/20 rounded-lg animate-pulse" />
          )}
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Balance Collection Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor balance collection activity, snapshots, and service performance
            <span className="ml-2 text-xs">
              • Last updated: {new Date().toLocaleTimeString()}
            </span>
          </p>
        </div>

        {/* Balance Overview */}
        <Suspense fallback={<OverviewLoading />}>
          <BalanceOverview />
        </Suspense>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Snapshot Activity Chart */}
            <Suspense fallback={<ActivityLoading />}>
              <SnapshotActivity />
            </Suspense>

            {/* Recent Operations */}
            <Suspense fallback={<OperationsLoading />}>
              <RecentOperations />
            </Suspense>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            <Suspense fallback={<StatusLoading />}>
              <ServiceStatus />
            </Suspense>
          </div>
        </div>
    </div>
  )
}