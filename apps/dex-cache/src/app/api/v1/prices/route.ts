import { NextResponse } from 'next/server';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // SWR: Fresh for 5min, stale-but-valid for 15 minutes, background revalidation
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900'
};

interface TokenMetadata {
    name: string;
    symbol: string;
    decimals: number;
    description: string;
    image: string;
    contractId: string;
    total_supply: number;
    identifier: string;
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    const startTime = Date.now();

    try {
        const url = new URL(request.url);
        const token = url.searchParams.get('token');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const minPrice = parseFloat(url.searchParams.get('minPrice') || '0');

        // Fetch token prices and metadata in parallel
        const lakehouseUrl = new URL('https://lakehouse.charisma.rocks/api/token-prices');
        if (token) lakehouseUrl.searchParams.set('token', token);
        if (limit !== 100) lakehouseUrl.searchParams.set('limit', limit.toString());
        if (minPrice > 0) lakehouseUrl.searchParams.set('minPrice', minPrice.toString());

        console.log('[Prices API] Fetching from lakehouse and tokens APIs...');

        const [pricesResponse, tokensResponse] = await Promise.all([
            fetch(lakehouseUrl.toString(), {
                headers: { 'User-Agent': 'dex-cache/1.0' }
            }),
            fetch('https://tokens.charisma.rocks/api/v1/sip10', {
                headers: { 'User-Agent': 'dex-cache/1.0' }
            })
        ]);

        if (!pricesResponse.ok) {
            throw new Error(`Lakehouse API error: ${pricesResponse.status} ${pricesResponse.statusText}`);
        }

        if (!tokensResponse.ok) {
            throw new Error(`Tokens API error: ${tokensResponse.status} ${tokensResponse.statusText}`);
        }

        const [lakehouseData, tokensData] = await Promise.all([
            pricesResponse.json(),
            tokensResponse.json()
        ]);

        // Create token metadata lookup
        const tokenMetadata = new Map<string, TokenMetadata>();
        tokensData.forEach((token: TokenMetadata) => {
            tokenMetadata.set(token.contractId, token);
        });

        const processingTime = Date.now() - startTime;

        // Transform lakehouse response with accurate metadata
        const transformedData = {
            status: 'success',
            data: lakehouseData.prices.map((price: any) => {
                const metadata = tokenMetadata.get(price.token_contract_id);
                return {
                    tokenId: price.token_contract_id,
                    symbol: metadata?.symbol || 'UNKNOWN',
                    name: metadata?.name || 'Unknown Token',
                    decimals: metadata?.decimals || 6,
                    image: metadata?.image || '',
                    usdPrice: price.usd_price,
                    sbtcRatio: price.sbtc_price,
                    confidence: Math.min(1, Math.max(0, 1 - (price.final_convergence_percent || 0) / 100)),
                    lastUpdated: new Date(price.calculated_at).getTime(),
                    totalLiquidity: 0,
                    isLpToken: false,
                    intrinsicValue: price.usd_price,
                    marketPrice: price.usd_price
                };
            }),
            metadata: {
                count: lakehouseData.prices.length,
                totalTokensAvailable: lakehouseData.summary.total_tokens,
                processingTimeMs: processingTime,
                lakehouseData: true,
                lastUpdated: lakehouseData.summary.last_updated,
                queryParams: lakehouseData.query_params
            }
        };

        console.log(`[Prices API] Retrieved ${lakehouseData.prices.length} prices in ${processingTime}ms`);

        return NextResponse.json(transformedData, { status: 200, headers });

    } catch (error: any) {
        console.error('[Prices API] Error fetching prices:', error);

        const processingTime = Date.now() - startTime;

        return NextResponse.json({
            status: 'error',
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
            metadata: {
                processingTimeMs: processingTime
            }
        }, {
            status: 500,
            headers
        });
    }
}

