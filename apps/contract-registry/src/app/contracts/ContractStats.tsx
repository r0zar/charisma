import { getContractRegistry } from "@/lib/contract-registry"

interface ContractStatsProps {
  searchParams: {
    type?: string
    trait?: string 
    status?: string
  }
}

async function getRegistryStats() {
  const registry = getContractRegistry()
  const [stats, validContractsResult, contractsWithTraitsResult] = await Promise.all([
    registry.getStats(),
    registry.searchContracts({ validationStatus: 'valid', offset: 0, limit: 0 }),
    registry.searchContracts({ implementedTraits: ['SIP010'], offset: 0, limit: 0 })
      .then(sip010 => registry.searchContracts({ implementedTraits: ['SIP069'], offset: 0, limit: 0 })
        .then(sip069 => ({ 
          totalWithTraits: sip010.total + sip069.total
        })))
  ])

  return {
    totalContracts: stats.totalContracts,
    validatedContracts: validContractsResult.total,
    contractsWithTraits: contractsWithTraitsResult.totalWithTraits
  }
}

export default async function ContractStats({ searchParams }: ContractStatsProps) {
  const stats = await getRegistryStats()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <div className="text-3xl font-bold text-primary mb-2">
          {stats.totalContracts}
        </div>
        <div className="text-sm text-muted-foreground">Total Contracts</div>
      </div>
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <div className="text-3xl font-bold text-success mb-2">
          {stats.validatedContracts}
        </div>
        <div className="text-sm text-muted-foreground">Validated</div>
      </div>
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        <div className="text-3xl font-bold text-info mb-2">
          {stats.contractsWithTraits}
        </div>
        <div className="text-sm text-muted-foreground">With Traits</div>
      </div>
    </div>
  )
}