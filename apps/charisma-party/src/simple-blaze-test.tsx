'use client';

import { useState, useEffect } from 'react';
import { useBlaze, BlazeProvider } from 'blaze-sdk/realtime';
import PartySocket from 'partysocket';
import { TokenMetadata } from './balances-lib';

const UserBalanceTest = () => {
  const [testUserId, setTestUserId] = useState('');
  const [subscribedUserId, setSubscribedUserId] = useState<string | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Use useBlaze with user-specific config when testing balance subscriptions
  const { balances, isConnected } = useBlaze(
    subscribedUserId ? { userId: subscribedUserId } : undefined
  );

  const handleSubscribeToUser = () => {
    if (testUserId.trim()) {
      setIsLoadingBalances(true);
      setSubscribedUserId(testUserId.trim());
      console.log('🔍 Subscribing to user:', testUserId.trim());

      // Set a timeout to stop loading state if no balances come through
      setTimeout(() => {
        setIsLoadingBalances(false);
      }, 5000);
    }
  };

  const handleClearSubscription = () => {
    setSubscribedUserId(null);
    setTestUserId('');
    setIsLoadingBalances(false);
    console.log('🧹 Cleared subscription');
  };

  // Filter balances for the subscribed user if any
  const userSpecificBalances = subscribedUserId
    ? Object.entries(balances).filter(([key]) => key.startsWith(`${subscribedUserId}:`))
    : [];

  // Stop loading when balances are received for the subscribed user
  useEffect(() => {
    if (subscribedUserId && userSpecificBalances.length > 0) {
      setIsLoadingBalances(false);
      console.log(`✅ Received ${userSpecificBalances.length} balances for user:`, subscribedUserId);
    }
  }, [subscribedUserId, userSpecificBalances.length]);

  // Auto-clear loading state if no balances received after timeout
  useEffect(() => {
    if (isLoadingBalances) {
      const timeout = setTimeout(() => {
        setIsLoadingBalances(false);
        console.warn('⚠️ Balance loading timeout - no data received');
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoadingBalances]);

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
        🧪 User Balance Subscription Test
      </h3>

      <div style={{
        fontSize: '14px',
        color: '#6b7280',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb'
      }}>
        <strong>How to test:</strong> Enter a Stacks address to subscribe to that user's balance updates in real-time.
        <br />
        <strong>Try these sample addresses:</strong>
        <div style={{ marginTop: '8px' }}>
          {SAMPLE_ADDRESSES.map((sample, index) => (
            <div
              key={index}
              style={{
                cursor: 'pointer',
                color: '#0ea5e9',
                textDecoration: 'underline',
                marginBottom: '4px',
                padding: '4px 0'
              }}
              onClick={() => setTestUserId(sample.address)}
            >
              <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '600' }}>
                {sample.address}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
                {sample.label} - {sample.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={testUserId}
          onChange={(e) => setTestUserId(e.target.value)}
          placeholder="Enter user address (e.g., SP123...ABC)"
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            minWidth: '300px',
            fontFamily: 'monospace'
          }}
        />
        <button
          onClick={handleSubscribeToUser}
          disabled={!testUserId.trim() || !isConnected}
          style={{
            padding: '8px 16px',
            backgroundColor: isConnected && testUserId.trim() ? '#059669' : '#9ca3af',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isConnected && testUserId.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          Subscribe
        </button>
        {subscribedUserId && (
          <button
            onClick={handleClearSubscription}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        )}
      </div>

      {subscribedUserId && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f0f9ff',
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #0ea5e9'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1', marginBottom: '4px' }}>
            Subscribed to user:
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#075985' }}>
            {subscribedUserId}
          </div>
          <div style={{ fontSize: '12px', color: '#0369a1', marginTop: '4px' }}>
            {isLoadingBalances ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', border: '2px solid #0ea5e9', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                Loading balances...
              </div>
            ) : (
              `Found ${userSpecificBalances.length} balance${userSpecificBalances.length !== 1 ? 's' : ''}`
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// Utility functions for formatting
const formatBalanceDisplay = (formattedBalance: number): string => {
  if (formattedBalance === 0) return '0';
  if (formattedBalance >= 1000000) {
    return `${(formattedBalance / 1000000).toFixed(2)}M`;
  } else if (formattedBalance >= 1000) {
    return `${(formattedBalance / 1000).toFixed(2)}K`;
  } else if (formattedBalance >= 1) {
    return formattedBalance.toFixed(2);
  } else if (formattedBalance >= 0.000001) {
    return formattedBalance.toFixed(6);
  } else {
    return formattedBalance.toExponential(2);
  }
};

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

// Constants
const SAMPLE_ADDRESSES = [
  {
    address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    label: 'Charisma deployer',
    description: 'High CHA balance with subnet tokens'
  },
  {
    address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
    label: 'Active trader',
    description: 'Multiple token holdings'
  },
  {
    address: 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6',
    label: 'LEO holder',
    description: 'Large LEO balance'
  }
];

const SimpleBlazeTest = () => {
  const { prices, metadata, balances, isConnected } = useBlaze();
  const [activeTab, setActiveTab] = useState<'prices' | 'balances'>('balances');



  // Get unique users from balances
  const uniqueUsers = Array.from(new Set(
    Object.keys(balances).map(key => key.split(':')[0])
  ));

  // Merge prices with balances (metadata is now included in balance objects)
  const tokensWithData = Object.keys(prices).map(contractId => {
    // Get all balances for this token across all users
    const tokenBalances = Object.entries(balances)
      .filter(([key]) => key.endsWith(`:${contractId}`))
      .map(([key, balance]) => ({
        userId: key.split(':')[0],
        ...balance
      }));

    // Get metadata from the first balance entry (since it's now included)
    const firstBalance = tokenBalances[0];
    const tokenMetadata = firstBalance ? {
      name: firstBalance.name,
      symbol: firstBalance.symbol,
      decimals: firstBalance.decimals,
      image: firstBalance.image,
      description: firstBalance.description,
      tokenType: firstBalance.type
    } : metadata[contractId]; // fallback to old metadata

    return {
      contractId,
      price: prices[contractId],
      metadata: tokenMetadata as TokenMetadata,
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
            🚀 Enhanced Balance Feed Test
          </h1>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '16px' }}>
            Using enhanced balance feed with integrated metadata & formatted balances
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            padding: '6px 12px',
            backgroundColor: isConnected ? '#dcfce7' : '#fef2f2',
            borderRadius: '6px',
            border: `1px solid ${isConnected ? '#16a34a' : '#dc2626'}`,
            fontSize: '14px',
            fontWeight: '600',
            color: isConnected ? '#16a34a' : '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#16a34a' : '#dc2626'
            }}></div>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>

          <div style={{ fontSize: '14px', color: '#64748b' }}>
            {Object.keys(prices).length} prices • {Object.keys(balances).length} balances • {uniqueUsers.length} users
          </div>

          {!isConnected && (
            <div style={{
              fontSize: '12px',
              color: '#dc2626',
              fontStyle: 'italic'
            }}>
              Connecting to balance feed...
            </div>
          )}
        </div>
      </div>

      {/* User Balance Subscription Test */}
      <UserBalanceTest />

      {/* Tabbed Data View */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {/* Tab Headers */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f8fafc'
        }}>
          <button
            onClick={() => setActiveTab('prices')}
            style={{
              padding: '16px 20px',
              border: 'none',
              backgroundColor: activeTab === 'prices' ? 'white' : 'transparent',
              borderBottom: activeTab === 'prices' ? '2px solid #0ea5e9' : '2px solid transparent',
              color: activeTab === 'prices' ? '#0ea5e9' : '#6b7280',
              fontWeight: activeTab === 'prices' ? '600' : '500',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📈 Prices ({Object.keys(prices).length})
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            style={{
              padding: '16px 20px',
              border: 'none',
              backgroundColor: activeTab === 'balances' ? 'white' : 'transparent',
              borderBottom: activeTab === 'balances' ? '2px solid #0ea5e9' : '2px solid transparent',
              color: activeTab === 'balances' ? '#0ea5e9' : '#6b7280',
              fontWeight: activeTab === 'balances' ? '600' : '500',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            💰 Balances ({Object.keys(balances).length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'prices' && (
          <div>
            {tokensWithData.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                Waiting for token price data...
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
                    borderRadius: '8px',
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: '2px solid #e5e7eb'
                  }}>
                    {token.metadata?.image ? (
                      <img
                        src={token.metadata.image}
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
                        {token.balances.slice(0, 3).map((balance: any) => (
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
                              {formatBalanceDisplay(balance.formattedBalance || 0)} {balance.symbol}
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
        )}

        {activeTab === 'balances' && (
          <div>
            {Object.keys(balances).length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                No balance data available. Subscribe to a user above to see their balances.
              </div>
            ) : (
              Object.entries(balances).map(([key, balance]) => {
                const [userId, contractId] = key.split(':');

                return (
                  <div
                    key={key}
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
                      {balance.image ? (
                        <img
                          src={balance.image}
                          alt={balance.symbol || balance.name || 'Token'}
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
                          {(balance.symbol || balance.name || contractId || '').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Token and User Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '4px'
                      }}>
                        {balance.name || contractId}
                        {balance.symbol && (
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#6b7280',
                            marginLeft: '8px'
                          }}>
                            ({balance.symbol})
                          </span>
                        )}
                      </div>

                      <div style={{
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#6366f1',
                        marginBottom: '4px'
                      }}>
                        User: {userId?.slice(0, 8)}...{userId?.slice(-4)}
                      </div>

                      <div style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#9ca3af',
                        marginBottom: '4px'
                      }}>
                        {contractId}
                      </div>

                      {/* Enhanced metadata display */}
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>
                        {balance.type && (
                          <span style={{
                            backgroundColor: '#f0f9ff',
                            color: '#0369a1',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginRight: '6px',
                            fontWeight: '500'
                          }}>
                            {balance.type}
                          </span>
                        )}
                        {balance.subnetBalance !== undefined && (
                          <span style={{
                            backgroundColor: '#f3e8ff',
                            color: '#7c3aed',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginRight: '6px',
                            fontWeight: '500'
                          }}>
                            SUBNET-COMPATIBLE
                          </span>
                        )}
                        {balance.description && (
                          <span style={{ fontStyle: 'italic' }}>
                            {balance.description.slice(0, 80)}{balance.description.length > 80 ? '...' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Enhanced Balance Display */}
                    <div style={{ textAlign: 'right' }}>
                      {/* Mainnet Balance */}
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#059669',
                        marginBottom: '2px'
                      }}>
                        {formatBalanceDisplay(balance.formattedBalance || 0)} {balance.symbol}
                        {balance.subnetBalance !== undefined && (
                          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400', marginLeft: '4px' }}>
                            (Mainnet)
                          </span>
                        )}
                      </div>

                      {/* Subnet Balance if available */}
                      {balance.subnetBalance !== undefined && (
                        <div style={{ fontSize: '16px', fontWeight: '500', color: '#7c3aed', marginBottom: '2px' }}>
                          {formatBalanceDisplay(balance.formattedSubnetBalance || 0)} {balance.symbol}
                          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400', marginLeft: '4px' }}>
                            (Subnet)
                          </span>
                        </div>
                      )}

                      {/* Total if both exist */}
                      {balance.subnetBalance !== undefined && (
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '4px', borderTop: '1px solid #e5e7eb', paddingTop: '2px' }}>
                          Total: {formatBalanceDisplay((balance.formattedBalance || 0) + (balance.formattedSubnetBalance || 0))} {balance.symbol}
                        </div>
                      )}

                      <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                        Raw: {balance.balance?.toLocaleString() || '0'}
                        {balance.subnetBalance !== undefined && (
                          <div>Subnet: {balance.subnetBalance?.toLocaleString() || '0'}</div>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        Decimals: {balance.decimals} • {new Date(balance.timestamp).toLocaleTimeString()}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        {balance.source}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const WrappedSimpleBlazeTest = () => (
  <BlazeProvider>
    <SimpleBlazeTest />
  </BlazeProvider>
);

export default WrappedSimpleBlazeTest;