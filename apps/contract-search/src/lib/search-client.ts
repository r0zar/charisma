/**
 * Configuration for the metadata service
 */
export interface MetadataServiceConfig {
    apiKey?: string;
    debug?: boolean;
}

/**
 * Search for contracts implementing a specific trait
 */
export async function searchContractsByTrait(
    trait: any,
    config: MetadataServiceConfig,
    blacklist: string[] = []
): Promise<any[]> {
    let allContracts: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const path = `/extended/v1/contract/by_trait?trait_abi=${encodeURIComponent(JSON.stringify(trait))}&limit=50&offset=${offset}`;

            const baseUrl = "https://api.hiro.so";
            const headers = new Headers({ 'Content-Type': 'application/json' });
            const apiKey = config.apiKey || "";
            if (apiKey) headers.set('x-api-key', apiKey);
            const response = await fetch(`${baseUrl}${path}`, { headers });

            if (!response.ok) {
                throw new Error(`Failed to fetch contracts: ${response.status}`);
            }

            const data: any = await response.json();
            const results = data?.results || [];

            if (results.length === 0) {
                hasMore = false;
            } else {
                const filteredResults = results.filter(
                    (contract: any) => !blacklist.includes(contract.contract_id)
                );
                allContracts = [...allContracts, ...filteredResults];
                offset += 50;
            }
        } catch (error) {
            if (config.debug) {
                console.warn(`Error fetching contracts at offset ${offset}:`, error);
            }
            hasMore = false;
        }
    }

    return allContracts;
}