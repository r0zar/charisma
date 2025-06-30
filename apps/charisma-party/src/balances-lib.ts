import { getAccountBalances, callReadOnlyFunction } from '@repo/polyglot';
import { fetchMetadata } from '@repo/tokens';
import { principalCV } from '@stacks/transactions';
import type { BalanceUpdateMessage, TokenMetadata } from 'blaze-sdk/realtime';
import type { TokenSummary } from 'blaze-sdk';

export interface BalanceData {
  userId: string;
  contractId: string;
  balance: number;
  totalSent: string;
  totalReceived: string;
  timestamp: number;
  source: string;
}

// Enhanced token record that includes metadata and user balances (internal only)
export interface EnhancedTokenRecord extends TokenMetadata {
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
          console.log(`🔍 [SUBNET-DEBUG] Checking ${enhancedTokenRecords.size} token records for subnet tokens...`);

          const allTokens = Array.from(enhancedTokenRecords.values());
          const subnetTokens = allTokens.filter(record => record.type === 'SUBNET');

          console.log(`🔍 [SUBNET-DEBUG] Found ${subnetTokens.length} subnet tokens out of ${allTokens.length} total tokens`);

          if (subnetTokens.length > 0) {
            console.log(`🔍 [SUBNET-DEBUG] Subnet tokens found:`);
            subnetTokens.forEach(token => {
              console.log(`   - ${token.symbol} (${token.contractId}) | type: ${token.type} | base: ${token.base || 'undefined'}`);
            });

            console.log(`🏗️ Fetching ${subnetTokens.length} subnet token balances for ${userId}`);

            const subnetBalancePromises = subnetTokens.map(async (subnetRecord) => {
              try {
                console.log(`🔍 [SUBNET-DEBUG] Calling get-balance for ${subnetRecord.symbol} (${subnetRecord.contractId})`);
                const [addr, name] = subnetRecord.contractId.split('.');
                const balanceCV = await callReadOnlyFunction(addr!, name!, 'get-balance', [principalCV(userId)]);
                const balance = Number(balanceCV?.value || 0);

                console.log(`🔍 [SUBNET-DEBUG] ${subnetRecord.symbol} balance result: ${balance}`);

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
                } else {
                  console.log(`🔍 [SUBNET-DEBUG] ${subnetRecord.symbol} has zero balance for user ${userId.slice(0, 8)}...${userId.slice(-4)}`);
                }
              } catch (error) {
                console.error(`❌ Failed to fetch subnet balance for ${subnetRecord.contractId}:`, error);
              }
            });

