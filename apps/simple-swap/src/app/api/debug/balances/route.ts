import { NextRequest, NextResponse } from 'next/server';
import { getAccountBalancesWithSubnet, getBalancesAction } from '@/app/actions';
import { balanceClient } from '@repo/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint for balance investigation
 * GET /api/debug/balances?address=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[DEBUG] Starting balance debug for ${address}`);

    const debugData: any = {
      address,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Direct balance client call
    try {
      console.log('[DEBUG] Testing direct balance client...');
      const clientResult = await balanceClient.getAddressBalances(address, true);
      debugData.tests.balanceClient = {
        success: !!clientResult,
        tokenCount: clientResult ? Object.keys(clientResult.fungibleTokens).length : 0,
        stxBalance: clientResult?.stxBalance,
        sampleTokens: clientResult ? Object.entries(clientResult.fungibleTokens)
          .slice(0, 5)
          .map(([contractId, data]) => ({ contractId, balance: data.balance })) : [],
        fullResult: clientResult
      };
    } catch (error) {
      debugData.tests.balanceClient = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: Server action call
    try {
      console.log('[DEBUG] Testing server action...');
      const actionResult = await getBalancesAction([address], undefined, true);
      debugData.tests.serverAction = {
        success: actionResult.success,
        hasBalances: !!actionResult.balances,
        addressExists: !!(actionResult.balances && actionResult.balances[address]),
        tokenCount: actionResult.balances?.[address] ? Object.keys(actionResult.balances[address].fungibleTokens).length : 0,
        sampleTokens: actionResult.balances?.[address] ? Object.entries(actionResult.balances[address].fungibleTokens)
          .slice(0, 5)
          .map(([contractId, data]) => ({ contractId, balance: data.balance })) : [],
        fullResult: actionResult
      };
    } catch (error) {
      debugData.tests.serverAction = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 3: Original polyglot method
    try {
      console.log('[DEBUG] Testing original polyglot method...');
      const polyglotResult = await getAccountBalancesWithSubnet(address, { trim: true });
      debugData.tests.polyglot = {
        success: !!polyglotResult,
        hasStx: !!(polyglotResult?.stx),
        hasFungibleTokens: !!(polyglotResult?.fungible_tokens),
        tokenCount: polyglotResult?.fungible_tokens ? Object.keys(polyglotResult.fungible_tokens).length : 0,
        stxBalance: polyglotResult?.stx?.balance,
        sampleTokens: polyglotResult?.fungible_tokens ? Object.entries(polyglotResult.fungible_tokens)
          .slice(0, 5)
          .map(([contractId, data]) => ({ contractId, balance: data.balance })) : [],
        fullResult: polyglotResult
      };
    } catch (error) {
      debugData.tests.polyglot = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 4: Check specific token balance
    const testTokens = [
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dme000-governance-token',
      'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'
    ];

    debugData.tests.specificTokens = {};
    
    for (const tokenContract of testTokens) {
      try {
        const tokenBalance = await balanceClient.getTokenBalance(address, tokenContract);
        debugData.tests.specificTokens[tokenContract] = {
          success: true,
          balance: tokenBalance
        };
      } catch (error) {
        debugData.tests.specificTokens[tokenContract] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Test 5: Environment info
    debugData.environment = {
      nodeEnv: process.env.NODE_ENV,
      baseUrl: typeof window !== 'undefined' ? 'client-side' : balanceClient['BASE_URL'],
      timestamp: Date.now()
    };

    console.log(`[DEBUG] Debug complete for ${address}`);

    return NextResponse.json(debugData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('[DEBUG] Error in debug endpoint:', error);
    
    return NextResponse.json(
      { 
        error: 'Debug endpoint failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}