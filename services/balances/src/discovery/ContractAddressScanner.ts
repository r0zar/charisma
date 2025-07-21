/**
 * Contract Address Scanner - Discovers contract addresses that hold tokens
 * Including treasury contracts, liquidity pools, and other protocol addresses
 */

import type { BalanceStore } from '../types';
import { 
  searchContractsByTrait,
  getContractInfo,
  getAccountBalances
} from '@repo/polyglot';

export interface ContractScanConfig {
  batchSize: number;
  rateLimitMs: number;
  maxConcurrent: number;
  includeTokenContracts?: boolean;
  includeNFTContracts?: boolean;
  includeDeFiContracts?: boolean;
}

export interface ContractAddressResult {
  address: string;
  contractName: string;
  contractType: 'sip-010' | 'sip-009' | 'defi' | 'dao' | 'other';
  hasTokenBalances: boolean;
  tokenBalances?: Record<string, string>;
  totalTokensHeld: number;
  estimatedValueUSD?: number;
  deployedAt?: number;
  deployer?: string;
  success: boolean;
  error?: string;
}

export interface ContractScanParams {
  contractTypes?: ('sip-010' | 'sip-009' | 'defi' | 'dao' | 'other')[];
  minTokenBalance?: string;
  maxContracts?: number;
  onlyWithTokenBalances?: boolean;
}

export class ContractAddressScanner {
  private balanceStore: BalanceStore;
  private config: ContractScanConfig;
  private contractCache: Map<string, ContractAddressResult> = new Map();

  constructor(balanceStore: BalanceStore, config: ContractScanConfig) {
    this.balanceStore = balanceStore;
    this.config = config;
  }

  /**
   * Scan for contract addresses that hold tokens
   */
  async scanContractAddresses(params: ContractScanParams): Promise<ContractAddressResult[]> {
    console.log('🏭 Scanning contract addresses for token holdings...', params);
    
    try {
      // Step 1: Discover contract addresses by type
      const contractAddresses = await this.discoverContractAddresses(params);
      console.log(`Found ${contractAddresses.length} contract addresses to scan`);

      if (contractAddresses.length === 0) {
        return [];
      }

      // Step 2: Check token balances for each contract
      const allResults: ContractAddressResult[] = [];
      
      for (let i = 0; i < contractAddresses.length; i += this.config.batchSize) {
        const batch = contractAddresses.slice(i, i + this.config.batchSize);
        console.log(`Processing contract batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(contractAddresses.length / this.config.batchSize)}`);

        const batchPromises = batch.map(async (contractInfo, index) => {
          // Stagger requests to respect rate limits
          await this.delay(index * (this.config.rateLimitMs / this.config.maxConcurrent));
          return this.scanContractTokenBalances(contractInfo);
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            allResults.push(result.value);
          } else {
            console.error('Contract scan failed:', result.reason);
          }
        }

        // Rate limiting between batches
        if (i + this.config.batchSize < contractAddresses.length) {
          await this.delay(this.config.rateLimitMs);
        }
      }

      // Step 3: Filter results based on parameters
      const filteredResults = this.filterContractResults(allResults, params);
      
      console.log(`✅ Contract address scan completed: ${filteredResults.length} contracts with token holdings found`);
      return filteredResults;

    } catch (error) {
      console.error('❌ Contract address scan failed:', error);
      return [{
        address: '',
        contractName: '',
        contractType: 'other',
        hasTokenBalances: false,
        totalTokensHeld: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }];
    }
  }

  /**
   * Discover contract addresses by type
   */
  private async discoverContractAddresses(params: ContractScanParams): Promise<Array<{
    address: string;
    contractName: string;
    contractType: ContractAddressResult['contractType'];
    deployedAt?: number;
    deployer?: string;
  }>> {
    const contractAddresses = [];

    try {
      // Discover different types of contracts
      const contractTypes = params.contractTypes || ['sip-010', 'sip-009', 'defi'];

      for (const contractType of contractTypes) {
        console.log(`🔍 Discovering ${contractType} contracts...`);
        
        const contracts = await this.discoverContractsByType(contractType);
        contractAddresses.push(...contracts);
      }

      // Add well-known DeFi and DAO contract addresses
      const knownContracts = this.getKnownContractAddresses();
      contractAddresses.push(...knownContracts);

      // Remove duplicates and limit results
      const uniqueContracts = Array.from(
        new Map(contractAddresses.map(c => [c.address, c])).values()
      ).slice(0, params.maxContracts || 50);

      return uniqueContracts;

    } catch (error) {
      console.error('Failed to discover contract addresses:', error);
      return [];
    }
  }

  /**
   * Discover contracts by specific type
   */
  private async discoverContractsByType(contractType: string): Promise<Array<{
    address: string;
    contractName: string;
    contractType: ContractAddressResult['contractType'];
    deployedAt?: number;
    deployer?: string;
  }>> {
    try {
      let traitName = '';
      
      switch (contractType) {
        case 'sip-010':
          traitName = 'sip-010-trait';
          break;
        case 'sip-009':
          traitName = 'sip-009-trait';
          break;
        default:
          // For other types, we'll use known contracts
          return [];
      }

      const contracts = await searchContractsByTrait(traitName);
      
      if (!contracts || !contracts.results) {
        return [];
      }

      return contracts.results
        .filter(contract => contract.tx_status === 'success')
        .slice(0, 20) // Limit per type
        .map(contract => ({
          address: contract.contract_id,
          contractName: contract.contract_id.split('.')[1] || 'unknown',
          contractType: contractType as ContractAddressResult['contractType'],
          deployedAt: contract.burn_block_time,
          deployer: contract.sender_address
        }));

    } catch (error) {
      console.error(`Failed to discover ${contractType} contracts:`, error);
      return [];
    }
  }

