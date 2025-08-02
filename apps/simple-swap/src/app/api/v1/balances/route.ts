import { NextRequest, NextResponse } from 'next/server';
import { getAccountBalances, callReadOnlyFunction } from '@repo/polyglot';
import { principalCV } from '@stacks/transactions';
import { fetchMetadata } from '@repo/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get balance data for multiple addresses
 * POST /api/v1/balances
 * Body: { addresses: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { addresses, includeZeroBalances = false } = body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          message: 'Body must contain an array of addresses'
        },
        { status: 400 }
      );
    }

    if (addresses.length === 0) {
      return NextResponse.json({ balances: {} });
    }

    if (addresses.length > 20) {
      return NextResponse.json(
        { 
          error: 'Too many addresses',
          message: 'Maximum 20 addresses allowed per request'
        },
        { status: 400 }
      );
    }

    // Validate all addresses
    const invalidAddresses = addresses.filter(addr => 
      !addr || !addr.match(/^S[PTM][0-9A-Z]{39}$/)
    );
    
    if (invalidAddresses.length > 0) {
      return NextResponse.json(
        { 
          error: 'Invalid address format',
          message: `Invalid addresses: ${invalidAddresses.join(', ')}`
        },
        { status: 400 }
      );
    }

    console.log(`[BALANCE-API] Fetching balances for ${addresses.length} addresses`);

    // Get subnet tokens once for all addresses (with timeout to avoid hanging)
    let subnetTokens: any[] = [];
    try {
      const allTokens = await Promise.race([
        fetchMetadata(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Metadata timeout')), 2000))
      ]) as any[];
      subnetTokens = allTokens.filter((token: any) => token.type === 'SUBNET');
    } catch (error) {
      console.warn('[BALANCE-API] Failed to fetch metadata for subnet tokens, skipping subnet balances:', error);
    }

    // Fetch balances concurrently
    const results = await Promise.allSettled(
      addresses.map(async (address: string) => {
        try {
          // Get mainnet balance data
          const balanceData = await getAccountBalances(address, { 
            unanchored: true,
            trim: true 
          });

          if (!balanceData) {
            return { address, error: 'Balance not found' };
          }

          // Fetch subnet balances in parallel
          const subnetBalancePromises = subnetTokens.map(async (token: any) => {
            try {
              const [contractAddress, contractName] = token.contractId.split('.');
              const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                'get-balance',
                [principalCV(address)]
              );

              const balance = result?.value ? String(result.value) : '0';
              return { contractId: token.contractId, balance };
            } catch (error) {
              return { contractId: token.contractId, balance: '0' };
            }
          });

          const subnetBalances = await Promise.all(subnetBalancePromises);

          // Add subnet balances to the fungible_tokens object
          if (!balanceData.fungible_tokens) {
            balanceData.fungible_tokens = {};
          }

          subnetBalances.forEach(({ contractId, balance }) => {
            if (balance !== '0') {
              balanceData.fungible_tokens[contractId] = {
                balance,
                total_sent: '0',
                total_received: balance,
              };
            }
          });
          
          const fungibleTokens: Record<string, { balance: string; decimals?: number }> = {};
          
          Object.entries(balanceData.fungible_tokens || {}).forEach(([contractId, tokenData]) => {
            if (tokenData && tokenData.balance !== undefined) {
              // Include token if: includeZeroBalances is true OR balance is not '0'
              if (includeZeroBalances || (tokenData.balance && tokenData.balance !== '0')) {
                fungibleTokens[contractId] = {
                  balance: tokenData.balance || '0',
                  decimals: 6 // Default decimals
                };
              }
            }
          });

          return {
            address,
            balance: {
              address,
              lastUpdated: new Date().toISOString(),
              source: 'stacks-api',
              stxBalance: balanceData.stx?.balance || '0',
              fungibleTokens,
              nonFungibleTokens: balanceData.non_fungible_tokens || {},
              metadata: {
                cacheSource: 'live',
                tokenCount: Object.keys(fungibleTokens).length,
                nftCount: Object.keys(balanceData.non_fungible_tokens || {}).length,
                stxLocked: balanceData.stx?.locked || '0',
                stxTotalSent: balanceData.stx?.total_sent || '0',
                stxTotalReceived: balanceData.stx?.total_received || '0'
              }
            }
          };
        } catch (error) {
          console.warn(`[BALANCE-API] Failed to fetch balance for ${address}:`, error);
          return { address, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    // Process results
    const balances: Record<string, any> = {};
    const errors: Record<string, string> = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        if ('balance' in result.value) {
          balances[result.value.address] = result.value.balance;
        } else if ('error' in result.value) {
          errors[result.value.address] = result.value.error;
        }
      } else {
        errors[addresses[index]] = 'Request failed';
      }
    });

    const response = {
      success: true,
      balances,
      ...(Object.keys(errors).length > 0 && { errors }),
      meta: {
        timestamp: new Date().toISOString(),
        total: addresses.length,
        successful: Object.keys(balances).length,
        failed: Object.keys(errors).length
      }
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    });

  } catch (error) {
    console.error('[BALANCE-API] Error processing bulk balance request:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process balance request',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}