import { NextRequest, NextResponse } from 'next/server';
import { getAccountBalances, callReadOnlyFunction } from '@repo/polyglot';
import { principalCV } from '@stacks/transactions';
import { fetchMetadata } from '@repo/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get balance data for a specific address
 * GET /api/v1/balances/{address}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const url = new URL(request.url);
    const includeZero = url.searchParams.get('includeZero') === 'true';
    
    // Validate address format
    if (!address || !address.match(/^S[PTM][0-9A-Z]{39}$/)) {
      return NextResponse.json(
        { 
          error: 'Invalid Stacks address format',
          message: 'Address must be a valid Stacks address (SP/ST/SM + 39 characters)'
        },
        { status: 400 }
      );
    }

    console.log(`[BALANCE-API] Fetching balance for ${address} (includeZero: ${includeZero})`);

    // Get mainnet balance data from polyglot
    const balanceData = await getAccountBalances(address, { 
      unanchored: true,
      trim: true 
    });
    
    if (!balanceData) {
      return NextResponse.json(
        { error: 'Balance not found' },
        { status: 404 }
      );
    }

    // Get all tokens from metadata (cache this to avoid repeated calls)
    let allTokens: any[] = [];
    let subnetTokens: any[] = [];
    try {
      allTokens = await Promise.race([
        fetchMetadata(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Metadata timeout')), 2000))
      ]) as any[];
      subnetTokens = allTokens.filter((token: any) => token.type === 'SUBNET');
    } catch (error) {
      console.warn('[BALANCE-API] Failed to fetch metadata for subnet tokens, skipping subnet balances:', error);
    }
    
    // Create a map for quick decimal lookup
    const tokenDecimalsMap = new Map<string, number>();
    allTokens.forEach((token: any) => {
      if (token.contractId && token.decimals !== undefined) {
        tokenDecimalsMap.set(token.contractId, token.decimals);
      }
    });

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
        console.warn(`Failed to fetch subnet balance for ${token.contractId}:`, error);
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

    // Convert to simplified format for API response
    const fungibleTokens: Record<string, { balance: string; decimals?: number }> = {};
    
    Object.entries(balanceData.fungible_tokens || {}).forEach(([contractId, tokenData]) => {
      if (tokenData && tokenData.balance !== undefined) {
        // Include token if: includeZero is true OR balance is not '0'
        if (includeZero || (tokenData.balance && tokenData.balance !== '0')) {
          // Get correct decimals from metadata, fallback to 6
          const decimals = tokenDecimalsMap.get(contractId) || 6;
          fungibleTokens[contractId] = {
            balance: tokenData.balance || '0',
            decimals: decimals
          };
        }
      }
    });

    const response = {
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
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    });

  } catch (error) {
    console.error('[BALANCE-API] Error fetching balance:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch balance',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}