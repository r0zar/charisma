function StatCardSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
      <div className="h-8 bg-muted rounded animate-pulse mb-2" />
      <div className="h-4 bg-muted/50 rounded animate-pulse w-24" />
    </div>
  )
}

export default function StatsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}