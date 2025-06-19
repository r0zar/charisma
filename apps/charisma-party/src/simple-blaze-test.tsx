'use client';

import { useState, useEffect } from 'react';
import usePartySocket from 'partysocket/react';

// Simple direct useBlaze implementation that was working
export function useBlaze() {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [balances, setBalances] = useState<Record<string, any>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Determine host based on environment
  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const partyHost = isDev ? 
    (typeof window !== 'undefined' ? `${window.location.hostname}:1999` : 'localhost:1999') : 
    'charisma-party.r0zar.partykit.dev';

  // Prices socket
  const pricesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'prices',
    onOpen: () => {
      console.log('✅ Connected to prices server');
      setIsConnected(true);
      // Subscribe to all prices
      if (pricesSocket) {
        pricesSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          contractIds: [], // Empty = subscribe to all
          clientId: 'simple-blaze-test'
        }));
      }
    },
    onClose: () => {
      console.log('🔌 Disconnected from prices server');
      setIsConnected(false);
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'PRICE_UPDATE':
            setPrices(prev => ({
              ...prev,
              [data.contractId]: {
                price: data.price,
                timestamp: data.timestamp,
                source: data.source
              }
            }));
            setLastUpdate(Date.now());
            break;

          case 'PRICE_BATCH':
            const newPrices: Record<string, any> = {};
            data.prices.forEach((price: any) => {
              newPrices[price.contractId] = {
                price: price.price,
                timestamp: price.timestamp,
                source: price.source
              };
            });
            setPrices(prev => ({ ...prev, ...newPrices }));
            setLastUpdate(Date.now());
            break;

          case 'SERVER_INFO':
            console.log('Prices server info:', data);
            break;

          case 'ERROR':
            console.error('Prices server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing prices message:', error);
      }
    }
  });

  // Metadata socket
  const metadataSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'metadata',
    onOpen: () => {
      console.log('✅ Connected to metadata server');
      // Subscribe to all metadata
      if (metadataSocket) {
        metadataSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          contractIds: [], // Empty = subscribe to all
          clientId: 'simple-blaze-test'
        }));
      }
    },
    onClose: () => {
      console.log('🔌 Disconnected from metadata server');
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'METADATA_UPDATE':
            setMetadata(prev => ({
              ...prev,
              [data.contractId]: {
                contractId: data.contractId,
                name: data.metadata.name || 'Unknown Token',
                symbol: data.metadata.symbol || 'TKN',
                decimals: data.metadata.decimals || 6,
                imageUrl: data.metadata.image,
                verified: true,
                timestamp: data.timestamp || Date.now()
              }
            }));
            setLastUpdate(Date.now());
            break;

          case 'METADATA_BATCH':
            const newMetadata: Record<string, any> = {};
            data.metadata.forEach((meta: any) => {
              newMetadata[meta.contractId] = {
                contractId: meta.contractId,
                name: meta.metadata.name || 'Unknown Token',
                symbol: meta.metadata.symbol || 'TKN',
                decimals: meta.metadata.decimals || 6,
                imageUrl: meta.metadata.image,
                verified: true,
                timestamp: meta.timestamp || Date.now()
              };
            });
            setMetadata(prev => ({ ...prev, ...newMetadata }));
            setLastUpdate(Date.now());
            break;

          case 'SERVER_INFO':
            console.log('Metadata server info:', data);
            break;

          case 'ERROR':
            console.error('Metadata server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing metadata message:', error);
      }
    }
  });

  // Balances socket
  const balancesSocket = usePartySocket({
    host: partyHost,
    room: 'main',
    party: 'balances',
    onOpen: () => {
      console.log('✅ Connected to balances server');
      // Subscribe to all balances
      if (balancesSocket) {
        balancesSocket.send(JSON.stringify({
          type: 'SUBSCRIBE',
          userIds: [], // Empty = subscribe to all
          clientId: 'simple-blaze-test'
        }));
      }
    },
    onClose: () => {
      console.log('🔌 Disconnected from balances server');
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'BALANCE_UPDATE':
            // Extract base contractId (before :: if present)
            const baseContractId = data.contractId?.split('::')[0];
            if (baseContractId && data.userId && data.balance !== undefined) {
              setBalances(prev => ({
                ...prev,
                [`${data.userId}:${baseContractId}`]: {
                  balance: data.balance,
                  totalSent: data.totalSent || '0',
                  totalReceived: data.totalReceived || '0',
                  timestamp: data.timestamp || Date.now(),
                  source: data.source || 'realtime'
                }
              }));
              setLastUpdate(Date.now());
            }
            break;

          case 'BALANCE_BATCH':
            if (data.balances && Array.isArray(data.balances)) {
              const newBalances: Record<string, any> = {};
              data.balances.forEach((balance: any) => {
                const baseContractId = balance.contractId?.split('::')[0];
                if (baseContractId && balance.userId && balance.balance !== undefined) {
                  newBalances[`${balance.userId}:${baseContractId}`] = {
                    balance: balance.balance,
                    totalSent: balance.totalSent || '0',
                    totalReceived: balance.totalReceived || '0',
                    timestamp: balance.timestamp || Date.now(),
                    source: balance.source || 'realtime'
                  };
                }
              });
              setBalances(prev => ({ ...prev, ...newBalances }));
              setLastUpdate(Date.now());
            }
            break;

          case 'SERVER_INFO':
            console.log('Balances server info:', data);
            break;

          case 'ERROR':
            console.error('Balances server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('Error parsing balances message:', error);
      }
    }
  });

  return {
    prices,
    metadata,
    balances,
    isConnected,
    lastUpdate
  };
}

