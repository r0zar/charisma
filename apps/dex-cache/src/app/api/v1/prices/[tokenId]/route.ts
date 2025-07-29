import { NextResponse } from 'next/server';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Extended cache for bandwidth optimization: 5min fresh, 15min stale
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

interface RouteParams {
    tokenId: string;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<RouteParams> }
) {
    const startTime = Date.now();

    try {
        const { tokenId } = await params;
        const url = new URL(request.url);
        const includeDetails = url.searchParams.get('details') === 'true';

        if (!tokenId) {
            return NextResponse.json({
                status: 'error',
                error: 'Token ID is required'
            }, {
                status: 400,
                headers
            });
        }

        console.log(`[Price API] Fetching price for token: ${tokenId}`);

        // Fetch token price and metadata in parallel
        const lakehouseUrl = new URL('https://lakehouse.charisma.rocks/api/token-prices');
        lakehouseUrl.searchParams.set('token', tokenId);
        lakehouseUrl.searchParams.set('limit', '1');

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

        if (!lakehouseData.prices || lakehouseData.prices.length === 0) {
            return NextResponse.json({
                status: 'error',
                error: 'Token not found',
                message: `Token with ID ${tokenId} not found in price data`
            }, {
                status: 404,
                headers
            });
        }

        const priceData = lakehouseData.prices[0];
        const metadata = tokensData.find((token: TokenMetadata) => token.contractId === tokenId);
        const processingTime = Date.now() - startTime;

        // Transform lakehouse response with accurate metadata
        const transformedData = {
            tokenId: priceData.token_contract_id,
            symbol: metadata?.symbol || 'UNKNOWN',
            name: metadata?.name || 'Unknown Token',
            decimals: metadata?.decimals || 6,
            image: metadata?.image || '',
            usdPrice: priceData.usd_price,
            sbtcRatio: priceData.sbtc_price,
            confidence: Math.min(1, Math.max(0, 1 - (priceData.final_convergence_percent || 0) / 100)),
            lastUpdated: new Date(priceData.calculated_at).getTime(),
            totalLiquidity: 0,
            isLpToken: false,
            intrinsicValue: priceData.usd_price,
            marketPrice: priceData.usd_price
        };

        // Add calculation details if requested
        if (includeDetails) {
            (transformedData as any).calculationDetails = {
                priceSource: 'lakehouse',
                iterationsToConverge: priceData.iterations_to_converge,
                finalConvergencePercent: priceData.final_convergence_percent,
                calculatedAt: priceData.calculated_at
            };
        }

        console.log(`[Price API] Retrieved ${metadata?.symbol || 'UNKNOWN'} price in ${processingTime}ms: $${priceData.usd_price.toFixed(6)}`)

        return NextResponse.json({
            status: 'success',
            data: transformedData,
            metadata: {
                processingTimeMs: processingTime,
                includeDetails,
                lakehouseData: true,
                lastUpdated: lakehouseData.summary.last_updated
            }
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error(`[Price API] Error fetching price:`, error);

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

