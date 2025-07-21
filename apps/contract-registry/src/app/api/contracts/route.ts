import { NextRequest, NextResponse } from 'next/server'
import { getContractRegistry } from '@/lib/contract-registry'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const contractType = searchParams.get('type')
    const trait = searchParams.get('trait')
    const status = searchParams.get('status')

    const registry = getContractRegistry()

    // Check if any filters are actually applied
    const hasFilters = (contractType && contractType !== 'all') ||
      (trait && trait !== 'all') ||
      (status && status !== 'all')

    let result

    if (hasFilters) {
      // Build search query with filters
      const query: any = {
        offset,
        limit
      }

      if (contractType && contractType !== 'all') {
        query.contractType = contractType
      }

      if (trait && trait !== 'all') {
        query.implementedTraits = [trait]
      }

      if (status && status !== 'all') {
        query.validationStatus = status
      }

      console.log('Filtered search query:', JSON.stringify(query, null, 2))
      result = await registry.searchContracts(query)
    } else {
      // No filters - get all contracts
      console.log('No filters applied, getting all contracts with pagination')
      result = await registry.searchContracts({ offset, limit })
    }

    console.log('🔍 Search result:', {
      contractCount: result.contracts?.length || 0,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      queryTime: result.queryTime,
      hasFilters
    })

    console.log('🔧 Registry instance details:', {
      configUsed: 'createDefaultConfig',
      serviceName: 'mainnet-contract-registry'
    })

    // Use the total count from search result (this is the count AFTER applying filters)
    let totalCount = result.total || 0

    // If we get zero results when no filters are applied, this indicates a service issue
    if (totalCount === 0 && !hasFilters) {
      console.warn('⚠️  No contracts returned even without filters - possible service issue')

      // Try alternative method to get contract list
      try {
        const allContractIds = await registry.getAllContracts()
        console.log('getAllContracts() returned:', allContractIds?.length || 0, 'contract IDs')
      } catch (error) {
        console.error('getAllContracts() failed:', error)
      }
    }

    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      contracts: result.contracts,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        type: contractType || 'all',
        trait: trait || 'all',
        status: status || 'all'
      },
      meta: {
        responseTime,
        timestamp: Date.now()
      }
    })

    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('X-Total-Count', totalCount.toString())

    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch contracts'

    console.error('Failed to fetch contracts:', error)

    const errorResponse = {
      error: true,
      message: errorMessage,
      timestamp: Date.now(),
      responseTime
    }

    return NextResponse.json(errorResponse, {
      status: 500,
      statusText: 'Contract Fetch Error'
    })
  }
}