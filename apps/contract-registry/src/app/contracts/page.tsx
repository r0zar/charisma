import { Suspense } from "react"
import { Database } from "lucide-react"
import { FilterControls } from "./FilterControls"
import { QuickNav } from "./QuickNav"
import ContractStats from "./ContractStats"
import ContractList from "./ContractList"
import StatsLoading from "./StatsLoading"
import ContractsLoading from "./ContractsLoading"

interface SearchParams {
  page?: string
  type?: string
  trait?: string
  status?: string
}

interface ContractsPageProps {
  searchParams: Promise<SearchParams>
}

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const params = await searchParams

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
            
            {/* Stats - Stream independently */}
            <Suspense fallback={<StatsLoading />}>
              <ContractStats searchParams={params} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Quick Navigation - Render immediately (client-side only) */}
        <QuickNav />

        {/* Filters - Render immediately (no data dependency) */}
        <FilterControls filters={{
          type: params.type || 'all',
          trait: params.trait || 'all', 
          status: params.status || 'all'
        }} />

        {/* Contract List - Stream independently */}
        <Suspense fallback={<ContractsLoading />}>
          <ContractList searchParams={params} />
        </Suspense>
      </div>
    </div>
  )
}