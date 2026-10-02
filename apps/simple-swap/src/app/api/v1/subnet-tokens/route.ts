import { NextRequest, NextResponse } from 'next/server';
import { CHA_SUBNET_V1, isListedSubnet } from '@/lib/cha-subnets';

export interface SubnetTokenInfo {
  contractId: string;
  base: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface SubnetTokensResponse {
  success: boolean;
  subnetTokens: SubnetTokenInfo[];
  pairings: Record<string, string>; // mainnet contractId -> subnet contractId
  error?: string;
}

/**
 * GET /api/v1/subnet-tokens
 * Returns all subnet tokens and their mainnet pairings
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Fetch metadata from token-cache API
    const TOKEN_CACHE = process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || process.env.TOKEN_CACHE_URL || 'https://tokens.charisma.rocks';
    const response = await fetch(`${TOKEN_CACHE}/api/v1/metadata`);
    
    if (!response.ok) {
      throw new Error(`Token cache API error: ${response.status}`);
    }
    
    const allTokens = await response.json();
    
    // Filter for subnet tokens (type=SUBNET with base property)
    const subnetTokens: SubnetTokenInfo[] = allTokens
      .filter((token: any) => token.type === 'SUBNET' && token.base)
      .map((token: any) => ({
        contractId: token.contractId,
        base: token.base,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 6
      }));
    
    // Create mainnet -> subnet pairing map. CHA has two subnets during the Blaze v2 migration: it pairs with the
    // v1 entry, which stands for both (balances are combined, spending picks the source)
    const pairings: Record<string, string> = {};
    subnetTokens.filter(t => isListedSubnet(t.contractId)).forEach(subnetToken => {
      pairings[subnetToken.base] = subnetToken.contractId;
    });
    const chaV1 = subnetTokens.find(t => t.contractId === CHA_SUBNET_V1);
    if (chaV1) pairings[chaV1.base] = chaV1.contractId;
    
    console.log(`[SubnetTokens] Found ${subnetTokens.length} subnet tokens with ${Object.keys(pairings).length} pairings`);
    
    const responseData: SubnetTokensResponse = {
      success: true,
      subnetTokens,
      pairings
    };
    
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' // Cache for 5 minutes
      }
    });
    
  } catch (error) {
    console.error('[SubnetTokens] Error:', error);
    
    const errorResponse: SubnetTokensResponse = {
      success: false,
      subnetTokens: [],
      pairings: {},
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}