  /**
   * Get well-known contract addresses that commonly hold tokens
   */
  private getKnownContractAddresses(): Array<{
    address: string;
    contractName: string;
    contractType: ContractAddressResult['contractType'];
  }> {
    return [
      // StackSwap DEX contracts
      {
        address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.stackswap-swap-v5k',
        contractName: 'stackswap-swap-v5k',
        contractType: 'defi'
      },
      // Alex DEX contracts
      {
        address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.amm-pool-v2-01',
        contractName: 'amm-pool-v2-01',
        contractType: 'defi'
      },
      // Arkadiko protocol contracts
      {
        address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-liquidator-v1-1',
        contractName: 'arkadiko-liquidator-v1-1',
        contractType: 'defi'
      },
      {
        address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-stx-reserve-v1-1',
        contractName: 'arkadiko-stx-reserve-v1-1',
        contractType: 'defi'
      },
      // Bitflow contracts
      {
        address: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.bitflow-dao',
        contractName: 'bitflow-dao',
        contractType: 'dao'
      },
      // Velar contracts
      {
        address: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-dao',
        contractName: 'velar-dao',
        contractType: 'dao'
      }
    ];
  }

  /**
   * Scan token balances for a specific contract address
   */
  private async scanContractTokenBalances(contractInfo: {
    address: string;
    contractName: string;
    contractType: ContractAddressResult['contractType'];
    deployedAt?: number;
    deployer?: string;
  }): Promise<ContractAddressResult> {
    const cacheKey = contractInfo.address;
    
    // Check cache first
    if (this.contractCache.has(cacheKey)) {
      return this.contractCache.get(cacheKey)!;
    }

    try {
      console.log(`🔍 Scanning token balances for contract: ${contractInfo.contractName}`);

      // Get account balances for the contract address
      const balances = await getAccountBalances(contractInfo.address);
      
      if (!balances || !balances.fungible_tokens) {
        return {
          address: contractInfo.address,
          contractName: contractInfo.contractName,
          contractType: contractInfo.contractType,
          hasTokenBalances: false,
          totalTokensHeld: 0,
          deployedAt: contractInfo.deployedAt,
          deployer: contractInfo.deployer,
          success: true
        };
      }

      // Process token balances
      const tokenBalances: Record<string, string> = {};
      let totalTokensHeld = 0;

      for (const [contractId, tokenInfo] of Object.entries(balances.fungible_tokens)) {
        if (tokenInfo && tokenInfo.balance && BigInt(tokenInfo.balance) > 0) {
          tokenBalances[contractId] = tokenInfo.balance;
          totalTokensHeld++;
        }
      }

      const result: ContractAddressResult = {
        address: contractInfo.address,
        contractName: contractInfo.contractName,
        contractType: contractInfo.contractType,
        hasTokenBalances: totalTokensHeld > 0,
        tokenBalances: totalTokensHeld > 0 ? tokenBalances : undefined,
        totalTokensHeld,
        deployedAt: contractInfo.deployedAt,
        deployer: contractInfo.deployer,
        success: true
      };

      // Cache the result
      this.contractCache.set(cacheKey, result);
      
      if (result.hasTokenBalances) {
        console.log(`💰 Contract ${contractInfo.contractName} holds ${totalTokensHeld} different tokens`);
      }

      return result;

    } catch (error) {
      console.error(`Failed to scan contract ${contractInfo.address}:`, error);
      return {
        address: contractInfo.address,
        contractName: contractInfo.contractName,
        contractType: contractInfo.contractType,
        hasTokenBalances: false,
        totalTokensHeld: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Filter contract results based on parameters
   */
  private filterContractResults(
    results: ContractAddressResult[],
    params: ContractScanParams
  ): ContractAddressResult[] {
    return results.filter(result => {
      // Filter successful results
      if (!result.success) return false;

      // Filter by token balance requirement
      if (params.onlyWithTokenBalances && !result.hasTokenBalances) {
        return false;
      }

      // Filter by minimum balance (if specified and has balances)
      if (params.minTokenBalance && result.tokenBalances) {
        const hasMinBalance = Object.values(result.tokenBalances).some(balance =>
          BigInt(balance) >= BigInt(params.minTokenBalance!)
        );
        if (!hasMinBalance) return false;
      }

      return true;
    });
  }

  /**
   * Get contracts that hold a specific token
   */
  async getContractsHoldingToken(tokenContract: string): Promise<ContractAddressResult[]> {
    const allContracts = Array.from(this.contractCache.values());
    
    return allContracts.filter(contract => 
      contract.hasTokenBalances && 
      contract.tokenBalances && 
      contract.tokenBalances[tokenContract]
    );
  }

  /**
   * Update scanner configuration
   */
  updateConfig(newConfig: Partial<ContractScanConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Clear cache when config changes significantly
    if (newConfig.batchSize || newConfig.maxConcurrent) {
      this.contractCache.clear();
    }
  }

  /**
   * Clear contract cache
   */
  clearCache(): void {
    this.contractCache.clear();
    console.log('Contract address scan cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; contractsWithTokens: number; contractTypes: Record<string, number> } {
    const contracts = Array.from(this.contractCache.values());
    const contractsWithTokens = contracts.filter(c => c.hasTokenBalances).length;
    const contractTypes = contracts.reduce((types, contract) => {
      types[contract.contractType] = (types[contract.contractType] || 0) + 1;
      return types;
    }, {} as Record<string, number>);

    return {
      size: this.contractCache.size,
      contractsWithTokens,
      contractTypes
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}