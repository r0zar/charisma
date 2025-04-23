import { Contract } from '@/components/contracts/contracts-list';

// Base URL for Stacks API
const STACKS_API_BASE = 'https://api.mainnet.hiro.so'; // Use testnet URL for development if needed

/**
 * Fetches contracts deployed by an address
 * 
 * @param address - Stacks address
 * @returns Promise<Contract[]> - List of deployed contracts
 */
export async function getStxAddressContracts(address: string): Promise<Contract[]> {
    try {
        // Fetch transactions for the address - looking specifically for smart_contract type
        const response = await fetch(
            `${STACKS_API_BASE}/extended/v1/address/${address}/transactions?limit=50&type=smart_contract`,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const results = data.results || [];

        // Map the transaction data to our Contract interface
        return results
            .filter((tx: any) => tx.tx_status === 'success') // Only include successful deployments
            .map((tx: any) => {
                // Extract contract name from the smart contract
                const contractName = tx.smart_contract?.contract_id?.split('.')?.[1] || 'Unknown Contract';
                const contractAddress = `${tx.sender_address}.${contractName}`;

                // Determine contract type - this is a simplification, you may need more logic
                const isToken = tx.smart_contract?.source?.toLowerCase().includes('sip-010') ||
                    tx.smart_contract?.source?.toLowerCase().includes('fungible-token');
                const isPool = tx.smart_contract?.source?.toLowerCase().includes('pool') ||
                    tx.smart_contract?.source?.toLowerCase().includes('liquidity');

                let type: 'sip10' | 'liquidity-pool' | 'custom' = 'custom';
                if (isToken) type = 'sip10';
                if (isPool) type = 'liquidity-pool';

                return {
                    id: tx.tx_id, // Use transaction ID as the unique identifier
                    name: contractName,
                    type,
                    deployedAt: tx.burn_block_time_iso, // ISO timestamp of deployment
                    contractAddress, // Full contract identifier
                    status: 'deployed', // Assuming 'success' means deployed
                    description: `Contract deployed in block ${tx.block_height}`,
                };
            });
    } catch (error) {
        console.error('Error fetching contracts from Stacks API:', error);
        return [];
    }
} 