import React, { useState } from 'react';
import { BlazeProvider } from 'blaze-sdk/realtime';
import BalanceDebugger from './BalanceDebugger';
import '../styles/BalanceDebugger.css';

interface DebugAppProps {
  host?: string;
}

const DebugApp: React.FC<DebugAppProps> = ({ host }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Determine host based on environment
  const blazeHost = host || (
    typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? `${window.location.hostname}:1999`
      : 'charisma-party.r0zar.partykit.dev'
  );
  
  return (
    <div className={`debug-app ${isDarkMode ? 'dark' : 'light'}`}>
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎉 Charisma Party - Balance Debugger</h1>
            <p className="host-info">Connected to: <code>{blazeHost}</code></p>
          </div>
          <div className="header-right">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="theme-toggle"
            >
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </header>
      
      <main className="app-main">
        <BlazeProvider host={blazeHost}>
          <BalanceDebugger 
            defaultUserId="SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS"
          />
        </BlazeProvider>
      </main>
      
      <footer className="app-footer">
        <div className="footer-content">
          <p>Real-time balance debugging with WebSocket connections to Charisma Party servers</p>
          <div className="footer-links">
            <a href="https://github.com/anthropics/charisma" target="_blank" rel="noopener noreferrer">
              📖 Documentation
            </a>
            <a href="/scripts" target="_blank" rel="noopener noreferrer">
              🔧 Test Scripts
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DebugApp;