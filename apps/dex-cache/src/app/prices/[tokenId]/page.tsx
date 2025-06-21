import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import TokenHeader from '@/components/token/TokenHeader';
import TokenMetrics from '@/components/token/TokenMetrics';
import PoolBreakdownTable from '@/components/token/PoolBreakdownTable';
import PricePathVisualizer from '@/components/token/PricePathVisualizer';
import LiquidityAnalysis from '@/components/token/LiquidityAnalysis';
import { getTokenPrice } from '@/lib/pricing/price-calculator';
import { getPriceGraph } from '@/lib/pricing/price-graph';
import { listVaultTokens } from '@/lib/pool-service';

// Revalidate every 30 seconds for real-time pricing
export const revalidate = 30;

interface TokenDetailPageProps {
  params: Promise<{
    tokenId: string;
  }>;
}

export async function generateMetadata({ params }: TokenDetailPageProps): Promise<Metadata> {
  const { tokenId } = await params;
  
  try {
    // Get token metadata
    const allTokens = await listVaultTokens();
    const tokenMeta = allTokens.find(t => t.contractId === tokenId);
    
    if (!tokenMeta) {
      return {
        title: 'Token Not Found | Charisma Invest',
        description: 'The requested token could not be found.',
      };
    }

    // Get price data
    const priceData = await getTokenPrice(tokenId);
    const priceText = priceData?.usdPrice 
      ? `$${priceData.usdPrice.toFixed(6)}` 
      : 'Price Unavailable';

    return {
      title: `${tokenMeta.symbol} (${tokenMeta.name}) - ${priceText} | Charisma Invest`,
      description: `Real-time ${tokenMeta.symbol} token analysis with multi-path price discovery, pool breakdown, and liquidity analysis. Current price: ${priceText}`,
      keywords: `${tokenMeta.symbol}, ${tokenMeta.name}, Token Price, Stacks, sBTC, Price Discovery, Liquidity Pools, DEX`,
      openGraph: {
        title: `${tokenMeta.symbol} Token Analysis - ${priceText}`,
        description: `Comprehensive analysis of ${tokenMeta.name} with real-time pricing and pool breakdown`,
        url: `https://invest.charisma.rocks/prices/${tokenId}`,
        siteName: 'Charisma Invest',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${tokenMeta.symbol} - ${priceText}`,
        description: `Real-time ${tokenMeta.name} analysis with multi-path price discovery`,
      },
    };
  } catch (error) {
    return {
      title: 'Token Analysis | Charisma Invest',
      description: 'Token analysis and pricing information',
    };
  }
}

export default async function TokenDetailPage({ params }: TokenDetailPageProps) {
  const { tokenId } = await params;
  
  // Basic validation
  if (!tokenId || (!tokenId.includes('.') && tokenId !== '.stx')) {
    console.error("Invalid tokenId in route:", tokenId);
    notFound();
  }
  
  try {
    // Get all required data in parallel
    const [allTokens, priceData, graph] = await Promise.all([
      listVaultTokens(),
      getTokenPrice(tokenId),
      getPriceGraph()
    ]);

    // Find token metadata
    const tokenMeta = allTokens.find(t => t.contractId === tokenId);
    
    if (!tokenMeta) {
      notFound();
    }

    // Get token-specific data from graph
    const tokenNode = graph.getNode(tokenId) || null;
    const pathsToSbtc = graph.findPathsToSbtc(tokenId);
    
    // Get all pools that contain this token
    const allPools = graph.getAllPools();
    const tokenPools = allPools.filter(pool => 
      pool.tokenA === tokenId || pool.tokenB === tokenId
    );

    return (
      <main className="flex-1 container py-8">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/prices">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Prices
            </Button>
          </Link>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/prices" className="hover:text-foreground">
              Prices
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{tokenMeta.symbol}</span>
          </div>
        </div>

        {/* Token Header */}
        <TokenHeader 
          tokenMeta={tokenMeta}
          priceData={priceData}
        />

        {/* Core Metrics */}
        <TokenMetrics 
          tokenMeta={tokenMeta}
          priceData={priceData}
          tokenNode={tokenNode}
          poolCount={tokenPools.length}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-8">
          {/* Left Column - Pool Breakdown */}
          <div className="xl:col-span-2 space-y-6">
            <PoolBreakdownTable 
              tokenId={tokenId}
              tokenSymbol={tokenMeta.symbol}
              pools={tokenPools}
              allTokens={allTokens}
            />
            
            <PricePathVisualizer 
              tokenSymbol={tokenMeta.symbol}
              paths={pathsToSbtc}
              primaryPath={priceData?.primaryPath}
              alternativePaths={priceData?.alternativePaths || []}
              allTokens={allTokens}
            />
          </div>

          {/* Right Column - Liquidity Analysis */}
          <div className="space-y-6">
            <LiquidityAnalysis 
              tokenSymbol={tokenMeta.symbol}
              pools={tokenPools}
              tokenNode={tokenNode}
              totalLiquidity={priceData?.calculationDetails?.totalLiquidity || 0}
              allTokenNodes={graph.getAllTokens()}
            />

            {/* Technical Information Card */}
            <div className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Technical Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract ID:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {tokenId.length > 20 ? `${tokenId.slice(0, 20)}...` : tokenId}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decimals:</span>
                  <span>{tokenMeta.decimals}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Pools:</span>
                  <span>{tokenPools.length}</span>
                </div>
                
                {priceData?.calculationDetails && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paths Used:</span>
                      <span>{priceData.calculationDetails.pathsUsed}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">BTC Anchor:</span>
                      <span>${priceData.calculationDetails.btcPrice.toLocaleString()}</span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>
                    {priceData ? new Date(priceData.lastUpdated).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error('[TokenDetailPage] Error loading token data:', error);
    notFound();
  }
}