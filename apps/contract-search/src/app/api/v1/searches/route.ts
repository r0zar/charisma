import { NextResponse } from 'next/server';
import { getSavedSearches, ContractData } from '@/app/actions';

/**
 * Deduplicate contracts, keeping only the one with highest block height for each contract ID
 * @param contracts Array of contracts to deduplicate
 * @param sortAscending Whether to sort by block height ascending (oldest first)
 * @returns Deduplicated array of contracts
 */
function deduplicateContracts(contracts: ContractData[], sortAscending: boolean = true): ContractData[] {
    // Use a map to only keep the highest block height for each contract_id
    const contractsMap = new Map<string, ContractData>();

    // Process each contract
    contracts.forEach(contract => {
        const existingContract = contractsMap.get(contract.contract_id);

        // If we don't have this contract yet, or if this one has a higher block height
        if (!existingContract || contract.block_height > existingContract.block_height) {
            contractsMap.set(contract.contract_id, contract);
        }
    });

    // Convert back to array
    const dedupedContracts = Array.from(contractsMap.values());

    // Sort by block height (ascending or descending based on parameter)
    return sortAscending
        ? dedupedContracts.sort((a, b) => a.block_height - b.block_height)
        : dedupedContracts.sort((a, b) => b.block_height - a.block_height);
}

/**
 * GET /api/v1/searches
 * Returns all saved contract trait searches
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const deduplicate = url.searchParams.get('deduplicate') !== 'false'; // Default to true
        const sortAscending = url.searchParams.get('sort') !== 'desc'; // Default to ascending (oldest first)

        // Get all saved searches
        const searches = await getSavedSearches();

        // Deep clone the searches to avoid modifying the originals
        const resultSearches = JSON.parse(JSON.stringify(searches));

        let totalDuplicatesRemoved = 0;

        // Apply deduplication to each search if requested
        if (deduplicate) {
            resultSearches.forEach((search: { contracts?: ContractData[] }) => {
                // Only process if contracts array exists and has items
                if (search.contracts && search.contracts.length > 0) {
                    const originalCount = search.contracts.length;
                    search.contracts = deduplicateContracts(search.contracts, sortAscending);
                    const newCount = search.contracts.length;
                    totalDuplicatesRemoved += (originalCount - newCount);
                }
            });
        }

        // Return the searches as JSON with pagination info
        return NextResponse.json({
            success: true,
            count: resultSearches.length,
            results: resultSearches,
            meta: {
                deduplicated: deduplicate,
                totalDuplicatesRemoved,
                sorting: sortAscending ? 'ascending' : 'descending'
            }
        });
    } catch (error: any) {
        console.error('Error fetching searches:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to retrieve searches',
            },
            { status: 500 }
        );
    }
} 