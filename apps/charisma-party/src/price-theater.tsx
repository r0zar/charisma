'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Target,
  Coins,
  Volume2,
  VolumeX,
  Maximize,
  Home,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Shield,
  Sprout,
  BarChart3,
  Sword,
  Settings,
  TargetIcon
} from 'lucide-react';
import { useOptimizedBlaze } from './hooks/useOptimizedBlaze';
import { marketDiscoveryService, MarketSnapshot } from './services/market-discovery';
import { RankedToken } from './services/activity-scoring';
import { useWallet } from './contexts/wallet-context';
import WalletConnectButton from './components/wallet-connect-button';

// Enhanced Types
interface TokenBattler {
  contractId: string;
  symbol: string;
  name: string;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  image?: string;
  timestamp: number;
  isFlashing: boolean;
  trend: 'up' | 'down' | 'neutral';
  activityScore: number;
  isInArena: boolean;
  marketCap: number | null;
  category: 'trending' | 'stable' | 'volatile' | 'emerging';
  significance: 'high' | 'medium' | 'low';
  rank: number;
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
  const { connected: walletConnected, address: walletAddress } = useWallet();

  // State declarations
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
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [flashingTokens, setFlashingTokens] = useState<Set<string>>(new Set());

  // Refs for tracking state
  const lastLoggedTokenCount = useRef(0);

  // Calculate initial tokens to watch (without balances)
  const initialWatchedTokens = useMemo(() => {
    const tokens = new Set<string>();

    // Add arena tokens
    arenaBattlers.forEach(battler => {
      if (battler.contractId) {
        tokens.add(battler.contractId);
      }
    });

    // Add roster tokens
    rosterBattlers.forEach(battler => {
      if (battler.contractId) {
        tokens.add(battler.contractId);
      }
    });

    const tokenArray = Array.from(tokens);
    // Only log when the count actually changes to reduce console spam
    if (tokenArray.length !== lastLoggedTokenCount.current) {
      lastLoggedTokenCount.current = tokenArray.length;
      console.log(`📊 PriceTheater: Initial watching ${tokenArray.length} tokens for prices`);
    }
    return tokenArray;
  }, [arenaBattlers, rosterBattlers]);

  // Use optimized blaze hook with initial watched tokens
  const { prices, isConnected, balances, updateWatchedTokens } = useOptimizedBlaze({
    userId: walletConnected ? walletAddress : undefined,
    watchedTokens: initialWatchedTokens
  });
  const previousPricesRef = useRef<Record<string, number>>({});
  const particleIdRef = useRef(0);
  const eventIdRef = useRef(0);
  const marketRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const hasUpdatedWithBalances = useRef(false);

  // Audio context for sound effects
  const audioContextRef = useRef<AudioContext | null>(null);

