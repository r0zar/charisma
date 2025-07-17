import { NextRequest, NextResponse } from 'next/server';
import { getHostUrl } from '@modules/discovery';

// Types for charisma-party API responses (normalized format)
interface BalanceResponse {
  balances: Record<string, number>; // contractId -> balance (formatted units)
  party: string;
  serverTime: number;
  initialized: boolean;
}

interface PriceUpdate {
  type: 'PRICE_UPDATE';
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}

interface PriceResponse {
  prices: PriceUpdate[];
  party: string;
  serverTime: number;
  initialized: boolean;
}

/**
 * Debug endpoint to test portfolio value calculation
 */
async function debugGetCurrentPortfolioValue(userAddress: string) {
  try {
    const charismaPartyUrl = getHostUrl('party');

    console.log(`[DEBUG] Fetching current portfolio value from ${charismaPartyUrl}`);

    // First test if we can reach prices endpoint
    const priceTestResponse = await fetch(`${charismaPartyUrl}/parties/prices/main`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`[DEBUG] Price test response status: ${priceTestResponse.status}`);

    // Fetch user balances from charisma-party
    const balanceResponse = await fetch(`${charismaPartyUrl}/parties/balances/main?users=${userAddress}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`[DEBUG] Balance response status: ${balanceResponse.status}`);

    if (!balanceResponse.ok) {
      console.warn(`[DEBUG] Failed to fetch balances: ${balanceResponse.status} ${balanceResponse.statusText}`);
      const errorText = await balanceResponse.text();
      console.warn(`[DEBUG] Balance response error:`, errorText);
      return { error: 'Failed to fetch balances', status: balanceResponse.status, details: errorText };
    }

    const balanceData: BalanceResponse = await balanceResponse.json();
    console.log(`[DEBUG] Retrieved ${Object.keys(balanceData.balances).length} balance entries`);

    // Fetch all current prices
    const priceResponse = await fetch(`${charismaPartyUrl}/parties/prices/main`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`[DEBUG] Price response status: ${priceResponse.status}`);

    if (!priceResponse.ok) {
      console.warn(`[DEBUG] Failed to fetch prices: ${priceResponse.status} ${priceResponse.statusText}`);
      const errorText = await priceResponse.text();
      console.warn(`[DEBUG] Price response error:`, errorText);
      return { error: 'Failed to fetch prices', status: priceResponse.status, details: errorText };
    }

    const priceData: PriceResponse = await priceResponse.json();
    console.log(`[DEBUG] Retrieved ${priceData.prices?.length || 0} price entries`);

    // Create price lookup map
    const priceMap = new Map<string, number>();
    for (const priceUpdate of priceData.prices) {
      priceMap.set(priceUpdate.contractId, priceUpdate.price);
    }

    // Calculate portfolio value from normalized balance format
    let totalValue = 0;
    const tokenBreakdown: { contractId: string; balance: number; value: number; price: number }[] = [];
    let tokensWithValue = 0;

    for (const [contractId, formattedBalance] of Object.entries(balanceData.balances)) {
      if (formattedBalance <= 0) {
        continue;
      }

      const price = priceMap.get(contractId) || 0;
      const value = formattedBalance * price;

      totalValue += value;

      if (value > 0) {
        tokensWithValue++;
        tokenBreakdown.push({
          contractId,
          balance: formattedBalance,
          value,
          price
        });
      }

      console.log(`[DEBUG] ${contractId}: ${formattedBalance.toFixed(6)} × $${price} = $${value.toFixed(2)}`);
    }

    console.log(`[DEBUG] Total current portfolio value: $${totalValue.toFixed(2)}`);

    return {
      success: true,
      currentPortfolioValue: totalValue,
      tokenBreakdown: tokenBreakdown.slice(0, 10), // Only return top 10 for brevity
      summary: {
        totalTokens: Object.keys(balanceData.balances).length,
        tokensWithValue,
        pricesAvailable: priceData.prices.length
      }
    };

  } catch (error) {
    console.error(`[DEBUG] Error fetching current portfolio value:`, error);
    return { error: 'Exception occurred', details: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('owner');

    if (!userAddress) {
      return NextResponse.json({ error: 'Missing owner parameter' }, { status: 400 });
    }

    const result = await debugGetCurrentPortfolioValue(userAddress);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Debug portfolio endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}