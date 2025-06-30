import React, { useState, useEffect } from 'react';
import { useBlaze } from 'blaze-sdk/realtime';

interface BalanceDebuggerProps {
  userId?: string;
  defaultUserId?: string;
}

interface BalanceEntry {
  contractId: string;
  symbol: string;
  name: string;
  balance: string;
  formattedBalance: number;
  subnetBalance?: string;
  formattedSubnetBalance?: number;
  subnetContractId?: string;
  timestamp: number;
  source: string;
  type?: string;
  decimals?: number;
  hasSubnetData: boolean;
}

const BalanceDebugger: React.FC<BalanceDebuggerProps> = ({ 
  userId, 
  defaultUserId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS' 
}) => {
  const [inputUserId, setInputUserId] = useState(userId || defaultUserId);
  const [activeUserId, setActiveUserId] = useState<string | undefined>(userId);
  const [filterText, setFilterText] = useState('');
  const [showSubnetOnly, setShowSubnetOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'symbol' | 'balance' | 'timestamp'>('symbol');
  
  const blazeData = useBlaze({ userId: activeUserId });
  
  const userBalances = activeUserId ? blazeData.getUserBalances(activeUserId) : {};
  const pricesCount = Object.keys(blazeData.prices).length;
  
  // Process balances into a more convenient format
  const processedBalances: BalanceEntry[] = Object.entries(userBalances).map(([contractId, balance]) => ({
    contractId,
    symbol: balance.symbol || 'UNKNOWN',
    name: balance.name || balance.metadata?.name || 'Unknown Token',
    balance: balance.balance || '0',
    formattedBalance: balance.formattedBalance || 0,
    subnetBalance: balance.subnetBalance,
    formattedSubnetBalance: balance.formattedSubnetBalance,
    subnetContractId: balance.subnetContractId,
    timestamp: balance.timestamp || 0,
    source: balance.source || 'unknown',
    type: balance.type || balance.metadata?.type,
    decimals: balance.decimals || balance.metadata?.decimals || 6,
    hasSubnetData: balance.subnetBalance !== undefined
  }));
  
  // Filter and sort balances
  const filteredBalances = processedBalances
    .filter(balance => {
      if (showSubnetOnly && !balance.hasSubnetData) return false;
      if (filterText) {
        const searchText = filterText.toLowerCase();
        return balance.symbol.toLowerCase().includes(searchText) ||
               balance.name.toLowerCase().includes(searchText) ||
               balance.contractId.toLowerCase().includes(searchText);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'balance':
          return b.formattedBalance - a.formattedBalance;
        case 'timestamp':
          return b.timestamp - a.timestamp;
        case 'symbol':
        default:
          return a.symbol.localeCompare(b.symbol);
      }
    });
  
  const handleLoadBalances = () => {
    if (inputUserId.trim()) {
      setActiveUserId(inputUserId.trim());
    }
  };
  
  const handleClearBalances = () => {
    setActiveUserId(undefined);
    setInputUserId('');
  };
  
  return (
    <div className="balance-debugger">
      <div className="debugger-header">
        <h2>🔍 Balance Debugger</h2>
        <div className="connection-status">
          <span className={`status-indicator ${blazeData.isConnected ? 'connected' : 'disconnected'}`}>
            {blazeData.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span className="prices-count">Prices: {pricesCount}</span>
          <span className="last-update">
            Last Update: {new Date(blazeData.lastUpdate).toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      <div className="user-input-section">
        <div className="input-group">
          <label htmlFor="userIdInput">User ID (Principal):</label>
          <input
            id="userIdInput"
            type="text"
            value={inputUserId}
            onChange={(e) => setInputUserId(e.target.value)}
            placeholder="Enter Stacks address..."
            className="user-input"
          />
          <button onClick={handleLoadBalances} className="load-btn">
            Load Balances
          </button>
          <button onClick={handleClearBalances} className="clear-btn">
            Clear
          </button>
        </div>
        
        {activeUserId && (
          <div className="active-user">
            <strong>Active User:</strong> 
            <code>{activeUserId.slice(0, 8)}...{activeUserId.slice(-8)}</code>
          </div>
        )}
      </div>
      
      <div className="controls-section">
        <div className="filter-group">
          <label htmlFor="filterInput">Filter:</label>
          <input
            id="filterInput"
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by symbol, name, or contract..."
            className="filter-input"
          />
        </div>
        
        <div className="options-group">
          <label>
            <input
              type="checkbox"
              checked={showSubnetOnly}
              onChange={(e) => setShowSubnetOnly(e.target.checked)}
            />
            Show only tokens with subnet data
          </label>
          
          <label htmlFor="sortSelect">Sort by:</label>
          <select
            id="sortSelect"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'symbol' | 'balance' | 'timestamp')}
            className="sort-select"
          >
            <option value="symbol">Symbol</option>
            <option value="balance">Balance</option>
            <option value="timestamp">Last Updated</option>
          </select>
        </div>
      </div>
      
      <div className="balances-section">
        <div className="balances-header">
          <h3>Balances ({filteredBalances.length})</h3>
          {activeUserId && filteredBalances.length === 0 && (
            <p className="no-balances">No balances found. Check user ID or filters.</p>
          )}
        </div>
        
        {filteredBalances.length > 0 && (
          <div className="balances-table">
            <div className="table-header">
              <div className="col-symbol">Symbol</div>
              <div className="col-name">Name</div>
              <div className="col-balance">Mainnet Balance</div>
              <div className="col-subnet">Subnet Balance</div>
              <div className="col-contract">Contract ID</div>
              <div className="col-meta">Metadata</div>
            </div>
            
            {filteredBalances.map((balance, index) => (
              <div key={`${balance.contractId}-${index}`} className="table-row">
                <div className="col-symbol">
                  <strong>{balance.symbol}</strong>
                  {balance.hasSubnetData && <span className="subnet-badge">🌐</span>}
                </div>
                
                <div className="col-name" title={balance.name}>
                  {balance.name}
                </div>
                
                <div className="col-balance">
                  <div className="balance-value">
                    {balance.formattedBalance.toLocaleString()}
                  </div>
                  <div className="balance-raw">
                    Raw: {balance.balance}
                  </div>
                </div>
                
                <div className="col-subnet">
                  {balance.hasSubnetData ? (
                    <>
                      <div className="balance-value">
                        {balance.formattedSubnetBalance?.toLocaleString() || 'N/A'}
                      </div>
                      <div className="balance-raw">
                        Raw: {balance.subnetBalance || 'N/A'}
                      </div>
                      {balance.subnetContractId && (
                        <div className="subnet-contract" title={balance.subnetContractId}>
                          {balance.subnetContractId.slice(-20)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-subnet">No subnet data</div>
                  )}
                </div>
                
                <div className="col-contract" title={balance.contractId}>
                  {balance.contractId.slice(-25)}
                </div>
                
                <div className="col-meta">
                  <div className="meta-item">Type: {balance.type || 'Unknown'}</div>
                  <div className="meta-item">Decimals: {balance.decimals}</div>
                  <div className="meta-item">Source: {balance.source}</div>
                  <div className="meta-item">
                    Updated: {new Date(balance.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="debug-info-section">
        <details>
          <summary>🔧 Debug Information</summary>
          <div className="debug-info">
            <div className="debug-item">
              <strong>Connection Status:</strong> {blazeData.isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="debug-item">
              <strong>Total Prices Loaded:</strong> {pricesCount}
            </div>
            <div className="debug-item">
              <strong>Total Balance Entries:</strong> {Object.keys(userBalances).length}
            </div>
            <div className="debug-item">
              <strong>Subnet Tokens Found:</strong> {processedBalances.filter(b => b.hasSubnetData).length}
            </div>
            <div className="debug-item">
              <strong>Last Update:</strong> {new Date(blazeData.lastUpdate).toLocaleString()}
            </div>
            <div className="debug-item">
              <strong>Active Subscription:</strong> {activeUserId ? 'Yes' : 'No'}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default BalanceDebugger;