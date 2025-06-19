'use client';

import { BlazeProvider, useBlaze } from 'blaze-sdk/realtime';

const RealtimeDashboard = () => {
  // Subscribe to all prices and metadata
  const { prices, metadata, balances, isConnected, lastUpdate } = useBlaze();

  const formatPrice = (price: number): string => {
    if (price >= 1) {
      return price.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
    } else if (price >= 0.000001) {
      return price.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 6,
        maximumFractionDigits: 8
      });
    } else {
      return `$${price.toExponential(2)}`;
    }
  };

  const getTimeSince = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  // Merge prices with metadata
  const tokensWithData = Object.keys(prices).map(contractId => ({
    contractId,
    price: prices[contractId],
    metadata: metadata[contractId],
    balances: balances[`${contractId}::${metadata[contractId]?.identifier}`]
  })).sort((a, b) => (b.price?.timestamp || 0) - (a.price?.timestamp || 0));

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>
            🚀 Real-time Data Dashboard
          </h1>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '16px' }}>
            Live token prices and metadata powered by Blaze SDK
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '6px 12px',
            backgroundColor: isConnected ? '#dcfce7' : '#fef2f2',
            borderRadius: '6px',
            border: `1px solid ${isConnected ? '#16a34a' : '#dc2626'}`,
            fontSize: '14px',
            fontWeight: '600',
            color: isConnected ? '#16a34a' : '#dc2626'
          }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>

          <div style={{ fontSize: '14px', color: '#64748b' }}>
            {Object.keys(prices).length} prices • {Object.keys(metadata).length} metadata
          </div>
        </div>
      </div>

      {/* Token List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f8fafc'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
            📈 Live Token Data ({tokensWithData.length} tokens)
          </h2>
        </div>

        {tokensWithData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            Waiting for token data...
          </div>
        ) : (
          tokensWithData.map(token => (
            <div
              key={token.contractId}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                gap: '16px'
              }}
            >
              {/* Token Image */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                border: '2px solid #e5e7eb'
              }}>
                {token.metadata?.imageUrl ? (
                  <img
                    src={token.metadata.imageUrl}
                    alt={token.metadata.symbol || token.metadata.name || 'Token'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#6b7280'
                  }}>
                    {(token.metadata?.symbol || token.metadata?.name || token.contractId).slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Token Details */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '4px'
                }}>
                  {token.metadata?.name || token.contractId}
                  {token.metadata?.symbol && (
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#6b7280',
                      marginLeft: '8px'
                    }}>
                      ({token.metadata.symbol})
                    </span>
                  )}
                </div>

                <div style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#9ca3af',
                  marginBottom: '4px'
                }}>
                  {token.contractId}
                </div>

                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {token.price?.source} • {token.price ? getTimeSince(token.price.timestamp) : 'No price data'}
                </div>
              </div>

              {/* Price */}
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color: token.price ? '#059669' : '#9ca3af',
                textAlign: 'right'
              }}>
                {token.price ? formatPrice(token.price.price) : '—'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const RealtimeDashboardWrapper = () => {
  return (
    <BlazeProvider>
      <RealtimeDashboard />
    </BlazeProvider>
  );
};

export default RealtimeDashboardWrapper;