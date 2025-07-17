/**
 * Test Page: Unified Pricing Integration
 * 
 * This page demonstrates the complete integration of the unified price service
 * with the simple-swap app. It shows how the new pricing works alongside
 * existing app functionality.
 * 
 * Access this page at: /test-unified-pricing
 */

"use client";

import React, { useState } from 'react';
import { UnifiedPriceProvider, useUnifiedPrices } from '@/contexts/unified-price-context';
import {
  UnifiedTokenPriceDisplay,
  MultiTokenPriceDisplay,
  EnhancedSwapTokenSelector
} from '@/components/examples/unified-price-display';

// Sample tokens for testing
const SAMPLE_TOKENS = [
  { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', symbol: 'CHA' },
  { contractId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', symbol: 'sBTC' },
  { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.synthetic-welsh', symbol: 'sWELSH' },
  { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dme000-governance-token', symbol: 'DMG' },
];

function UnifiedPricingTestContent() {
  const [selectedToken, setSelectedToken] = useState<{ contractId: string; symbol: string } | null>(null);
  const [customTokenId, setCustomTokenId] = useState('');
  const [apiTestResult, setApiTestResult] = useState<any>(null);
  const [apiTestLoading, setApiTestLoading] = useState(false);

  const { error, clearError } = useUnifiedPrices();

  // Test the unified API endpoint
  const testUnifiedAPI = async () => {
    setApiTestLoading(true);
    setApiTestResult(null);

    try {
      const tokenIds = SAMPLE_TOKENS.map(t => t.contractId).join(',');
      const response = await fetch(`/api/price-stats/unified?contractIds=${encodeURIComponent(tokenIds)}`);
      const data = await response.json();
      setApiTestResult(data);
    } catch (error) {
      setApiTestResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setApiTestLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Unified Pricing Integration Test
        </h1>
        <p className="text-gray-600">
          Testing the integration of @services/prices with simple-swap
        </p>
      </div>

      {/* Global Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-red-700">
              <strong>Error:</strong> {error}
            </div>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800 text-sm underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Section 1: Individual Token Price Display */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Individual Token Price Display</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_TOKENS.map(token => (
            <div key={token.contractId} className="border border-gray-200 rounded-lg p-4">
              <UnifiedTokenPriceDisplay
                tokenId={token.contractId}
                symbol={token.symbol}
                showDetails={true}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Test Custom Token</h3>
          <div className="flex space-x-2">
            <input
              type="text"
              value={customTokenId}
              onChange={(e) => setCustomTokenId(e.target.value)}
              placeholder="Enter token contract ID..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                if (customTokenId.trim()) {
                  // This will trigger the useTokenPrice hook in the component
                  console.log('Testing custom token:', customTokenId);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={!customTokenId.trim()}
            >
              Test
            </button>
          </div>

          {customTokenId.trim() && (
            <div className="mt-4 border border-gray-200 rounded-lg p-4">
              <UnifiedTokenPriceDisplay
                tokenId={customTokenId.trim()}
                symbol="CUSTOM"
                showDetails={true}
              />
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Multi-Token Display */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Multi-Token Price Display</h2>
        <MultiTokenPriceDisplay tokens={SAMPLE_TOKENS} />
      </section>

      {/* Section 3: Enhanced Token Selector */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Enhanced Token Selector</h2>
        <div className="max-w-md">
          <EnhancedSwapTokenSelector
            selectedToken={selectedToken}
            onTokenSelect={setSelectedToken}
            availableTokens={SAMPLE_TOKENS}
          />
        </div>
      </section>

      {/* Section 4: API Endpoint Test */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Unified API Endpoint Test</h2>

        <div className="space-y-4">
          <div>
            <button
              onClick={testUnifiedAPI}
              disabled={apiTestLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {apiTestLoading ? 'Testing...' : 'Test /api/price-stats/unified'}
            </button>
          </div>

          {apiTestResult && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium mb-2">API Response:</h3>
              <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                {JSON.stringify(apiTestResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </section>

      {/* Section 5: Integration Comparison */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Integration Benefits</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-green-800 mb-2">✅ Before (Old Approach)</h3>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>• Separate price logic per app</li>
              <li>• Basic token pricing only</li>
              <li>• Limited caching strategies</li>
              <li>• Inconsistent data across apps</li>
              <li>• Manual price history management</li>
              <li>• No LP token intrinsic value</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-blue-800 mb-2">🚀 After (Unified Service)</h3>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>• Single source of truth for all pricing</li>
              <li>• Advanced LP token analysis</li>
              <li>• Sophisticated pathfinding algorithms</li>
              <li>• Consistent data across all apps</li>
              <li>• Optimized caching and storage</li>
              <li>• Market vs intrinsic price comparison</li>
              <li>• Arbitrage opportunity detection</li>
              <li>• Confidence scoring and reliability metrics</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Integration Status</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <div>✅ Price service core infrastructure</div>
            <div>✅ Simple-swap adapter implementation</div>
            <div>✅ React context integration</div>
            <div>✅ Enhanced UI components</div>
            <div>✅ API endpoint compatibility</div>
            <div>🚧 Production deployment (pending)</div>
            <div>🚧 Historical price data migration (pending)</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function UnifiedPricingTestPage() {
  return (
    <UnifiedPriceProvider autoRefreshInterval={30000}>
      <UnifiedPricingTestContent />
    </UnifiedPriceProvider>
  );
}