import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Database } from "lucide-react"

function StatCardSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
      <div className="h-8 bg-muted rounded animate-pulse mb-2" />
      <div className="h-4 bg-muted/50 rounded animate-pulse w-24" />
    </div>
  )
}

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

function FilterControlsSkeleton() {
  return (
    <div className="mb-8 space-y-6">
      {/* Filter Controls */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="w-44 h-11 rounded-xl bg-muted animate-pulse" />
          <div className="w-52 h-11 rounded-xl bg-muted animate-pulse" />
          <div className="w-44 h-11 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function ContractsLoadingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-secondary/5 to-transparent rounded-full blur-2xl" />
        
        <div className="relative container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <Database className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Contract Registry
              </h1>
            </div>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Discover and explore smart contracts in the ecosystem. Browse by type, validation status, and implemented traits.
            </p>
            
            {/* Stats Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <FilterControlsSkeleton />

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
      </div>
    </div>
  )
}