const SimpleBlazeTest = () => {
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

  const formatBalance = (balance: string, decimals: number = 6): string => {
    const num = parseInt(balance) / Math.pow(10, decimals);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    } else if (num >= 1) {
      return num.toFixed(2);
    } else {
      return num.toFixed(6);
    }
  };

  // Get unique users from balances
  const uniqueUsers = Array.from(new Set(
    Object.keys(balances).map(key => key.split(':')[0])
  ));

  // Merge prices with metadata and balances
  const tokensWithData = Object.keys(prices).map(contractId => {
    // Get all balances for this token across all users
    const tokenBalances = Object.entries(balances)
      .filter(([key]) => key.endsWith(`:${contractId}`))
      .map(([key, balance]) => ({
        userId: key.split(':')[0],
        ...balance
      }));

    return {
      contractId,
      price: prices[contractId],
      metadata: metadata[contractId],
      balances: tokenBalances
    };
  }).sort((a, b) => (b.price?.timestamp || 0) - (a.price?.timestamp || 0));

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
            🚀 Simple Blaze Test (Working Version)
          </h1>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '16px' }}>
            Direct PartySocket connections
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
            {Object.keys(prices).length} prices • {Object.keys(metadata).length} metadata • {Object.keys(balances).length} balances • {uniqueUsers.length} users
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

                {/* User Balances */}
                {token.balances && token.balances.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                      USER BALANCES ({token.balances.length})
                    </div>
                    {token.balances.slice(0, 3).map((balance: any, index: number) => (
                      <div key={balance.userId} style={{
                        fontSize: '11px',
                        color: '#4b5563',
                        fontFamily: 'monospace',
                        marginBottom: '2px'
                      }}>
                        <span style={{ color: '#6366f1' }}>
                          {balance.userId.slice(0, 8)}...{balance.userId.slice(-4)}
                        </span>
                        {' '}→{' '}
                        <span style={{ fontWeight: '600' }}>
                          {formatBalance(balance.balance, token.metadata?.decimals)}
                        </span>
                      </div>
                    ))}
                    {token.balances.length > 3 && (
                      <div style={{ fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>
                        +{token.balances.length - 3} more...
                      </div>
                    )}
                  </div>
                )}
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

export default SimpleBlazeTest;