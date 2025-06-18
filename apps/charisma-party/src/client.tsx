import { useState, useEffect, useCallback, useRef } from 'react';
import usePartySocket from 'partysocket/react';
import './styles.css';

// Types
interface PriceUpdate {
  type: 'PRICE_UPDATE';
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}

interface PriceBatch {
  type: 'PRICE_BATCH';
  prices: PriceUpdate[];
  timestamp: number;
}

interface ServerInfo {
  type: 'SERVER_INFO';
  isLocalDev: boolean;
  timestamp: number;
}

interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

interface PongMessage {
  type: 'PONG';
  timestamp: number;
}

type ServerMessage = PriceUpdate | PriceBatch | ServerInfo | ErrorMessage | PongMessage;

interface PriceSubscription {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'MANUAL_UPDATE';
  contractIds?: string[];
  clientId?: string;
}

interface SystemMessage {
  id: string;
  message: string;
  type: 'info' | 'error';
  timestamp: number;
}

interface PriceItem {
  id: string;
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}

// Contract ID validation
const isValidContractId = (contractId: string): boolean => {
  // Valid formats:
  // 1. Native token: .stx or stx
  // 2. Standard contract: SP[address].[contract-name]
  // 3. Standard contract with :: SP[address].[contract-name]::[trait-name]
  
  if (!contractId || typeof contractId !== 'string') return false;
  
  // Native STX token
  if (contractId === '.stx' || contractId === 'stx') return true;
  
  // Standard contract format with optional trait
  const contractPattern = /^(SP|ST)[A-Z0-9]{38,39}\.[a-z0-9\-]+(::[a-z0-9\-]+)?$/;
  return contractPattern.test(contractId);
};

