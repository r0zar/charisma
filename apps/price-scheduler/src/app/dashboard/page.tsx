import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import SystemOverview from "../SystemOverview"
import EngineHealth from "../EngineHealth"
import SystemActions from "../SystemActions"

function OverviewLoading() {
  return (
    <div className="mb-8">
      <div className="mb-6">
        <div className="h-7 bg-muted/50 rounded w-64 animate-pulse mb-2" />
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

function EngineLoading() {
  return (
    <div className="space-y-6">
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
        <div className="space-y-4 mb-6">
          <div className="h-6 bg-muted/50 rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted/30 rounded w-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-border/50 bg-card/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 bg-muted/50 rounded animate-pulse" />
                  <div className="space-y-1">
                    <div className="h-4 bg-muted/50 rounded w-16 animate-pulse" />
                    <div className="h-3 bg-muted/30 rounded w-20 animate-pulse" />
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="h-4 bg-muted/50 rounded w-12 animate-pulse" />
                  <div className="h-3 bg-muted/30 rounded w-16 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActionsLoading() {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
      <div className="space-y-4 mb-6">
        <div className="h-6 bg-muted/50 rounded w-32 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-11 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Price Service Dashboard
            </h1>
            <p className="text-muted-foreground">
              Three-Engine Architecture • 5-minute intervals
            </p>
          </div>
          <Button variant="outline" className="hover:scale-105 transition-transform">
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </Button>
        </div>

        {/* System Overview */}
        <Suspense fallback={<OverviewLoading />}>
          <SystemOverview />
        </Suspense>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Engine Health */}
          <div className="lg:col-span-2">
            <Suspense fallback={<EngineLoading />}>
              <EngineHealth />
            </Suspense>
          </div>

          {/* Right Column - Actions */}
          <div>
            <Suspense fallback={<ActionsLoading />}>
              <SystemActions />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}