            await Promise.allSettled(subnetBalancePromises);
          } else {
            console.log(`🔍 [SUBNET-DEBUG] No subnet tokens found - checking token types in metadata:`);
            allTokens.slice(0, 10).forEach(token => {
              console.log(`   - ${token.symbol} (${token.contractId}) | type: ${token.type} | base: ${token.base || 'undefined'}`);
            });
          }
        } else {
          console.log(`🔍 [SUBNET-DEBUG] No enhancedTokenRecords provided - subnet balance fetching skipped`);
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
 * Fetch enriched token data from token-summaries API
 * This includes metadata + price data + market caps
 */
export async function fetchTokenSummariesFromAPI(): Promise<TokenSummary[]> {
  const endpoint = process.env.TOKEN_SUMMARIES_URL ||
    process.env.NEXT_PUBLIC_TOKEN_SUMMARIES_URL ||
    'https://invest.charisma.rocks/api/v1/tokens/all?includePricing=true';

  try {
    console.log(`🔗 Fetching token summaries from ${endpoint}`);
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'charisma-party-balances'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('🔍 fetchTokenSummariesFromAPI: result', result);
    const summaries: TokenSummary[] = result.data.map((token: any) => ({
      contractId: token.contractId,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      type: token.type,
      identifier: token.identifier || token.contractId,
      description: token.description,
      image: token.image,
      token_uri: token.token_uri,
      total_supply: token.total_supply,
      lastUpdated: token.lastUpdated,
      tokenAContract: token.lpMetadata?.tokenA?.contractId,
      tokenBContract: token.lpMetadata?.tokenB?.contractId,
      lpRebatePercent: token.lpMetadata?.rebatePercent,
      externalPoolId: token.lpMetadata?.poolId,
      engineContractId: token.lpMetadata?.engineContractId,
      base: token.base,
      price: token.usdPrice ?? token.price,
      change1h: token.priceChange1h,
      change24h: token.priceChange24h,
      change7d: token.priceChange7d,
      marketCap: token.marketCap,
      verified: token.verified || false
    }));
    console.log(`✅ Fetched ${summaries.length} token summaries with price data from unified API`);
    return summaries;

  } catch (error) {
    console.error('🔗 Failed to fetch token summaries:', error);

    // Fallback to basic metadata
    console.log('🔄 Falling back to basic metadata...');
    const basicMetadata = await fetchMetadata();

    // Convert to TokenSummary format (without price data)
    return basicMetadata.map(metadata => ({
      contractId: metadata.contractId,
      name: metadata.name || `Token ${metadata.contractId}`,
      symbol: metadata.symbol || 'TKN',
      decimals: metadata.decimals || 6,
      type: metadata.type || 'SIP10',
      identifier: metadata.identifier || '',
      description: metadata.description,
      image: metadata.image,
      token_uri: metadata.token_uri,
      total_supply: metadata.total_supply,
      lastUpdated: metadata.lastUpdated,
      tokenAContract: metadata.tokenAContract,
      tokenBContract: metadata.tokenBContract,
      lpRebatePercent: metadata.lpRebatePercent,
      externalPoolId: metadata.externalPoolId,
      engineContractId: metadata.engineContractId,
      base: metadata.base,
      // Price data will be null for fallback
      price: null,
      change1h: null,
      change24h: null,
      change7d: null,
      marketCap: null,
      verified: false
    }));
  }
}

/**
 * Known subnet token mappings for fallback when API data is missing
 */
const KNOWN_SUBNET_MAPPINGS = new Map([
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1', 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.kangaroo-subnet', 'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1', 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.usda-token-subnet', 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken-subnet', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nope-subnet', 'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope'],
  ['SP2KGJEAZRDVK78ZWTRGSDE11A1VMZVEATNQFZ73C.world-peace-stacks-stxcity-subnet', 'SP14J806BWEPQAXVA0G6RYZN7GNA126B7JFRRYTEM.world-peace-stacks-stxcity'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-aeusdc-subnet', 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc']
]);

/**
 * Fix subnet base mappings using known mappings when API data is incomplete
 */
function fixSubnetMappings(enhancedTokenRecords: Map<string, EnhancedTokenRecord>): void {
  console.log('🔧 [SUBNET-FIX] Checking for missing subnet base mappings...');

  let fixedCount = 0;

  for (const [contractId, record] of enhancedTokenRecords) {
    if (record.type === 'SUBNET' && (!record.base || record.base === 'undefined')) {
      const knownBase = KNOWN_SUBNET_MAPPINGS.get(contractId);

      if (knownBase) {
        console.log(`🔧 [SUBNET-FIX] Fixing ${record.symbol} (${contractId}): undefined → ${knownBase}`);
        record.base = knownBase;
        fixedCount++;
      } else {
        console.log(`⚠️  [SUBNET-FIX] No known mapping for subnet token ${record.symbol} (${contractId})`);
      }
    }
  }

  console.log(`🔧 [SUBNET-FIX] Fixed ${fixedCount} subnet base mappings`);
}

/**
 * Create synthetic subnet token records from known mappings
 * This is needed because the API doesn't return subnet tokens
 */
function createSyntheticSubnetTokens(enhancedTokenRecords: Map<string, EnhancedTokenRecord>): void {
  console.log('🏗️ [SUBNET-SYNTHETIC] Creating synthetic subnet token records...');

  let createdCount = 0;
  const now = Date.now();

  for (const [subnetContractId, baseContractId] of KNOWN_SUBNET_MAPPINGS) {
    // Skip if subnet token already exists
    if (enhancedTokenRecords.has(subnetContractId)) {
      console.log(`🔧 [SUBNET-SYNTHETIC] Subnet token ${subnetContractId} already exists, skipping`);
      continue;
    }

    // Find the base token record
    const baseRecord = enhancedTokenRecords.get(baseContractId);
    if (!baseRecord) {
      console.log(`⚠️  [SUBNET-SYNTHETIC] Base token ${baseContractId} not found for subnet ${subnetContractId}`);
      continue;
    }

    // Create synthetic subnet token record based on base token
    const syntheticSubnetRecord: EnhancedTokenRecord = {
      // Core metadata copied from base token
      contractId: subnetContractId,
      name: `${baseRecord.name} (Subnet)`,
      symbol: `${baseRecord.symbol}`,
      decimals: baseRecord.decimals,
      type: 'SUBNET', // Mark as subnet type
      identifier: baseRecord.identifier,
      description: `${baseRecord.description} [Subnet version]`,
      image: baseRecord.image,
      token_uri: baseRecord.token_uri,
      total_supply: baseRecord.total_supply,
      lastUpdated: now,
      tokenAContract: baseRecord.tokenAContract,
      tokenBContract: baseRecord.tokenBContract,
      lpRebatePercent: baseRecord.lpRebatePercent,
      externalPoolId: baseRecord.externalPoolId,
      engineContractId: baseRecord.engineContractId,
      base: baseContractId, // Point to base token
      verified: baseRecord.verified,

      // Price data from base token (subnet should have same price)
      price: baseRecord.price,
      change1h: baseRecord.change1h,
      change24h: baseRecord.change24h,
      change7d: baseRecord.change7d,
      marketCap: null, // Subnet tokens don't have separate market cap

      // Internal tracking
      userBalances: {}, // Start with empty balances
      timestamp: now,
      metadataSource: 'synthetic-subnet-mapping'
    };

    enhancedTokenRecords.set(subnetContractId, syntheticSubnetRecord);
    createdCount++;

    console.log(`🏗️ [SUBNET-SYNTHETIC] Created subnet token: ${syntheticSubnetRecord.symbol} (${subnetContractId}) → base: ${baseContractId}`);
  }

  console.log(`🏗️ [SUBNET-SYNTHETIC] Created ${createdCount} synthetic subnet token records`);
}

/**
 * Load token metadata and create enhanced token records
 * Now uses enriched token summaries with price data
 */
export async function loadTokenMetadata(): Promise<Map<string, EnhancedTokenRecord>> {
  try {
    console.log('🏷️ Loading enriched token metadata with price data...');
    const tokenSummaries = await fetchTokenSummariesFromAPI();
    const now = Date.now();

    const enhancedTokenRecords = new Map<string, EnhancedTokenRecord>();

    for (const summary of tokenSummaries) {
      if (!summary.contractId) continue;

      // Create enhanced token record with enriched metadata (including prices)
      const enhancedRecord: EnhancedTokenRecord = {
        // Core metadata from TokenSummary (extends TokenMetadata)
        contractId: summary.contractId,
        name: summary.name,
        symbol: summary.symbol,
        decimals: summary.decimals,
        type: summary.type,
        identifier: summary.identifier,
        description: summary.description,
        image: summary.image,
        token_uri: summary.token_uri,
        total_supply: summary.total_supply,
        lastUpdated: summary.lastUpdated,
        tokenAContract: summary.tokenAContract,
        tokenBContract: summary.tokenBContract,
        lpRebatePercent: summary.lpRebatePercent,
        externalPoolId: summary.externalPoolId,
        engineContractId: summary.engineContractId,
        base: summary.base,
        verified: summary.verified,

        // Price and market data from token-summaries
        price: summary.price,
        change1h: summary.change1h,
        change24h: summary.change24h,
        change7d: summary.change7d,
        marketCap: summary.marketCap,

        // Internal tracking
        userBalances: {}, // Start with empty balances
        timestamp: now,
        metadataSource: summary.price !== null ? 'token-summaries-api' : 'fallback-metadata'
      };

      enhancedTokenRecords.set(summary.contractId, enhancedRecord);
    }

    // Create synthetic subnet token records from known mappings
    // This is needed because the API doesn't return subnet tokens
    createSyntheticSubnetTokens(enhancedTokenRecords);

    // Fix missing subnet base mappings using known mappings
    fixSubnetMappings(enhancedTokenRecords);

    console.log(`🏷️ Created enhanced records for ${enhancedTokenRecords.size} tokens`);
    console.log(`📊 ${Array.from(enhancedTokenRecords.values()).filter(r => r.price !== null).length} tokens have price data`);

    const subnetTokens = Array.from(enhancedTokenRecords.values()).filter(r => r.type === 'SUBNET');
    console.log(`🏗️ Found ${subnetTokens.length} subnet tokens with mappings:`);
    subnetTokens.forEach(token => {
      console.log(`   - ${token.symbol} (${token.contractId}) → base: ${token.base || 'undefined'}`);
    });

    return enhancedTokenRecords;

  } catch (error) {
    console.error('🏷️ Failed to load token metadata:', error);
    return new Map();
  }
}

// REMOVED: Server-side subnet merging logic - now handled client-side

/**
 * Create a BALANCE_UPDATE message from enhanced token record and user balance info
 * Simplified to send individual token data without server-side subnet merging
 */
export function createBalanceUpdateMessage(
  enhancedRecord: EnhancedTokenRecord,
  userId: string,
  balanceInfo: EnhancedTokenRecord['userBalances'][string]
): BalanceUpdateMessage {
  return {
    type: 'BALANCE_UPDATE',
    userId,
    contractId: enhancedRecord.contractId,

    // Core balance data
    balance: balanceInfo.balance,
    totalSent: balanceInfo.totalSent,
    totalReceived: balanceInfo.totalReceived,
    formattedBalance: balanceInfo.formattedBalance,
    timestamp: balanceInfo.timestamp,
    source: balanceInfo.source,

    // NO subnet balance fields - each token is sent separately
    // Client will merge mainnet + subnet tokens by base contract

    // Complete token metadata (includes price data, market data, etc.)
    metadata: {
      contractId: enhancedRecord.contractId,
      name: enhancedRecord.name,
      symbol: enhancedRecord.symbol,
      decimals: enhancedRecord.decimals,
      type: enhancedRecord.type,
      identifier: enhancedRecord.identifier,
      description: enhancedRecord.description,
      image: enhancedRecord.image,
      token_uri: enhancedRecord.token_uri,
      total_supply: enhancedRecord.total_supply,
      lastUpdated: enhancedRecord.lastUpdated,
      tokenAContract: enhancedRecord.tokenAContract,
      tokenBContract: enhancedRecord.tokenBContract,
      lpRebatePercent: enhancedRecord.lpRebatePercent,
      externalPoolId: enhancedRecord.externalPoolId,
      engineContractId: enhancedRecord.engineContractId,
      base: enhancedRecord.base,
      verified: enhancedRecord.verified,

      // Price and market data from token-summaries
      price: enhancedRecord.price,
      change1h: enhancedRecord.change1h,
      change24h: enhancedRecord.change24h,
      change7d: enhancedRecord.change7d,
      marketCap: enhancedRecord.marketCap
    },

    // Legacy fields for backward compatibility (populated for now)
    name: enhancedRecord.name,
    symbol: enhancedRecord.symbol,
    decimals: enhancedRecord.decimals,
    description: enhancedRecord.description,
    image: enhancedRecord.image,
    total_supply: enhancedRecord.total_supply,
    tokenType: enhancedRecord.type,
    identifier: enhancedRecord.identifier,
    token_uri: enhancedRecord.token_uri,
    lastUpdated: enhancedRecord.lastUpdated,
    tokenAContract: enhancedRecord.tokenAContract,
    tokenBContract: enhancedRecord.tokenBContract,
    lpRebatePercent: enhancedRecord.lpRebatePercent,
    externalPoolId: enhancedRecord.externalPoolId,
    engineContractId: enhancedRecord.engineContractId,
    baseToken: enhancedRecord.base
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