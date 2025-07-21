import { Card, CardContent, CardHeader } from "@/components/ui/card"

function ContractCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden">
      <CardHeader className="pb-3 relative">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Contract Icon Skeleton */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted animate-pulse" />
            
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-5 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted/50 rounded animate-pulse w-3/4" />
            </div>
          </div>
          
          <div className="ml-2 w-8 h-8 rounded-lg bg-muted animate-pulse" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 relative">
        <div className="flex flex-wrap gap-2">
          <div className="h-6 bg-muted rounded-full animate-pulse w-20" />
          <div className="h-6 bg-muted rounded-full animate-pulse w-16" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <div className="h-5 bg-muted rounded-full animate-pulse w-16" />
          <div className="h-5 bg-muted rounded-full animate-pulse w-12" />
          <div className="h-5 bg-muted rounded-full animate-pulse w-14" />
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
          <div className="h-3 bg-muted rounded animate-pulse w-20" />
          <div className="h-3 bg-muted rounded animate-pulse w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function ContractsLoading() {
  return (
    <>
      {/* Loading Message */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading contracts...
        </div>
      </div>

      {/* Contract Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
        {Array.from({ length: 6 }).map((_, index) => (
          <ContractCardSkeleton key={index} />
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-9 bg-muted rounded animate-pulse w-32" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-muted rounded animate-pulse" />
          <div className="h-9 w-9 bg-muted rounded animate-pulse" />
          <div className="h-9 w-9 bg-muted rounded animate-pulse" />
          <div className="h-9 w-9 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 bg-muted rounded animate-pulse w-24" />
      </div>
    </>
  )
}