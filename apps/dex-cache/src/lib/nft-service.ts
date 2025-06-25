// NFT balance service for checking Charisma NFT bonuses
import { getAccountBalances } from '@repo/polyglot';
import React from 'react';

export interface NFTBalance {
    contractId: string;
    name: string;
    ownedTokens: number[];
    totalCount: number;
}

export interface NFTBonuses {
    welshNFTs: NFTBalance[];
    ravenNFTs: NFTBalance[];
    memobotNFTs: NFTBalance[];
    totalWelshCount: number;
    totalRavenCount: number;
    totalMemobotCount: number;
    energyGenerationBonus: number; // Percentage
    feeDiscountBonus: number; // Percentage  
    capacityBonus: number; // Raw energy units
}

// Known NFT contract patterns to check
const NFT_CONTRACTS = {
    welsh: [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.happy-welsh',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.weird-welsh', 
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-punk',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.legendary-welsh',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-welsh'
    ],
    raven: [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.ravens',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.raven',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-raven'
    ],
    memobot: [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.memobots',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.memobot',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-memobot'
    ]
};

// Cache for NFT balance results
const balanceCache = new Map<string, NFTBonuses>();
const CACHE_DURATION = 30 * 1000; // 30 seconds

async function checkNFTBalancesFromAccount(userAddress: string): Promise<Record<string, NFTBalance>> {
    const results: Record<string, NFTBalance> = {};

    try {
        console.log(`🔍 Getting account balances for ${userAddress}...`);
        const accountData = await getAccountBalances(userAddress);
        
        if (!accountData?.non_fungible_tokens) {
            console.log('❌ No NFT data found in account balances');
            return results;
        }

        // Process all NFT collections from account balances
        const nftEntries = Object.entries(accountData.non_fungible_tokens);
        console.log(`📊 Found ${nftEntries.length} NFT collections in account`);

        for (const [contractId, nftData] of nftEntries) {
            const count = parseInt(nftData.count);
            if (count > 0) {
                const balance: NFTBalance = {
                    contractId,
                    name: contractId.split('::')[1] || contractId.split('.')[1] || contractId,
                    ownedTokens: [], // We have count but not individual token IDs from this API
                    totalCount: count
                };
                
                results[contractId] = balance;
                console.log(`✅ Found ${count} NFTs in ${contractId}`);
            }
        }

        return results;

    } catch (error) {
        console.error(`Error getting account NFT balances for ${userAddress}:`, error);
        return results;
    }
}

export async function getNFTBonuses(userAddress: string): Promise<NFTBonuses> {
    const cached = balanceCache.get(userAddress);
    
    if (cached) {
        return cached;
    }

    console.log(`🔍 Checking NFT bonuses for ${userAddress}`);

    const bonuses: NFTBonuses = {
        welshNFTs: [],
        ravenNFTs: [],
        memobotNFTs: [],
        totalWelshCount: 0,
        totalRavenCount: 0,
        totalMemobotCount: 0,
        energyGenerationBonus: 0,
        feeDiscountBonus: 0,
        capacityBonus: 0
    };

    try {
        // Get all NFT balances from account
        const allNFTBalances = await checkNFTBalancesFromAccount(userAddress);

        // Process Welsh NFTs - look for any contract containing "welsh"
        Object.entries(allNFTBalances).forEach(([contractId, balance]) => {
            const contractLower = contractId.toLowerCase();
            
            if (contractLower.includes('welsh')) {
                bonuses.welshNFTs.push(balance);
                bonuses.totalWelshCount += balance.totalCount;
                console.log(`✅ Welsh NFT found: ${contractId} (${balance.totalCount} NFTs)`);
            }
        });

        // Process Raven NFTs - look for any contract containing "raven"
        Object.entries(allNFTBalances).forEach(([contractId, balance]) => {
            const contractLower = contractId.toLowerCase();
            
            if (contractLower.includes('raven')) {
                bonuses.ravenNFTs.push(balance);
                bonuses.totalRavenCount += balance.totalCount;
                console.log(`✅ Raven NFT found: ${contractId} (${balance.totalCount} NFTs)`);
            }
        });

        // Process Memobot NFTs - look for any contract containing "memobot"
        Object.entries(allNFTBalances).forEach(([contractId, balance]) => {
            const contractLower = contractId.toLowerCase();
            
            if (contractLower.includes('memobot') || contractLower.includes('memobots')) {
                bonuses.memobotNFTs.push(balance);
                bonuses.totalMemobotCount += balance.totalCount;
                console.log(`✅ Memobot NFT found: ${contractId} (${balance.totalCount} NFTs)`);
            }
        });

        // Calculate bonuses based on actual NFT ownership
        bonuses.energyGenerationBonus = bonuses.totalWelshCount * 5; // 5% per Welsh NFT
        bonuses.feeDiscountBonus = Math.min(bonuses.totalRavenCount * 2, 15); // 2% per Raven, max 15%
        bonuses.capacityBonus = bonuses.totalMemobotCount * 50000000; // 50 energy per Memobot (with 6 decimals)

        console.log(`🎯 Final NFT Bonuses:`, {
            totalWelsh: bonuses.totalWelshCount,
            totalRaven: bonuses.totalRavenCount,  
            totalMemobot: bonuses.totalMemobotCount,
            energyGenerationBonus: `+${bonuses.energyGenerationBonus}%`,
            feeDiscountBonus: `-${bonuses.feeDiscountBonus}%`,
            capacityBonus: `+${bonuses.capacityBonus / 1000000} Energy`
        });

    } catch (error) {
        console.error('Error fetching NFT bonuses:', error);
    }

    // Cache the result for 30 seconds
    balanceCache.set(userAddress, bonuses);
    setTimeout(() => balanceCache.delete(userAddress), CACHE_DURATION);
    
    return bonuses;
}

// Hook for React components
export function useNFTBonuses(userAddress?: string) {
    const [bonuses, setBonuses] = React.useState<NFTBonuses | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!userAddress) {
            setBonuses(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        getNFTBonuses(userAddress)
            .then(setBonuses)
            .catch((err) => {
                setError(err.message);
                console.error('Failed to get NFT bonuses:', err);
            })
            .finally(() => setIsLoading(false));

    }, [userAddress]);

    return { bonuses, isLoading, error };
}

// Test function for manual checking
export async function testNFTBonuses(userAddress: string) {
    console.log('🧪 Testing NFT bonus detection...');
    const bonuses = await getNFTBonuses(userAddress);
    
    console.log('✅ Results:', bonuses);
    return bonuses;
}