const PriceDashboard = () => {
  // State
  const [subscribedTokens, setSubscribedTokens] = useState<Set<string>>(new Set());
  const [updateCount, setUpdateCount] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [latency, setLatency] = useState(0);
  const [tokenInput, setTokenInput] = useState('');
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [latestPrices, setLatestPrices] = useState<Record<string, PriceItem>>({});

  // Refs
  const priceFeedRef = useRef<HTMLDivElement>(null);

  // Helper functions
  const addSystemMessage = useCallback((message: string, type: 'info' | 'error') => {
    const newMessage: SystemMessage = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
      timestamp: Date.now()
    };

    setSystemMessages(prev => {
      const updated = [newMessage, ...prev];
      return updated.slice(0, 50); // Keep only latest 50 messages
    });
  }, []);

  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    setUpdateCount(prev => prev + 1);

    const newPriceItem: PriceItem = {
      id: `${update.contractId}-${update.timestamp}`,
      contractId: update.contractId,
      price: update.price,
      timestamp: update.timestamp,
      source: update.source
    };

    setPriceItems(prev => {
      const updated = [newPriceItem, ...prev];
      return updated.slice(0, 100); // Keep only latest 100 items
    });
    setLatestPrices(prev => {
      const prevItem = prev[update.contractId];
      // Only update if this is the latest timestamp for the token
      if (!prevItem || update.timestamp > (prevItem?.timestamp ?? 0)) {
        return { ...prev, [update.contractId]: newPriceItem };
      }
      return prev;
    });
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: ServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case 'PRICE_UPDATE':
          handlePriceUpdate(data);
          break;

        case 'PRICE_BATCH':
          data.prices.forEach(price => handlePriceUpdate(price));
          break;

        case 'SERVER_INFO':
          addSystemMessage(`Server: ${data.isLocalDev ? 'Development' : 'Production'} mode`, 'info');
          break;

        case 'ERROR':
          addSystemMessage(`Server: ${data.message}`, 'error');
          break;

        case 'PONG':
          setLatency(Date.now() - data.timestamp);
          break;

        default:
          addSystemMessage(`Unknown message: ${event.data}`, 'info');
      }
    } catch (error) {
      addSystemMessage(`Raw message: ${event.data}`, 'info');
    }
  }, [addSystemMessage, handlePriceUpdate]);

  // Determine host based on environment
  // In development, everything runs on the same port (1999)
  // In production, use the production domain
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const partyHost = isDev ? window.location.host : 'charisma-party.r0zar.partykit.dev';
  
  console.log('Connecting to PartyKit host:', partyHost, 'from:', window.location.host);

  // PartySocket hook
  const socket = usePartySocket({
    host: partyHost,
    room: "prices",
    party: "prices", // Specify the party name explicitly
    onOpen: () => {
      console.log('WebSocket opened');
      setStartTime(Date.now());
      addSystemMessage('Connection established', 'info');
    },
    onClose: (event) => {
      console.log('WebSocket closed:', event);
      addSystemMessage('Connection lost', 'error');
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      addSystemMessage(`Connection error: ${error}`, 'error');
    },
    onMessage: (event) => {
      console.log('WebSocket message received');
      handleMessage(event);
    }
  });

  const subscribeToToken = useCallback((tokenId: string) => {
    if (!socket || subscribedTokens.has(tokenId)) return;
    
    // Validate contract ID
    if (!isValidContractId(tokenId)) {
      addSystemMessage(`Invalid contract ID format: ${tokenId}`, 'error');
      return;
    }

    const message: PriceSubscription = {
      type: 'SUBSCRIBE',
      contractIds: [tokenId],
      clientId: 'react-dashboard'
    };

    socket.send(JSON.stringify(message));
    setSubscribedTokens(prev => new Set([...prev, tokenId]));
    addSystemMessage(`Subscribed to ${tokenId}`, 'info');
  }, [socket, subscribedTokens, addSystemMessage]);

  const unsubscribeFromToken = useCallback((tokenId: string) => {
    if (!socket) return;

    const message: PriceSubscription = {
      type: 'UNSUBSCRIBE',
      contractIds: [tokenId],
      clientId: 'react-dashboard'
    };

    socket.send(JSON.stringify(message));
    setSubscribedTokens(prev => {
      const updated = new Set(prev);
      updated.delete(tokenId);
      return updated;
    });
    addSystemMessage(`Unsubscribed from ${tokenId}`, 'info');
  }, [socket, addSystemMessage]);

  const handleSubscribe = useCallback(() => {
    const trimmedInput = tokenInput.trim();
    if (trimmedInput && !subscribedTokens.has(trimmedInput)) {
      subscribeToToken(trimmedInput);
      setTokenInput('');
    }
  }, [tokenInput, subscribedTokens, subscribeToToken]);

  const triggerManualUpdate = useCallback(() => {
    if (!socket) return;

    const message: PriceSubscription = { type: 'MANUAL_UPDATE' };
    socket.send(JSON.stringify(message));
    addSystemMessage('Manual update requested', 'info');
  }, [socket, addSystemMessage]);

  const clearFeed = useCallback(() => {
    setPriceItems([]);
    setSystemMessages([]);
  }, []);

  const formatPrice = useCallback((price: number): string => {
    if (price >= 1) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 0.01) {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toFixed(8)}`;
    }
  }, []);

  const scrollToTop = useCallback(() => {
    if (priceFeedRef.current) {
      priceFeedRef.current.scrollTop = 0;
    }
  }, []);

  // Effects
  // Effect to send PING every 10 seconds for latency measurement
  useEffect(() => {
    if (!socket) return;
    const interval = setInterval(() => {
      const message = { type: 'PING', timestamp: Date.now() };
      socket.send(JSON.stringify(message));
    }, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, [socket]);

  // Calculate uptime
  const uptime = socket && startTime > 0
    ? Math.floor((Date.now() - startTime) / 1000)
    : 0;

  const formatUptime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Combine price items and system messages for feed
  const feedItems = [...priceItems, ...systemMessages].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Price Monitoring System</h1>
          <div className="connection-indicator">
            <span className={`status-dot ${socket ? 'connected' : 'disconnected'}`}></span>
            <span>{socket ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Stats */}
        <section className="stats-section">
          <div className="stat-card">
            <div className="stat-label">Active Subscriptions</div>
            <div className="stat-value">{subscribedTokens.size}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Price Updates</div>
            <div className="stat-value">{updateCount.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Uptime</div>
            <div className="stat-value">{formatUptime(uptime)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Latency</div>
            <div className="stat-value">{latency > 0 ? `${latency} ms` : 'N/A'}</div>
          </div>
        </section>

        {/* Main Dashboard */}
        <div className="dashboard-grid">
          {/* Control Panel */}
          <div className="control-panel">
            {/* Panel Header */}
            <div className="panel-header">
              <h2>Subscription Management</h2>
            </div>
            {/* Input Group */}
            <div className="input-group">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubscribe()}
                placeholder="Enter contract ID"
                className="token-input"
                autoComplete="off"
              />
              <button
                onClick={handleSubscribe}
                disabled={!socket || !tokenInput.trim() || subscribedTokens.has(tokenInput.trim())}
                className="btn btn-primary"
              >
                Subscribe
              </button>
            </div>
            {/* Active Subscriptions */}
            <div className="subscribed-section">
              <div className="section-label">Active Subscriptions</div>
              <div className="subscribed-tokens">
                {subscribedTokens.size === 0 ? (
                  <div className="empty-subscriptions">No active subscriptions</div>
                ) : (
                  Array.from(subscribedTokens).map(token => (
                    <div key={token} className="subscription-item">
                      <span className="token-name">{token}</span>
                      <button
                        onClick={() => unsubscribeFromToken(token)}
                        className="remove-btn"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                onClick={triggerManualUpdate}
                disabled={!socket}
                className="btn btn-secondary"
              >
                Refresh Prices
              </button>
              <button
                onClick={clearFeed}
                className="btn btn-outline"
              >
                Clear History
              </button>
            </div>
          </div>
          {/* Price Feed + All Token Prices */}
          <div className="price-panel">
            {/* All Token Prices Panel */}
            <div className="panel-header">
              <h2>All Token Prices</h2>
            </div>
            <div className="price-feed" style={{ maxHeight: 220, minHeight: 120, overflowY: 'auto' }}>
              {Object.keys(latestPrices).length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No price data yet</div>
                  <div className="token-input">Subscribe to tokens to see prices</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Token</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Price</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Time</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(latestPrices)
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map(item => (
                        <tr key={item.contractId} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{item.contractId}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>{formatPrice(item.price)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{new Date(item.timestamp).toLocaleTimeString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', textTransform: 'uppercase', fontSize: '0.85em' }}>{item.source || 'server'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* Live Feed Panel */}
            <div className="panel-header feed-controls" style={{ marginTop: 16 }}>
              <h2>Live Feed</h2>
              <button
                onClick={scrollToTop}
                className="btn btn-sm btn-outline"
              >
                Top
              </button>
            </div>
            <div
              ref={priceFeedRef}
              className="price-feed"
            >
              {feedItems.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
                  <div className="token-name" style={{ marginBottom: '0.5rem' }}>No price data available</div>
                  <div className="token-input">Subscribe to tokens to start monitoring</div>
                </div>
              ) : (
                <div>
                  {feedItems.map(item => {
                    if ('price' in item) {
                      // Price item
                      return (
                        <div key={item.id} className="price-item">
                          <div className="price-header">
                            <span className="contract-id">{item.contractId}</span>
                            <span className="timestamp">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="price-value">{formatPrice(item.price)}</div>
                          <div className="price-source">{item.source || 'server'}</div>
                        </div>
                      );
                    } else {
                      // System message
                      return (
                        <div
                          key={item.id}
                          className={`system-message${item.type === 'error' ? ' error' : ''}`}
                        >
                          <div className="message-content">
                            <span className="message-icon">{item.type === 'error' ? '⚠' : 'ℹ'}</span>
                            <span className="message-text">{item.message}</span>
                          </div>
                          <div className="message-time">{new Date(item.timestamp).toLocaleTimeString()}</div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PriceDashboard;