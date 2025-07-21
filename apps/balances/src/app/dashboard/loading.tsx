export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-3">
            <div className="h-8 bg-muted/50 rounded-lg w-96 animate-pulse" />
            <div className="h-4 bg-muted/30 rounded w-80 animate-pulse" />
          </div>
          <div className="h-10 bg-muted/50 rounded-lg w-32 animate-pulse" />
        </div>

        {/* Stats cards skeleton */}
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

        {/* Main content grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Chart card skeleton */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
              <div className="space-y-4 mb-6">
                <div className="h-6 bg-muted/50 rounded w-48" />
                <div className="h-4 bg-muted/30 rounded w-72" />
              </div>
              <div className="h-[300px] bg-muted/20 rounded-lg" />
            </div>

            {/* Recent operations skeleton */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
              <div className="space-y-4 mb-6">
                <div className="h-6 bg-muted/50 rounded w-40" />
                <div className="h-4 bg-muted/30 rounded w-64" />
              </div>
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <div className="h-5 bg-muted/50 rounded w-16" />
                        <div className="h-5 bg-muted/50 rounded w-16" />
                      </div>
                      <div className="h-4 bg-muted/30 rounded w-72" />
                    </div>
                    <div className="h-6 bg-muted/50 rounded w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column - Sidebar */}
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                <div className="space-y-4 mb-6">
                  <div className="h-6 bg-muted/50 rounded w-32" />
                </div>
                <div className="space-y-4">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <div className="h-4 bg-muted/50 rounded w-24" />
                      <div className="h-4 bg-muted/50 rounded w-12" />
                    </div>
                  ))}
                </div>
                {i === 2 && (
                  <div className="mt-4 h-32 bg-muted/20 rounded-lg" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}