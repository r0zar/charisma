import { getAccountBalances, callReadOnlyFunction } from '@repo/polyglot';
import { fetchMetadata } from '@repo/tokens';
import { principalCV } from '@stacks/transactions';
import type { BalanceUpdateMessage } from 'blaze-sdk/realtime';

export interface BalanceData {
  userId: string;
  contractId: string;
  balance: number;
  totalSent: string;
  totalReceived: string;
  timestamp: number;
  source: string;
}

// Enhanced interface for compatibility with the new BalanceUpdate interface
export interface TokenMetadata {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  description?: string | null;
  image?: string | null;
  total_supply?: string | null;
  type?: string;
  identifier?: string;
  token_uri?: string | null;
  lastUpdated?: number | null;
  tokenAContract?: string | null;
  tokenBContract?: string | null;
  lpRebatePercent?: number | null;
  externalPoolId?: string | null;
  engineContractId?: string | null;
  base?: string | null;
}

// Enhanced token record that includes metadata and user balances (internal only)
export interface EnhancedTokenRecord {
  // Core metadata fields
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  description?: string | null;
  image?: string | null;
  total_supply?: string | null;
  tokenType?: string;
  identifier?: string;
  token_uri?: string | null;
  lastUpdated?: number | null;
  tokenAContract?: string | null;
  tokenBContract?: string | null;
  lpRebatePercent?: number | null;
  externalPoolId?: string | null;
  engineContractId?: string | null;
  baseToken?: string | null;

  // Balance data (per user) - defaults to 0 if no balance
  userBalances: Record<string, {
    balance: number;
    totalSent: string;
    totalReceived: string;
    formattedBalance: number;
    timestamp: number;
    source: string;
  }>;

  // Metadata about this record
  timestamp: number;
  metadataSource: string;
}

/**
 * Fetch balances for multiple users efficiently using getAccountBalances
 * Each call gets ALL token balances for that user
 * Also fetches subnet token balances using read-only contract calls
 */
export async function fetchUserBalances(userIds: string[], enhancedTokenRecords?: Map<string, EnhancedTokenRecord>): Promise<Record<string, BalanceData>> {
  console.log(`💰 Fetching balances for ${userIds.length} users`);

  const balanceUpdates: Record<string, BalanceData> = {};
  const timestamp = Date.now();

  // Process users in parallel with some rate limiting
  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const accountBalances = await getAccountBalances(userId, { unanchored: true });

        if (!accountBalances) {
          console.warn(`No balances found for user: ${userId}`);
          return null;
        }

        // Process STX balance
        if (accountBalances.stx) {
          const key = `${userId}:.stx`;
          balanceUpdates[key] = {
            userId,
            contractId: '.stx',
            balance: Number(accountBalances.stx.balance),
            totalSent: accountBalances.stx.total_sent,
            totalReceived: accountBalances.stx.total_received,
            timestamp,
            source: 'hiro-api'
          };
        }

        // Process all fungible token balances
        if (accountBalances.fungible_tokens) {
          Object.entries(accountBalances.fungible_tokens).forEach(([contractId, tokenBalance]) => {
            const balance = tokenBalance as { balance: string; total_sent: string; total_received: string };
            const key = `${userId}:${contractId}`;
            balanceUpdates[key] = {
              userId,
              contractId,
              balance: Number(balance.balance),
              totalSent: balance.total_sent,
              totalReceived: balance.total_received,
              timestamp,
              source: 'hiro-api'
            };
          });
        }

        console.log(`✅ Fetched balances for ${userId}: ${Object.keys(accountBalances.fungible_tokens || {}).length + 1} tokens`);

        // Fetch subnet token balances if we have metadata
        if (enhancedTokenRecords) {
          const subnetTokens = Array.from(enhancedTokenRecords.values())
            .filter(record => record.tokenType === 'SUBNET');

          if (subnetTokens.length > 0) {
            console.log(`🏗️ Fetching ${subnetTokens.length} subnet token balances for ${userId}`);

            const subnetBalancePromises = subnetTokens.map(async (subnetRecord) => {
              try {
                const [addr, name] = subnetRecord.contractId.split('.');
                const balanceCV = await callReadOnlyFunction(addr!, name!, 'get-balance', [principalCV(userId)]);
                const balance = Number(balanceCV.value);

                if (balance > 0) {
                  const key = `${userId}:${subnetRecord.contractId}`;
                  balanceUpdates[key] = {
                    userId,
                    contractId: subnetRecord.contractId,
                    balance: Number(balance),
                    totalSent: '0',
                    totalReceived: '0',
                    timestamp,
                    source: 'subnet-contract-call'
                  };
                  console.log(`🏗️ Subnet balance: ${userId.slice(0, 8)}...${userId.slice(-4)}:${subnetRecord.symbol} = ${balance}`);
                }
              } catch (error) {
                console.error(`❌ Failed to fetch subnet balance for ${subnetRecord.contractId}:`, error);
              }
            });

            await Promise.allSettled(subnetBalancePromises);
          }
        }

        return accountBalances;

      } catch (error) {
        console.error(`❌ Failed to fetch balances for ${userId}:`, error);
        return null;
      }
    })
  );

  // Log summary
  const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  const failed = results.length - successful;
  const totalBalances = Object.keys(balanceUpdates).length;

  console.log(`📊 Balance fetch summary:`);
  console.log(`   • ${successful} users successful, ${failed} failed`);
  console.log(`   • ${totalBalances} total balance entries`);
  console.log(`   → Broadcasting ${totalBalances} balance updates`);

  return balanceUpdates;
}

