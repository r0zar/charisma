import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Calendar, Tag, Database, Shield, CheckCircle, Clock, XCircle, AlertTriangle, Code } from "lucide-react"
import { getContractRegistry } from "@/lib/contract-registry"
import type { ContractMetadata } from "@/lib/contract-registry"
import { TokenImage } from "@/components/TokenImage"
import { Pagination } from "./Pagination"

interface SearchParams {
  page?: string
  type?: string
  trait?: string
  status?: string
}

interface ContractListProps {
  searchParams: SearchParams
}

// Contract type icon mapping
function getTypeIcon(type: string) {
  switch (type) {
    case 'token': return Code
    case 'nft': return Shield
    case 'vault': return Database
    default: return Database
  }
}

// Status icon mapping
function getStatusIcon(status: string) {
  switch (status) {
    case 'valid': return CheckCircle
    case 'pending': return Clock
    case 'invalid': return XCircle
    case 'blocked': return AlertTriangle
    default: return Shield
  }
}

function ContractCard({ contract }: { contract: ContractMetadata }) {
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'token': 
        return { 
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/30',
          icon: Code
        }
      case 'nft': 
        return { 
          color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/30',
          icon: Shield
        }
      case 'vault': 
        return { 
          color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30',
          icon: Database
        }
      default: 
        return { 
          color: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800/30',
          icon: Database
        }
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'valid': 
        return { 
          color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30',
          icon: CheckCircle
        }
      case 'pending': 
        return { 
          color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30',
          icon: Clock
        }
      case 'invalid': 
        return { 
          color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30',
          icon: XCircle
        }
      case 'blocked': 
        return { 
          color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30',
          icon: AlertTriangle
        }
      default: 
        return { 
          color: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800/30',
          icon: Shield
        }
    }
  }

  const typeConfig = getTypeConfig(contract.contractType)
  const statusConfig = getStatusConfig(contract.validationStatus)
  const TypeIcon = typeConfig.icon
  const StatusIcon = statusConfig.icon

  return (
    <Card 
      interactive 
      status={contract.validationStatus as any}
      className="group relative overflow-hidden"
    >
      {/* Background gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardHeader className="pb-3 relative">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Token Image or Contract Icon */}
            <TokenImage contract={contract} size={40} />
            
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate group-hover:text-primary transition-colors duration-200">
                <Link
                  href={`/contracts/${encodeURIComponent(contract.contractId)}`}
                  className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                >
                  {contract.contractName || contract.contractId.split('.')[1] || 'Unnamed Contract'}
                </Link>
              </CardTitle>
              <CardDescription className="text-xs font-mono break-all opacity-60 group-hover:opacity-80 transition-opacity">
                {contract.contractId}
              </CardDescription>
            </div>
          </div>
          
          <Link
            href={`/contracts/${encodeURIComponent(contract.contractId)}`}
            className="ml-2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 relative">
        <div className="flex flex-wrap gap-2">
          <Badge className={typeConfig.color} variant="outline">
            <TypeIcon className="h-3 w-3 mr-1.5" />
            {contract.contractType.toUpperCase()}
          </Badge>
          <Badge className={statusConfig.color} variant="outline">
            <StatusIcon className="h-3 w-3 mr-1.5" />
            {contract.validationStatus.toUpperCase()}
          </Badge>
        </div>

        {contract.implementedTraits && contract.implementedTraits.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {contract.implementedTraits.slice(0, 3).map((trait) => (
              <Badge key={trait} variant="secondary" className="text-xs bg-muted/50 hover:bg-muted transition-colors">
                <Tag className="h-3 w-3 mr-1" />
                {trait}
              </Badge>
            ))}
            {contract.implementedTraits.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-muted/50">
                +{contract.implementedTraits.length - 3} more
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(contract.discoveredAt).toLocaleDateString()}</span>
          </div>
          <div className="capitalize font-medium">
            {contract.discoveryMethod?.replace('-', ' ')}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ filtersActive }: { filtersActive: boolean }) {
  return (
    <Card className="col-span-full">
      <CardContent className="text-center py-12">
        <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {filtersActive ? 'No contracts match your filters' : 'No contracts found'}
        </h3>
        <p className="text-muted-foreground">
          {filtersActive 
            ? 'Try adjusting your filters to find what you\'re looking for.'
            : 'Contracts will appear here once they are discovered and added.'
          }
        </p>
      </CardContent>
    </Card>
  )
}

async function getContracts(searchParams: SearchParams) {
  const registry = getContractRegistry()

  const page = parseInt(searchParams.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const filters: any = { offset, limit }

  if (searchParams.type && searchParams.type !== 'all') {
    filters.contractType = searchParams.type
  }

  if (searchParams.trait && searchParams.trait !== 'all') {
    filters.implementedTraits = [searchParams.trait]
  }

  if (searchParams.status && searchParams.status !== 'all') {
    filters.validationStatus = searchParams.status
  }

  const result = await registry.searchContracts(filters)

  return {
    contracts: result.contracts,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(result.total / limit),
      totalCount: result.total,
      limit,
      hasNextPage: page * limit < result.total,
      hasPrevPage: page > 1
    },
    filters: {
      type: searchParams.type || 'all',
      trait: searchParams.trait || 'all',
      status: searchParams.status || 'all'
    }
  }
}

export default async function ContractList({ searchParams }: ContractListProps) {
  const data = await getContracts(searchParams)
  
  const hasFilters = Boolean(
    (searchParams.type && searchParams.type !== 'all') ||
    (searchParams.trait && searchParams.trait !== 'all') ||
    (searchParams.status && searchParams.status !== 'all')
  )

  return (
    <>
      {/* Results */}
      {data.contracts && data.contracts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
            {data.contracts.map((contract: ContractMetadata) => (
              <ContractCard key={contract.contractId} contract={contract} />
            ))}
          </div>

          <Pagination pagination={data.pagination} />
        </>
      ) : (
        <EmptyState filtersActive={hasFilters} />
      )}
    </>
  )
}