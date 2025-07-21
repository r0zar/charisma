import { NextRequest, NextResponse } from 'next/server';
import { ContractRegistry, createDefaultConfig } from '@services/contract-registry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'contractId parameter is required' },
        { status: 400 }
      );
    }

    const config = createDefaultConfig('price-scheduler');
    const registry = new ContractRegistry(config);

    const contract = await registry.getContract(contractId);
    
    if (!contract || !contract.tokenMetadata) {
      return NextResponse.json(
        { success: false, error: 'Token metadata not found' },
        { status: 404 }
      );
    }

    const metadata = {
      contractId: contract.tokenMetadata.contractId,
      symbol: contract.tokenMetadata.symbol,
      name: contract.tokenMetadata.name,
      decimals: contract.tokenMetadata.decimals,
      totalSupply: contract.tokenMetadata.total_supply,
      logoUri: contract.tokenMetadata.image,
      type: contract.tokenMetadata.type || 'STANDARD'
    };

    return NextResponse.json({
      success: true,
      data: metadata
    });

  } catch (error) {
    console.error('[Token Metadata API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractIds } = body;

    if (!contractIds || !Array.isArray(contractIds)) {
      return NextResponse.json(
        { success: false, error: 'contractIds array is required' },
        { status: 400 }
      );
    }

    const config = createDefaultConfig('price-scheduler');
    const registry = new ContractRegistry(config);

    const results: Record<string, any> = {};

    for (const contractId of contractIds) {
      try {
        const contract = await registry.getContract(contractId);
        
        if (contract && contract.tokenMetadata) {
          results[contractId] = {
            contractId: contract.tokenMetadata.contractId,
            symbol: contract.tokenMetadata.symbol,
            name: contract.tokenMetadata.name,
            decimals: contract.tokenMetadata.decimals,
            totalSupply: contract.tokenMetadata.total_supply,
            logoUri: contract.tokenMetadata.image,
            type: contract.tokenMetadata.type || 'STANDARD'
          };
        } else {
          results[contractId] = null;
        }
      } catch (error) {
        console.error(`[Token Metadata API] Error fetching ${contractId}:`, error);
        results[contractId] = null;
      }
    }

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('[Token Metadata API] Bulk fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}