  // Convert RankedToken to TokenBattler format
  const convertToTokenBattler = (rankedToken: RankedToken, isArena: boolean = false): TokenBattler => {
    const currentPrice = rankedToken.priceStats.price || 0;
    const previousPrice = previousPricesRef.current[rankedToken.contractId] || currentPrice;
    const change = currentPrice - previousPrice;
    const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;

    // Enhanced image property handling - check multiple possible image properties
    const metadata = rankedToken.metadata;
    const image = metadata?.image || metadata?.imageUrl || metadata?.image_url || metadata?.icon || null;

    if (rankedToken.contractId.includes('sbtc-token') || rankedToken.contractId.includes('.stx')) {
      console.log(`[PriceTheater] Debug image for ${rankedToken.contractId}:`, {
        hasMetadata: !!metadata,
        image: image,
        imageProperty: metadata?.image,
        imageUrlProperty: metadata?.imageUrl,
        metadata: metadata
      });
    }

    return {
      contractId: rankedToken.contractId,
      symbol: rankedToken.metadata?.symbol || rankedToken.contractId.slice(0, 6).toUpperCase(),
      name: rankedToken.metadata?.name || rankedToken.metadata?.symbol || 'Unknown',
      price: currentPrice,
      previousPrice,
      change,
      changePercent,
      change1h: rankedToken.priceStats.change1h,
      change24h: rankedToken.priceStats.change24h,
      change7d: rankedToken.priceStats.change7d,
      image: image,
      timestamp: Date.now(),
      isFlashing: Math.abs(change) > 0.00001,
      trend: rankedToken.activityScore.trend,
      activityScore: rankedToken.activityScore.total,
      isInArena: isArena,
      marketCap: rankedToken.marketcap,
      category: rankedToken.category,
      significance: rankedToken.activityScore.significance,
      rank: rankedToken.activityScore.rank,
    };
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

  // Load market data and update token lists
  const loadMarketData = async () => {
    try {
      setIsLoadingMarket(true);
      const snapshot = await marketDiscoveryService.getMarketSnapshot({
        arenaSize: 8,
        rosterSize: 50,
      });

      setMarketSnapshot(snapshot);

      // Convert to TokenBattler format and ensure proper ordering
      const arenaTokens = snapshot.arenaTokens
        .map(token => convertToTokenBattler(token, true))
        .sort((a, b) => a.rank - b.rank); // Ensure arena tokens are sorted by rank

      const rosterTokens = snapshot.rosterTokens
        .map(token => convertToTokenBattler(token, false))
        .sort((a, b) => a.rank - b.rank); // Ensure roster tokens are sorted by rank

      const allTokens = [...arenaTokens, ...rosterTokens];

      setArenaBattlers(arenaTokens);
      setRosterBattlers(rosterTokens);
      setBattlers(allTokens);

      // Update previous prices for change calculation
      allTokens.forEach(token => {
        if (previousPricesRef.current[token.contractId] === undefined) {
          previousPricesRef.current[token.contractId] = token.price;
        }
      });

      console.log(`[PriceTheater] Market data loaded: ${arenaTokens.length} arena, ${rosterTokens.length} roster tokens`);
      console.log('[PriceTheater] Arena tokens:', arenaTokens.slice(0, 3));
      console.log('[PriceTheater] Roster tokens:', rosterTokens.slice(0, 3));
      console.log('[PriceTheater] Market snapshot:', snapshot);
      console.log('[PriceTheater] Raw snapshot tokens:', snapshot.arenaTokens.length, snapshot.rosterTokens.length);

    } catch (error) {
      console.error('[PriceTheater] Error loading market data:', error);
    } finally {
      setIsLoadingMarket(false);
    }
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

  // Memoize balance tokens to prevent unnecessary recalculation
  const balanceTokens = useMemo(() => {
    if (!walletConnected || !walletAddress || !balances) return [];

    return Object.keys(balances)
      .filter(key => key.startsWith(walletAddress) && parseFloat(balances[key]?.balance || '0') > 0)
      .map(key => key.split(':')[1])
      .filter(contractId => contractId && contractId !== 'undefined');
  }, [balances, walletConnected, walletAddress]);

  // Memoize complete watched tokens list
  const completeWatchedTokens = useMemo(() => {
    const allTokens = new Set([
      ...arenaBattlers.map(b => b.contractId),
      ...rosterBattlers.map(b => b.contractId),
      ...balanceTokens
    ]);

    return Array.from(allTokens).filter(Boolean);
  }, [arenaBattlers, rosterBattlers, balanceTokens]);

  // Update watched tokens only once when balances first become available
  useEffect(() => {
    if (balanceTokens.length > 0 && !hasUpdatedWithBalances.current) {
      hasUpdatedWithBalances.current = true;
      console.log(`📊 PriceTheater: Updating to watch ${completeWatchedTokens.length} tokens (${balanceTokens.length} from balances)`);
      updateWatchedTokens(completeWatchedTokens);
    }
  }, [balanceTokens.length, completeWatchedTokens, updateWatchedTokens]);

  // Initialize market data and set up refresh intervals
  useEffect(() => {
    console.log('[PriceTheater] Initializing market data...');
    loadMarketData();

    // Set up periodic market data refresh
    marketRefreshInterval.current = setInterval(() => {
      loadMarketData();
    }, 6 * 1000); // Refresh every 6 seconds (10x faster)

    return () => {
      if (marketRefreshInterval.current) {
        clearInterval(marketRefreshInterval.current);
      }
    };
  }, []);

  // Process real-time price updates for visual effects
  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0 || !marketSnapshot) return;

    const newEvents: BattleEvent[] = [];

    // Process only tokens that are in our current arena/roster
    const currentTokenIds = new Set([
      ...marketSnapshot.arenaTokens.map(t => t.contractId),
      ...marketSnapshot.rosterTokens.map(t => t.contractId)
    ]);

    const updatedTokens = new Set<string>();

    Object.entries(prices).forEach(([contractId, priceData]) => {
      if (!priceData || typeof priceData.price !== 'number') return;
      
      const previousPrice = previousPricesRef.current[contractId] || priceData.price;
      const change = priceData.price - previousPrice;
      const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
      const hasChanged = Math.abs(change) > 0.00001;

      if (hasChanged) {
        // Add to flashing tokens set for visual effect
        updatedTokens.add(contractId);
        
        // Only process arena/roster tokens for events and battles
        if (currentTokenIds.has(contractId)) {
          // Find the token in our current lists to get symbol
          const arenaToken = arenaBattlers.find(t => t.contractId === contractId);
          const rosterToken = rosterBattlers.find(t => t.contractId === contractId);
          const tokenInfo = arenaToken || rosterToken;

          if (tokenInfo) {
            const isSignificant = Math.abs(changePercent) > 2;

            // Create battle event
            const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral' as const;
            const battlerUpdate: TokenBattler = { ...tokenInfo, changePercent, trend };
            newEvents.push(createBattleEvent(battlerUpdate, isSignificant));

            // Create particles for significant price changes
            if (Math.abs(changePercent) > 0.01) {
              createPriceParticle(tokenInfo.symbol, change > 0 ? 'gain' : 'loss');

              // Play sound effect
              if (soundEnabled && audioContextRef.current) {
                playPriceSound(change > 0 ? 'up' : 'down');
              }
            }

            // Update the token's flash state
            const updateFlashState = (tokens: TokenBattler[]) =>
              tokens.map(token =>
                token.contractId === contractId
                  ? { ...token, isFlashing: true, price: priceData.price, change, changePercent }
                  : token
              );

            setArenaBattlers(updateFlashState);
            setRosterBattlers(updateFlashState);
          }
        }

        // Update previous price tracking
        previousPricesRef.current[contractId] = priceData.price;
      }
    });

    // Update flashing tokens state for treasury and other visual effects
    if (updatedTokens.size > 0) {
      setFlashingTokens(updatedTokens);
    }

    // Add new events to the beginning and limit to 50
    if (newEvents.length > 0) {
      setBattleEvents(prev => [...newEvents, ...prev].slice(0, 50));
    }

    // Clear flash effect after animation
    setTimeout(() => {
      setArenaBattlers(tokens => tokens.map(token => ({ ...token, isFlashing: false })));
      setRosterBattlers(tokens => tokens.map(token => ({ ...token, isFlashing: false })));
      setFlashingTokens(new Set());
    }, 500);

  }, [prices, soundEnabled, marketSnapshot, arenaBattlers, rosterBattlers]);

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

  // Format price display with up to 6 significant digits
  const formatPrice = (price: number): string => {
    if (price === 0) return '$0.00';

    if (price >= 1) {
      // For prices >= $1, show up to 6 significant digits
      const precision = Math.max(2, Math.min(6, 6 - Math.floor(Math.log10(price)) - 1));
      return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: precision
      })}`;
    } else if (price >= 0.000001) {
      // For small prices, use toPrecision to limit to 6 significant digits
      return `$${Number(price.toPrecision(6))}`;
    } else {
      // For very small prices, use scientific notation
      return `$${price.toExponential(2)}`;
    }
  };

  // Format market cap display
  const formatMarketCap = (marketCap: number | null): string => {
    if (!marketCap || marketCap <= 0) return 'N/A';

    if (marketCap >= 1_000_000_000) {
      return `$${(marketCap / 1_000_000_000).toFixed(1)}B`;
    } else if (marketCap >= 1_000_000) {
      return `$${(marketCap / 1_000_000).toFixed(1)}M`;
    } else if (marketCap >= 1_000) {
      return `$${(marketCap / 1_000).toFixed(1)}K`;
    } else {
      return `$${marketCap.toFixed(0)}`;
    }
  };

  // Get category icon component
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'trending': return <TrendingUp className="w-4 h-4" />;
      case 'volatile': return <Zap className="w-4 h-4" />;
      case 'stable': return <Shield className="w-4 h-4" />;
      case 'emerging': return <Sprout className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
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
            {particle.symbol} {particle.type === 'gain' ? <Sword className="w-3 h-3 inline" /> : <Shield className="w-3 h-3 inline" />}
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
              <span className="stat-value">{marketSnapshot?.activeTokens || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total</span>
              <span className="stat-value">{marketSnapshot?.totalTokens || 0}</span>
            </div>
            {marketSnapshot?.marketStats?.topGainer && (
              <div className="stat-item winner">
                <span className="stat-label">Top</span>
                <span className="stat-value">
                  {marketSnapshot.marketStats.topGainer.metadata?.symbol || 'Unknown'} +{(marketSnapshot.marketStats.topGainer.priceStats.change24h || 0).toFixed(1)}%
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
          <WalletConnectButton />
          <button
            className={`rune-btn ${battleMode ? 'active' : ''}`}
            onClick={() => setBattleMode(!battleMode)}
            title="Active Only (Z)"
          >
            <Target className="w-4 h-4" />
          </button>
          <button
            className={`rune-btn ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle Sounds (S)"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            className="rune-btn"
            onClick={toggleFullscreen}
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Home className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button
            className="rune-btn"
            onClick={() => setShowHelp(!showHelp)}
            title="Help (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="price-party-layout">

        {/* Left Column - Main Content */}
        <div className="main-content-column">
          {/* Main Arena - Top 8 Most Active */}
          <div className="main-arena">
            <h2 className="section-title">Main Stage</h2>
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
                        <div className="token-meta">
                          <span className="activity-score">#{battler.rank}</span>
                          <span className="market-cap">{formatMarketCap(battler.marketCap)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`battle-indicator ${battler.trend}`}>
                      <span className="category-icon">{getCategoryIcon(battler.category)}</span>
                      <span className="trend-icon">
                        {battler.trend === 'up' ? <TrendingUp className="w-4 h-4" /> :
                          battler.trend === 'down' ? <TrendingDown className="w-4 h-4" /> :
                            <Minus className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>

                  <div className="value-display">
                    <div className="current-value">{formatPrice(battler.price)}</div>
                    <div className="change-display">
                      {battler.change24h !== null && (
                        <div className={`change-24h ${battler.change24h >= 0 ? 'up' : 'down'}`}>
                          24h: {battler.change24h >= 0 ? '+' : ''}{battler.change24h.toFixed(2)}%
                        </div>
                      )}
                      {battler.change1h !== null && (
                        <div className={`change-1h ${battler.change1h >= 0 ? 'up' : 'down'}`}>
                          1h: {battler.change1h >= 0 ? '+' : ''}{battler.change1h.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedToken === battler.contractId && (
                    <div className="scroll-details">
                      <div className="detail-line">
                        <span>Market Cap</span>
                        <span>{formatMarketCap(battler.marketCap)}</span>
                      </div>
                      <div className="detail-line">
                        <span>Category</span>
                        <span>{getCategoryIcon(battler.category)} {battler.category}</span>
                      </div>
                      <div className="detail-line">
                        <span>Activity Rank</span>
                        <span>#{battler.rank} ({battler.significance})</span>
                      </div>
                      <div className="detail-line">
                        <span>Activity Score</span>
                        <span>{battler.activityScore.toFixed(1)}</span>
                      </div>
                      {battler.change24h !== null && (
                        <div className="detail-line">
                          <span>24h Change</span>
                          <span className={battler.change24h >= 0 ? 'up' : 'down'}>
                            {battler.change24h >= 0 ? '+' : ''}{battler.change24h.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Personal Treasury - User's Token Balances */}
          {walletConnected && (
            <div className="personal-treasury-wide">
              <h3 className="section-title">Personal Treasury</h3>
              <div className="treasury-grid">
                {Object.entries(balances).length === 0 ? (
                  <div className="treasury-empty">
                    Loading your treasure vault...
                  </div>
                ) : (
                  Object.entries(balances)
                    .filter(([key, balance]) => key.startsWith(walletAddress) && parseFloat(balance.balance) > 0)
                    .sort((a, b) => parseFloat(b[1].balance) - parseFloat(a[1].balance))
                    .slice(0, 12) // Show top 12 balances in grid
                    .map(([key, balance]) => {
                      const contractId = key.split(':')[1]!;
                      return (
                        <div key={key} className={`treasury-card ${flashingTokens.has(contractId) ? 'flash' : ''}`}>
                          <div className="treasury-header">
                            {balance.image ? (
                              <img src={balance.image} alt={balance.symbol} className="treasury-image" />
                            ) : (
                              <div className="treasury-symbol">
                                {(balance.symbol || contractId?.slice(0, 2) || '??').slice(0, 2)}
                              </div>
                            )}
                            <div className="treasury-info">
                              <div className="treasury-name">{balance.symbol || 'Unknown'}</div>
                              <div className="treasury-contract">
                                {contractId === '.stx' ? 'STX' : `${contractId?.slice(0, 6)}...`}
                              </div>
                            </div>
                          </div>

                          <div className="treasury-values">
                            <div className="treasury-balance">
                              {balance.formattedBalance ?
                                parseFloat(balance.formattedBalance.toString()).toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 4
                                }) :
                                parseFloat(balance.balance).toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 4
                                })
                              }
                            </div>
                            {contractId && prices[contractId] && (
                              <div className="treasury-value">
                                ${(
                                  (balance.formattedBalance || parseFloat(balance.balance)) *
                                  prices[contractId].price
                                ).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Side Layout Container */}
        <div className="side-layout">

          {/* Token Roster - All Others */}
          <div className="token-roster">
            <h3 className="section-title">All Tokens</h3>
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
            <h3 className="section-title">Live Updates</h3>
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
              <h2><Zap className="w-5 h-5 inline mr-2" />CHARISMA PARTY GUIDE</h2>
              <button className="guide-close" onClick={() => setShowHelp(false)}><span className="text-xl">×</span></button>
            </div>
            <div className="guide-grid">
              <div className="guide-section">
                <h3><Settings className="w-4 h-4 inline mr-2" />KEYBOARD SHORTCUTS</h3>
                <div className="command"><kbd>F</kbd> Toggle Fullscreen</div>
                <div className="command"><kbd>S</kbd> Toggle Sounds</div>
                <div className="command"><kbd>Z</kbd> Active Only Mode</div>
                <div className="command"><kbd>Space</kbd> Test Sound</div>
                <div className="command"><kbd>H / ?</kbd> Show This Guide</div>
                <div className="command"><kbd>Escape</kbd> Close Dialogs</div>
              </div>
              <div className="guide-section">
                <h3><Target className="w-4 h-4 inline mr-2" />FEATURES</h3>
                <div className="feature"><Target className="w-3 h-3 inline mr-1" />Main Stage shows 8 most active tokens</div>
                <div className="feature"><BarChart3 className="w-3 h-3 inline mr-1" />All tokens list with activity scores</div>
                <div className="feature"><Coins className="w-3 h-3 inline mr-1" />Personal Treasury with real-time balances</div>
                <div className="feature"><TrendingUp className="w-3 h-3 inline mr-1" />Live updates feed</div>
                <div className="feature"><Volume2 className="w-3 h-3 inline mr-1" />Audio feedback for price changes</div>
                <div className="feature"><Zap className="w-3 h-3 inline mr-1" />Particles for big moves</div>
                <div className="feature"><Target className="w-3 h-3 inline mr-1" />Click cards for details</div>
                <div className="feature"><Shield className="w-3 h-3 inline mr-1" />Connect Stacks wallet for balance tracking</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="guild-status">
        <div className="status-left">
          <span className="guild-count">
            {battleMode ? <><Target className="w-4 h-4 inline mr-1" />ACTIVE: </> : <><Zap className="w-4 h-4 inline mr-1" />CHARISMA: </>}{battlers.length} TOKENS
          </span>
          {marketSnapshot?.marketStats && (
            <span className="market-summary">
              | <BarChart3 className="w-3 h-3 inline mr-1" /> ${formatMarketCap(marketSnapshot.marketStats.totalMarketCap)} Total
              | <TrendingUp className="w-3 h-3 inline mr-1" /> {marketSnapshot.marketStats.averageChange24h.toFixed(1)}% Avg 24h
            </span>
          )}
        </div>
        <div className="status-right">
          <span className="oracle-update">
            LAST UPDATE: {new Date().toLocaleTimeString()}
          </span>
          {isLoadingMarket && (
            <span className="loading-indicator"><span className="animate-spin inline-block w-3 h-3 border border-magic-blue rounded-full border-t-transparent mr-1"></span>Loading market data...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceTheater;