'use client';

import { useWallet } from '../contexts/wallet-context';

const WalletConnectButton = () => {
  const { connected, address, isConnecting, connectWallet, disconnectWallet } = useWallet();

  const formatAddress = (addr: string): string => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const handleClick = () => {
    if (connected) {
      disconnectWallet();
    } else {
      connectWallet();
    }
  };

  return (
    <button 
      className={`wallet-connect-btn ${connected ? 'connected' : ''} ${isConnecting ? 'connecting' : ''}`}
      onClick={handleClick}
      disabled={isConnecting}
      title={connected ? `Connected: ${address}` : 'Connect Stacks Wallet'}
    >
      <div className="wallet-icon">
        {connected ? '🔗' : '👛'}
      </div>
      <div className="wallet-text">
        {isConnecting ? (
          <span className="connecting-text">Connecting...</span>
        ) : connected ? (
          <span className="address-text">{formatAddress(address)}</span>
        ) : (
          <span className="connect-text">Connect</span>
        )}
      </div>
    </button>
  );
};

export default WalletConnectButton;