/**
 * Utility function to format balance using decimals
 */
export function formatBalance(balance: string, decimals: number): number {
  try {
    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum)) return 0;

    const divisor = Math.pow(10, decimals);
    return balanceNum / divisor;
  } catch (error) {
    console.warn(`Failed to format balance ${balance} with ${decimals} decimals:`, error);
    return 0;
  }
}

/**
 * Load token metadata and create enhanced token records
 */
export async function loadTokenMetadata(): Promise<Map<string, EnhancedTokenRecord>> {
  try {
    console.log('🏷️ Loading token metadata and creating enhanced token records...');
    const metadataList = await fetchMetadata();
    const now = Date.now();

    const enhancedTokenRecords = new Map<string, EnhancedTokenRecord>();

    for (const metadata of metadataList) {
      if (!metadata.contractId) continue;

      // Create enhanced token record with empty balances
      const enhancedRecord: EnhancedTokenRecord = {
        contractId: metadata.contractId,
        name: metadata.name || `Token ${metadata.contractId}`,
        symbol: metadata.symbol || 'TKN',
        decimals: metadata.decimals || 6,
        description: metadata.description,
        image: metadata.image,
        total_supply: metadata.total_supply,
        tokenType: metadata.type,
        identifier: metadata.identifier,
        token_uri: metadata.token_uri,
        lastUpdated: metadata.lastUpdated,
        tokenAContract: metadata.tokenAContract,
        tokenBContract: metadata.tokenBContract,
        lpRebatePercent: metadata.lpRebatePercent,
        externalPoolId: metadata.externalPoolId,
        engineContractId: metadata.engineContractId,
        baseToken: metadata.base,
        userBalances: {}, // Start with empty balances
        timestamp: now,
        metadataSource: 'startup-load'
      };

      enhancedTokenRecords.set(metadata.contractId, enhancedRecord);
    }

    console.log(`🏷️ Created enhanced records for ${enhancedTokenRecords.size} tokens`);
    return enhancedTokenRecords;

  } catch (error) {
    console.error('🏷️ Failed to load token metadata:', error);
    return new Map();
  }
}

/**
 * Create a BALANCE_UPDATE message from enhanced token record and user balance info
 */
export function createBalanceUpdateMessage(
  enhancedRecord: EnhancedTokenRecord,
  userId: string,
  balanceInfo: EnhancedTokenRecord['userBalances'][string],
  subnetBalanceInfo?: {
    contractId: string;
    balance: number;
    totalSent: string;
    totalReceived: string;
    formattedBalance: number;
    timestamp: number;
    source: string;
  }
): BalanceUpdateMessage {

  return {
    type: 'BALANCE_UPDATE',
    userId,
    contractId: enhancedRecord.contractId,
    balance: balanceInfo.balance,
    totalSent: balanceInfo.totalSent,
    totalReceived: balanceInfo.totalReceived,
    formattedBalance: balanceInfo.formattedBalance,
    timestamp: balanceInfo.timestamp,
    source: balanceInfo.source,
    // Subnet balance fields
    subnetBalance: subnetBalanceInfo?.balance,
    formattedSubnetBalance: subnetBalanceInfo?.formattedBalance,
    subnetContractId: subnetBalanceInfo?.contractId,
    // Include all metadata fields
    name: enhancedRecord.name,
    symbol: enhancedRecord.symbol,
    decimals: enhancedRecord.decimals,
    description: enhancedRecord.description,
    image: enhancedRecord.image,
    total_supply: enhancedRecord.total_supply,
    tokenType: enhancedRecord.tokenType,
    identifier: enhancedRecord.identifier,
    token_uri: enhancedRecord.token_uri,
    lastUpdated: enhancedRecord.lastUpdated,
    tokenAContract: enhancedRecord.tokenAContract,
    tokenBContract: enhancedRecord.tokenBContract,
    lpRebatePercent: enhancedRecord.lpRebatePercent,
    externalPoolId: enhancedRecord.externalPoolId,
    engineContractId: enhancedRecord.engineContractId,
    baseToken: enhancedRecord.baseToken
  };
}

/**
 * User address validation
 */
export function isValidUserAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;

  // Standard Stacks address format
  const addressPattern = /^(SP|ST)[A-Z0-9]{38,39}$/;
  return addressPattern.test(address);
}