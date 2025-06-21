'use client';

import { useState, useEffect, useRef } from 'react';
import { useBlaze } from 'blaze-sdk/realtime';

// Types
interface TokenBattler {
  contractId: string;
  symbol: string;
  name: string;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  image?: string;
  timestamp: number;
  isFlashing: boolean;
  trend: 'up' | 'down' | 'neutral';
  activityScore: number;
  isInArena: boolean;
  volume?: number;
  timeSinceLastMove: number;
}

interface BattleEvent {
  id: string;
  symbol: string;
  message: string;
  timestamp: number;
  type: 'victory' | 'defeat' | 'neutral';
}

interface FloatingParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  symbol: string;
  type: 'gain' | 'loss';
}

const PriceTheater = () => {
  const { prices, isConnected } = useBlaze();
  const [battlers, setBattlers] = useState<TokenBattler[]>([]);
  const [arenaBattlers, setArenaBattlers] = useState<TokenBattler[]>([]);
  const [rosterBattlers, setRosterBattlers] = useState<TokenBattler[]>([]);
  const [battleEvents, setBattleEvents] = useState<BattleEvent[]>([]);
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [battleMode, setBattleMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [marketStats, setMarketStats] = useState({
    totalActive: 0,
    biggestWinner: null as TokenBattler | null,
    biggestLoser: null as TokenBattler | null,
    totalBattles: 0
  });
  const previousPricesRef = useRef<Record<string, number>>({});
  const activityTracker = useRef<Record<string, number[]>>({});
  const particleIdRef = useRef(0);
  const eventIdRef = useRef(0);
  const currentArenaTokens = useRef<string[]>([]);

  // Audio context for sound effects
  const audioContextRef = useRef<AudioContext | null>(null);

  // Activity detection and battle logic
  const calculateActivityScore = (battler: TokenBattler): number => {
    const { changePercent, timeSinceLastMove } = battler;
    
    // Base score from price movement
    let score = Math.abs(changePercent) * 10;
    
    // Bonus for recent activity (higher score for more recent moves)
    const timeBonus = Math.max(0, 100 - (timeSinceLastMove / 1000));
    score += timeBonus;
    
    // Volume bonus if available
    if (battler.volume) {
      score += Math.log(battler.volume + 1) * 5;
    }
    
    return Math.min(score, 1000); // Cap at 1000
  };

  const createBattleEvent = (battler: TokenBattler, isSignificant: boolean = false): BattleEvent => {
    const eventId = `event-${eventIdRef.current++}`;
    const { symbol, changePercent, trend } = battler;
    
    let message = '';
    let type: 'victory' | 'defeat' | 'neutral' = 'neutral';
    
    if (isSignificant) {
      if (trend === 'up') {
        message = `${symbol} surges ${changePercent.toFixed(2)}%! 🚀`;
        type = 'victory';
      } else if (trend === 'down') {
        message = `${symbol} drops ${Math.abs(changePercent).toFixed(2)}% 📉`;
        type = 'defeat';
      }
    } else {
      if (trend === 'up') {
        message = `${symbol} +${changePercent.toFixed(2)}%`;
        type = 'victory';
      } else if (trend === 'down') {
        message = `${symbol} ${changePercent.toFixed(2)}%`;
        type = 'defeat';
      } else {
        message = `${symbol} stable`;
      }
    }
    
    return {
      id: eventId,
      symbol,
      message,
      timestamp: Date.now(),
      type
    };
  };

  const determineArenaEntrants = (allBattlers: TokenBattler[]): { arena: TokenBattler[], roster: TokenBattler[] } => {
    // Sort by activity score
    const sorted = [...allBattlers].sort((a, b) => b.activityScore - a.activityScore);
    
    // Get current arena tokens and their scores
    const currentArenaSet = new Set(currentArenaTokens.current);
    const currentArenaMap = new Map<string, number>();
    
    // Build map of current arena tokens and their scores
    allBattlers.forEach(battler => {
      if (currentArenaSet.has(battler.contractId)) {
        currentArenaMap.set(battler.contractId, battler.activityScore);
      }
    });
    
    // Start with existing arena tokens that are still active
    const stableArena: TokenBattler[] = [];
    allBattlers.forEach(battler => {
      if (currentArenaSet.has(battler.contractId) && battler.activityScore > 1) {
        stableArena.push({ ...battler, isInArena: true });
      }
    });
    
    // Fill remaining slots with highest activity tokens not already in arena
    const remainingSlots = 8 - stableArena.length;
    if (remainingSlots > 0) {
      const candidatesForArena = sorted.filter(battler => 
        !currentArenaSet.has(battler.contractId) && battler.activityScore > 1
      );
      
      // Add new tokens to fill remaining slots
      for (let i = 0; i < Math.min(remainingSlots, candidatesForArena.length); i++) {
        stableArena.push({ ...candidatesForArena[i], isInArena: true });
      }
    }
    
    // If we still don't have 8, fill with the highest scoring tokens
    if (stableArena.length < 8) {
      const topTokens = sorted.slice(0, 8);
      const filledArena: TokenBattler[] = [];
      
      topTokens.forEach(battler => {
        if (!filledArena.find(a => a.contractId === battler.contractId)) {
          filledArena.push({ ...battler, isInArena: true });
        }
      });
      
      // Update the arena tokens ref
      currentArenaTokens.current = filledArena.map(b => b.contractId);
      
      // Rest go to roster
      const roster = allBattlers
        .filter(battler => !filledArena.find(a => a.contractId === battler.contractId))
        .map(b => ({ ...b, isInArena: false }));
      
      return { arena: filledArena, roster };
    }
    
    // Update the arena tokens ref
    currentArenaTokens.current = stableArena.map(b => b.contractId);
    
    // Rest go to roster
    const roster = allBattlers
      .filter(battler => !stableArena.find(a => a.contractId === battler.contractId))
      .map(b => ({ ...b, isInArena: false }));
    
    return { arena: stableArena, roster };
  };

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined' && soundEnabled) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [soundEnabled]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'f':
          event.preventDefault();
          toggleFullscreen();
          break;
        case 's':
          event.preventDefault();
          setSoundEnabled(!soundEnabled);
          break;
        case 'z':
          event.preventDefault();
          setBattleMode(!battleMode);
          break;
        case 'escape':
          if (selectedToken) {
            setSelectedToken(null);
          } else if (showHelp) {
            setShowHelp(false);
          }
          break;
        case '?':
        case 'h':
          event.preventDefault();
          setShowHelp(!showHelp);
          break;
        case ' ':
          event.preventDefault();
          // Trigger manual price refresh sound
          if (soundEnabled && audioContextRef.current) {
            playPriceSound('up');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [soundEnabled, battleMode, selectedToken, showHelp]);

  // Process incoming price data into battle system
  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0) return;

    const newBattlers: TokenBattler[] = [];
    const newEvents: BattleEvent[] = [];
    const now = Date.now();

    Object.entries(prices).forEach(([contractId, priceData]) => {
      if (!priceData || typeof priceData.price !== 'number') return;

      const previousPrice = previousPricesRef.current[contractId] || priceData.price;
      const change = priceData.price - previousPrice;
      const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
      const hasChanged = Math.abs(change) > 0.00001;

      // Extract symbol from contract ID or use contract ID
      const symbol = contractId.includes('.') 
        ? contractId.split('.')[1].toUpperCase().slice(0, 6)
        : contractId.slice(0, 6).toUpperCase();

      // Track activity history for this token
      if (!activityTracker.current[contractId]) {
        activityTracker.current[contractId] = [];
      }
      
      // Add new activity if there was a change
      if (hasChanged) {
        activityTracker.current[contractId].push(now);
        // Keep only last 10 activities
        activityTracker.current[contractId] = activityTracker.current[contractId].slice(-10);
      }

      const timeSinceLastMove = now - (priceData.timestamp || now);
      
      const battler: TokenBattler = {
        contractId,
        symbol,
        name: symbol,
        price: priceData.price,
        previousPrice,
        change,
        changePercent,
        timestamp: priceData.timestamp || now,
        isFlashing: hasChanged,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
        activityScore: 0, // Will be calculated below
        isInArena: false,
        timeSinceLastMove
      };

      // Calculate activity score
      battler.activityScore = calculateActivityScore(battler);

      newBattlers.push(battler);

      // Create battle events for significant changes
      if (hasChanged) {
        const isSignificant = Math.abs(changePercent) > 2;
        newEvents.push(createBattleEvent(battler, isSignificant));

        // Create particles for significant price changes
        if (Math.abs(changePercent) > 0.01) {
          createPriceParticle(symbol, change > 0 ? 'gain' : 'loss');
          
          // Play sound effect
          if (soundEnabled && audioContextRef.current) {
            playPriceSound(change > 0 ? 'up' : 'down');
          }
        }
      }

      // Update previous price tracking
      previousPricesRef.current[contractId] = priceData.price;
    });

    // Determine arena vs roster placement
    const { arena, roster } = determineArenaEntrants(newBattlers);

    // Update market stats
    const activeBattlers = newBattlers.filter(b => b.activityScore > 10);
    const winner = newBattlers.reduce((max, b) => b.changePercent > max.changePercent ? b : max, newBattlers[0]);
    const loser = newBattlers.reduce((min, b) => b.changePercent < min.changePercent ? b : min, newBattlers[0]);

    setMarketStats({
      totalActive: activeBattlers.length,
      biggestWinner: winner?.changePercent > 0 ? winner : null,
      biggestLoser: loser?.changePercent < 0 ? loser : null,
      totalBattles: newBattlers.length
    });

    // Update state
    setBattlers(newBattlers);
    setArenaBattlers(arena);
    setRosterBattlers(roster);

    // Add new events to the beginning and limit to 50
    if (newEvents.length > 0) {
      setBattleEvents(prev => [...newEvents, ...prev].slice(0, 50));
    }

    // Clear flash effect after animation
    setTimeout(() => {
      setBattlers(battlers => battlers.map(battler => ({ ...battler, isFlashing: false })));
      setArenaBattlers(arena => arena.map(battler => ({ ...battler, isFlashing: false })));
    }, 500);

  }, [prices, soundEnabled]);

  // Create floating particles
  const createPriceParticle = (symbol: string, type: 'gain' | 'loss') => {
    const particle: FloatingParticle = {
      id: `particle-${particleIdRef.current++}`,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 3 - 1,
      life: 2000,
      symbol,
      type
    };

    setParticles(prev => [...prev, particle]);

    // Remove particle after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== particle.id));
    }, 2000);
  };

  // Play sound effects
  const playPriceSound = (direction: 'up' | 'down') => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Different frequencies for up/down
    oscillator.frequency.setValueAtTime(
      direction === 'up' ? 800 : 400, 
      ctx.currentTime
    );
    oscillator.type = 'sine';

    // Quick beep
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  };

  // Format price display
  const formatPrice = (price: number): string => {
    if (price >= 1) {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
    } else if (price >= 0.000001) {
      return `$${price.toFixed(8)}`;
    } else {
      return `$${price.toExponential(2)}`;
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div className={`rpg-price-hall ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Floating Particles */}
      <div className="particles-container">
        {particles.map(particle => (
          <div
            key={particle.id}
            className={`particle ${particle.type}`}
            style={{
              left: particle.x,
              top: particle.y,
              transform: `translate(${particle.vx * 50}px, ${particle.vy * 50}px)`
            }}
          >
            {particle.symbol} {particle.type === 'gain' ? '⚔️' : '🛡️'}
          </div>
        ))}
      </div>

      {/* Charisma Party Header */}
      <div className="guild-header">
        <div className="header-left">
          <h1 className="guild-title">
            <span className="guild-text">CHARISMA</span>
            <span className="hall-subtitle">PARTY</span>
          </h1>
          
          {/* Market Stats Dashboard */}
          <div className="market-stats">
            <div className="stat-item">
              <span className="stat-label">Active</span>
              <span className="stat-value">{marketStats.totalActive}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total</span>
              <span className="stat-value">{marketStats.totalBattles}</span>
            </div>
            {marketStats.biggestWinner && (
              <div className="stat-item winner">
                <span className="stat-label">Top</span>
                <span className="stat-value">
                  {marketStats.biggestWinner.symbol} +{marketStats.biggestWinner.changePercent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          <div className={`oracle-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-orb"></div>
            <span className="status-text">
              {isConnected ? 'LIVE' : 'CONNECTING...'}
            </span>
          </div>
        </div>

        <div className="guild-controls">
          <button 
            className={`rune-btn ${battleMode ? 'active' : ''}`}
            onClick={() => setBattleMode(!battleMode)}
            title="Active Only (Z)"
          >
            🎯
          </button>
          <button 
            className={`rune-btn ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle Sounds (S)"
          >
            {soundEnabled ? '🔔' : '🔕'}
          </button>
          <button 
            className="rune-btn"
            onClick={toggleFullscreen}
            title="Fullscreen (F)"
          >
            {isFullscreen ? '🏠' : '⚡'}
          </button>
          <button 
            className="rune-btn"
            onClick={() => setShowHelp(!showHelp)}
            title="Help (?)"
          >
            ❓
          </button>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="price-party-layout">
        
        {/* Main Arena - Top 8 Most Active */}
        <div className="main-arena">
          <h2 className="section-title">🎯 Main Stage</h2>
          <div className="arena-grid">
            {arenaBattlers.map((battler) => (
              <div
                key={battler.contractId}
                className={`arena-card ${battler.trend} ${battler.isFlashing ? 'flash' : ''} ${selectedToken === battler.contractId ? 'selected' : ''}`}
                onClick={() => setSelectedToken(selectedToken === battler.contractId ? null : battler.contractId)}
              >
                <div className="scroll-header">
                  <div className="token-crest">
                    {battler.image ? (
                      <img src={battler.image} alt={battler.symbol} className="crest-image" />
                    ) : (
                      <div className="crest-symbol">
                        {battler.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="token-details">
                      <div className="token-name">{battler.symbol}</div>
                      <div className="activity-score">Activity: {battler.activityScore.toFixed(0)}</div>
                    </div>
                  </div>
                  
                  <div className={`battle-indicator ${battler.trend}`}>
                    {battler.trend === 'up' ? '📈' : battler.trend === 'down' ? '📉' : '➖'}
                  </div>
                </div>

                <div className="value-display">
                  <div className="current-value">{formatPrice(battler.price)}</div>
                  {battler.change !== 0 && (
                    <div className={`value-change ${battler.trend}`}>
                      {battler.change > 0 ? '+' : ''}{formatPrice(Math.abs(battler.change))}
                      <span className="change-percentage">
                        ({battler.changePercent > 0 ? '+' : ''}{battler.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>

                {selectedToken === battler.contractId && (
                  <div className="scroll-details">
                    <div className="detail-line">
                      <span>Previous</span>
                      <span>{formatPrice(battler.previousPrice)}</span>
                    </div>
                    <div className="detail-line">
                      <span>Last Update</span>
                      <span>{new Date(battler.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="detail-line">
                      <span>Activity Score</span>
                      <span>{battler.activityScore.toFixed(0)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Side Layout Container */}
        <div className="side-layout">
          
          {/* Token Roster - All Others */}
          <div className="token-roster">
            <h3 className="section-title">📋 All Tokens</h3>
            <div className="roster-list">
              {(battleMode ? rosterBattlers.filter(b => b.activityScore > 10) : rosterBattlers).map((battler) => (
                <div
                  key={battler.contractId}
                  className={`roster-item ${battler.trend} ${battler.isFlashing ? 'flash' : ''}`}
                  onClick={() => setSelectedToken(selectedToken === battler.contractId ? null : battler.contractId)}
                >
                  <div className="roster-left">
                    {battler.image ? (
                      <img src={battler.image} alt={battler.symbol} className="roster-image" />
                    ) : (
                      <div className="roster-symbol">
                        {battler.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="roster-info">
                      <div className="roster-name">{battler.symbol}</div>
                      <div className="roster-activity">
                        Score: {battler.activityScore.toFixed(0)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="roster-right">
                    <div className="roster-price">{formatPrice(battler.price)}</div>
                    {battler.change !== 0 && (
                      <div className={`roster-change ${battler.trend}`}>
                        {battler.changePercent > 0 ? '+' : ''}{battler.changePercent.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Battle Log */}
          <div className="battle-log">
            <h3 className="section-title">📊 Live Updates</h3>
            <div className="log-list">
              {battleEvents.slice(0, 10).map((event) => (
                <div
                  key={event.id}
                  className={`log-item ${event.type}`}
                >
                  <span className="log-message">{event.message}</span>
                  <span className="log-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {battleEvents.length === 0 && (
                <div className="log-empty">
                  Waiting for price updates...
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>

      {/* Help Overlay */}
      {showHelp && (
        <div className="guide-overlay" onClick={() => setShowHelp(false)}>
          <div className="guide-scroll" onClick={(e) => e.stopPropagation()}>
            <div className="guide-header">
              <h2>🎉 CHARISMA PARTY GUIDE</h2>
              <button className="guide-close" onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <div className="guide-grid">
              <div className="guide-section">
                <h3>⌨️ KEYBOARD SHORTCUTS</h3>
                <div className="command"><kbd>F</kbd> Toggle Fullscreen</div>
                <div className="command"><kbd>S</kbd> Toggle Sounds</div>
                <div className="command"><kbd>Z</kbd> Active Only Mode</div>
                <div className="command"><kbd>Space</kbd> Test Sound</div>
                <div className="command"><kbd>H / ?</kbd> Show This Guide</div>
                <div className="command"><kbd>Escape</kbd> Close Dialogs</div>
              </div>
              <div className="guide-section">
                <h3>🎯 FEATURES</h3>
                <div className="feature">🎯 Main Stage shows 8 most active tokens</div>
                <div className="feature">📋 All tokens list with activity scores</div>
                <div className="feature">📊 Live updates feed</div>
                <div className="feature">🔔 Audio feedback for price changes</div>
                <div className="feature">✨ Particles for big moves</div>
                <div className="feature">🖱️ Click cards for details</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="guild-status">
        <div className="status-left">
          <span className="guild-count">
            {battleMode ? '🎯 ACTIVE: ' : '🎉 CHARISMA: '}{battlers.length} TOKENS
          </span>
        </div>
        <div className="status-right">
          <span className="oracle-update">
            LAST UPDATE: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PriceTheater;