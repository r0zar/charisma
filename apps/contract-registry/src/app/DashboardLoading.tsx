function StatCardSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 bg-muted rounded animate-pulse w-24" />
      </div>
      <div>
        <div className="h-8 bg-muted rounded animate-pulse mb-2" />
        <div className="h-3 bg-muted/50 rounded animate-pulse w-32" />
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 shadow-lg rounded-lg">
      <div className="p-6 border-b border-border/50">
        <div className="h-5 bg-muted rounded animate-pulse mb-2" />
        <div className="h-4 bg-muted/50 rounded animate-pulse w-48" />
      </div>
      <div className="p-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-4 bg-muted rounded animate-pulse w-20" />
            <div className="h-6 bg-muted rounded-full animate-pulse w-12" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-4 bg-muted rounded animate-pulse w-16" />
            <div className="h-6 bg-muted rounded-full animate-pulse w-8" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-4 bg-muted rounded animate-pulse w-24" />
            <div className="h-6 bg-muted rounded-full animate-pulse w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

interface SectionLoadingProps {
  title: string
  gridCols: string
  showCards?: boolean
}

export function SectionLoading({ title, gridCols, showCards = false }: SectionLoadingProps) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      <div className={`grid grid-cols-1 ${gridCols} gap-4 mb-6`}>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      
      {showCards && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
    </section>
  )
}

export function RegistryLoading() {
  return <SectionLoading title="Registry Overview" gridCols="md:grid-cols-2 lg:grid-cols-4" />
}

export function StorageLoading() {
  return <SectionLoading title="Storage Metrics" gridCols="md:grid-cols-2 lg:grid-cols-4" showCards />
}

export function DiscoveryLoading() {
  return <SectionLoading title="Discovery Analytics" gridCols="md:grid-cols-2 lg:grid-cols-4" showCards />
}

export function HealthLoading() {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Health Monitoring</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 shadow-lg rounded-lg">
          <div className="p-6 border-b border-border/50">
            <div className="h-4 bg-muted rounded animate-pulse w-24" />
          </div>
          <div className="p-6">
            <div className="h-6 bg-muted rounded-full animate-pulse w-16 mb-2" />
            <div className="h-3 bg-muted/50 rounded animate-pulse w-32" />
          </div>
        </div>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    </section>
  )
}