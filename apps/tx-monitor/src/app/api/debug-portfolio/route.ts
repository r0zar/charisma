import { NextRequest, NextResponse } from 'next/server';
import { getAddressBalance, listPrices } from '@repo/tokens';

/**
 * Debug endpoint to test portfolio value calculation using @packages/tokens
 */
async function debugGetCurrentPortfolioValue(userAddress: string) {
  try {
    console.log(`[DEBUG] Fetching current portfolio value for ${userAddress} using @packages/tokens`);

    // Fetch user balance data using @packages/tokens
    const balanceData = await getAddressBalance(userAddress);
    console.log(`[DEBUG] Retrieved balance data for ${userAddress}`);

    // Fetch all current prices using @packages/tokens
    const priceData = await listPrices({
      strategy: 'fallback',
      sources: { stxtools: true, internal: true }
    });
    console.log(`[DEBUG] Retrieved ${Object.keys(priceData).length} price entries from @packages/tokens`);

    // Create price lookup map
    const priceMap = new Map<string, number>();
    for (const [contractId, price] of Object.entries(priceData)) {
      priceMap.set(contractId, price);
    }

    // Calculate portfolio value from balance data
    let totalValue = 0;
    const tokenBreakdown: { contractId: string; balance: number; value: number; price: number }[] = [];
    let tokensWithValue = 0;

    // Process STX balance
    if (balanceData.stxBalance && parseFloat(balanceData.stxBalance) > 0) {
      const stxBalance = parseFloat(balanceData.stxBalance) / 1_000_000; // Convert microSTX to STX
      const stxPrice = priceMap.get('.stx') || priceMap.get('stx') || 0;
      const stxValue = stxBalance * stxPrice;
      
      if (stxBalance > 0) {
        totalValue += stxValue;
        if (stxValue > 0) tokensWithValue++;
        tokenBreakdown.push({
          contractId: '.stx',
          balance: stxBalance,
          value: stxValue,
          price: stxPrice
        });
        console.log(`[DEBUG] STX: ${stxBalance.toFixed(6)} × $${stxPrice} = $${stxValue.toFixed(2)}`);
      }
    }

    // Process fungible tokens
    for (const [contractId, tokenData] of Object.entries(balanceData.fungibleTokens)) {
      const tokenInfo = tokenData as { balance: string; decimals?: number };
      const rawBalance = parseFloat(tokenInfo.balance);
      if (rawBalance <= 0) {
        continue;
      }

      // Convert raw balance to formatted balance using decimals
      const decimals = tokenInfo.decimals || 6;
      const formattedBalance = rawBalance / Math.pow(10, decimals);

      let price = priceMap.get(contractId) || 0;
      
      // Fallback for stablecoins
      if (price === 0 && (contractId.includes('usdc') || contractId.includes('USDC') ||
          contractId.includes('usdt') || contractId.includes('USDT') ||
          contractId.includes('dai') || contractId.includes('DAI'))) {
        price = 1.0;
      }
      
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
        totalTokens: Object.keys(balanceData.fungibleTokens).length + (balanceData.stxBalance ? 1 : 0),
        tokensWithValue,
        pricesAvailable: Object.keys(priceData).length
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