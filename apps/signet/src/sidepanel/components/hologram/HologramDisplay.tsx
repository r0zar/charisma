/**
 * HologramDisplay component for the extension popup
 * Displays an advanced HUD-style terminal interface with real-time Signet data
 */

import { useMemo, useState, useRef, useEffect } from "react";
import { useSpring, animated, config, useSpringRef, useChain } from "@react-spring/web";
import { useSignetContext } from "~shared/context/SignetContext";
import {
  StatusIndicator,
  HUDSection,
  ScanLine,
  MemoryBar
} from "./index";

interface TransactionData {
  nonce: number;
  type: string;
  signer?: string;
  to?: string;
  subnet?: string;
  data?: any;
  marketId?: string;
  outcomeId?: number;
}

// Main HUD component
export function HologramDisplay() {
  // Get state from the context
  const { status, currentAccount, isLoading, error } = useSignetContext();

  // Function to count all pending transactions across subnets
  const countPendingTx = () => {
    if (!status) return 0;
    return Object.values(status).reduce(
      (total, subnetStatus) => total + (subnetStatus.txQueue?.length || 0),
      0
    );
  };

  // Track time since last refresh/sync
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  // Sync timer that updates with the counter
  const getSyncTimerDisplay = () => {
    const elapsedMs = Date.now() - lastRefreshTime;
    const seconds = (elapsedMs / 1000).toFixed(2);
    return `${seconds}s`;
  };

  // Calculate metrics based on real data
  const txQueueSize = countPendingTx();

  // Reset timer when txQueueSize changes (data refresh)
  useEffect(() => {
    setLastRefreshTime(Date.now());
  }, [txQueueSize, isLoading]);

  // Calculate connection stability (0-100%)
  const connectionStability = 100 - (txQueueSize > 10 ? 40 : txQueueSize * 4);

  // Calculate transaction load (0-100%)
  const txLoad = Math.min(100, txQueueSize * 5); // Each transaction = 5% load up to 100%

  // Count connected subnets
  const subnetCount = status ? Object.keys(status).length : 0;

  // Function to get all pending transactions from all subnets
  const getAllPendingTransactions = () => {
    if (!status) return [];

    // Gather transactions from all subnets
    const allTxs: TransactionData[] = [];
    Object.entries(status).forEach(([subnetId, subnetStatus]) => {
      const txQueue = subnetStatus.txQueue || [];
      // Add subnet info to each transaction
      txQueue.forEach(tx => {
        allTxs.push({
          ...tx,
          ...tx.data,
          subnet: subnetStatus.subnet
        });
      });
    });

    // Sort by nonce descending (most recent first)
    return allTxs.sort((a, b) => b.nonce - a.nonce);
  };

  // Determine node status
  const nodeStatus = error ? 'ERROR' :
    !status || subnetCount === 0 ? 'OFFLINE' :
      txQueueSize > 0 ? 'ACTIVE' : 'IDLE';

  // Determine display color based on status - but stable during loading to prevent flashing
  const displayColor = error ? 'rgba(255, 78, 78, 0.8)' : // Red for error
    // Always use cyan for both loading and normal states to prevent color flashing
    'rgba(125, 249, 255, 0.8)'; // Cyan for both loading and normal

  // Active signer color - check if currentAccount exists first
  const signerColor = currentAccount && currentAccount.stxAddress ? 'rgba(54, 199, 88, 0.8)' : 'rgba(125, 249, 255, 0.4)';

  // Counter to drive animations
  const [counter, setCounter] = useState(0);

  // Update last refresh time when counter resets
  useEffect(() => {
    if (counter === 0 || counter % 300 === 0) {
      setLastRefreshTime(Date.now());
    }
  }, [counter]);

  // Use memo to ensure sync timer updates with counter changes
  const syncTimer = useMemo(() => getSyncTimerDisplay(), [counter]);

  // Data metrics
  const metrics = [
    {
      label: "SYNC",
      value: syncTimer,
      color: 'rgba(125, 249, 255, 0.8)'
    },
    {
      label: "SUBNETS",
      value: subnetCount.toString(),
      color: subnetCount > 0 ? 'rgba(54, 199, 88, 0.8)' : 'rgba(255, 78, 78, 0.8)'
    },
    {
      label: "PENDING",
      value: txQueueSize.toString().padStart(2, '0'),
      color: txQueueSize > 0 ? 'rgba(255, 204, 0, 0.8)' : 'rgba(125, 249, 255, 0.8)'
    },
    {
      label: "STATUS",
      value: nodeStatus,
      color: nodeStatus === 'ERROR' ? 'rgba(255, 78, 78, 0.8)' :
        nodeStatus === 'ACTIVE' ? 'rgba(54, 199, 88, 0.8)' :
          'rgba(125, 249, 255, 0.8)'
    }
  ];

  // Activity level state - more responsive
  const [activity, setActivity] = useState(0);

  // References for sequencing animations
  const activityRef = useSpringRef();
  const containerRef = useSpringRef();

  // Animation that continuously updates the counter state
  // This drives our continuous animations
  const tickSpring = useSpring({
    from: { t: 0 },
    to: { t: 1 },
    loop: true,
    config: { duration: 50 }, // 20fps is plenty for these subtle animations
    onChange: () => {
      setCounter(c => c + 1);

      // Every 300 ticks, do a refresh
      if (counter % 300 === 0 && counter > 0) {
        setActivity(10); // Boost activity
        // Reset the sync timer on timed refreshes
        setLastRefreshTime(Date.now());
      } else {
        // Decay activity automatically
        setActivity(prev => Math.max(0, prev - 0.1));
      }
    }
  });

  // Activity tracking spring for coordinated animations
  const activitySpring = useSpring({
    // Directly map to activity state for use in animations
    value: activity,
    // Add a loading indicator that doesn't change color
    loading: isLoading ? 1 : 0,
    // Higher tension for faster response to changes
    config: { tension: 180, friction: 12 },
    ref: activityRef
  });

  // Create a trigger that changes when a significant event happens
  const scanTrigger = useMemo(() => ({ id: txQueueSize }), [txQueueSize]);

  // Container animation - now without floating movement
  const containerSpring = useSpring({
    // Initial fade-in effect only
    opacity: 1,
    y: 0,
    // Base config for smoother animations
    config: { tension: 170, friction: 24 },
    from: { opacity: 0, y: 20 },
    delay: 300,
    ref: containerRef
  });

  // Separate spring for glow effects to avoid TypeScript issues
  const glowSpring = useSpring({
    // Dynamic glow effect based on activity and loading state
    glow: activitySpring.value.to(a =>
      `0 0 20px rgba(0, 0, 0, 0.8), inset 0 0 ${Math.max(8, 8 + Math.min(txQueueSize, 4) + a / 2)}px rgba(125, 249, 255, 0.8)`
    ),
    // Border color that pulses when loading without changing hue
    border: activitySpring.loading.to(l =>
      l === 1
        ? `rgba(125, 249, 255, ${0.3 + Math.sin(Date.now() * 0.005) * 0.3})` // Pulsing opacity when loading
        : 'rgba(125, 249, 255, 0.3)' // Fixed when not loading
    ),
    config: { tension: 170, friction: 24 }
  });

  // Additional HUD effects animation - more subtle now
  const hudEffectsSpring = useSpring({
    // Extra ambient glow that responds to activity
    backgroundGlow: activitySpring.value.to(a => Math.min(0.12, 0.05 + (a * 0.005))),
    // No rotation or scaling effects to keep UI stable
    // Only use activity level to control effect intensity
    intensity: activitySpring.value.to(a => Math.min(1, a * 0.1)),
    config: { tension: 120, friction: 14 }
  });

  // Chain the animations to synchronize them
  useChain([activityRef, containerRef], [0, 0.1]);

  // Static styles for container
  const staticContainerStyle = {
    background: 'rgba(8, 12, 18, 0.85)',
    borderRadius: '2px',
    padding: '0px',
    paddingBottom: '4px',
    marginBottom: '0px',
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
    height: '220px',
  } as const;

  return (
    <animated.div
      style={{
        ...staticContainerStyle,
        // Simplified transform - just the initial animation, no continuous movement
        opacity: containerSpring.opacity,
        transform: containerSpring.y.to(y => `translateY(${y}px)`), // No scaling or continuous movement
        boxShadow: glowSpring.glow, // Use the dedicated glow spring
        borderColor: glowSpring.border, // Use the dedicated border spring
        // Subtle inner glow from background effect - static gradient
        background: hudEffectsSpring.backgroundGlow.to(
          glow => `linear-gradient(165deg, rgba(20, 30, 40, 0.9) 0%, rgba(8, 12, 18, 0.85) 100%)`
        )
      }}
    >
      {/* Enhanced scan line effects - continuous and responsive */}
      <animated.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: activitySpring.value.to(a => (a > 1 ? 0.5 : 0.3)), // More visible during activity
          overflow: 'hidden',
          zIndex: 5
        }}
      >
        {/* Primary scan line that triggers on data changes */}
        <ScanLine trigger={scanTrigger} />

        {/* Secondary periodic scan effect for ambient movement */}
        {counter % 50 === 0 && counter > 0 && (
          <ScanLine trigger={{ id: counter }} />
        )}
      </animated.div>

      {/* Status bar at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '16px',
        background: 'rgba(0, 0, 0, 0.5)',
        borderBottom: '1px solid rgba(125, 249, 255, 0.4)', // Fixed color instead of dynamic
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: '8px',
        color: 'rgba(125, 249, 255, 0.8)', // Fixed color to prevent flashing
        fontFamily: 'monospace',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <animated.span style={{
            color: 'rgba(125, 249, 255, 0.8)',
            // Dynamic text shadow that responds to activity - no animation
            textShadow: activitySpring.value.to(
              a => `0 0 ${Math.min(a, 5)}px rgba(125, 249, 255, 0.6)`
            ),
            // No pulse animation for stability
            display: 'inline-block'
          }}>SIGNET</animated.span>
          <span>v1.0</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {metrics.map((metric, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{metric.label}:</span>
              <animated.span
                style={{
                  color: metric.color,
                  // Dynamic text shadow based on activity - no movement
                  textShadow: activitySpring.value.to(
                    a => `0 0 ${Math.min(a, 3)}px ${metric.color.replace('0.8', '0.3')}`
                  ),
                  // No breathing effect for stability
                  display: 'inline-block'
                }}
              >
                {metric.value}
              </animated.span>
            </div>
          ))}
        </div>
      </div>

      {/* Main HUD sections */}
      <div style={{
        position: 'relative',
        margin: '20px 0 0 0',
        height: 'calc(100% - 20px)',
        padding: '2px'
      }}>
        {/* Signer Status Section */}
        <HUDSection
          title="SIGNER STATUS"
          value={nodeStatus}
          color={displayColor}
          position={{ top: '4px', left: '5px' }}
          width="45%"
          height="38%"
          activity={activity}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '8px' }}>STATUS:</span>
                <span style={{
                  color: nodeStatus === 'ERROR' ? 'rgba(255, 78, 78, 0.8)' :
                    nodeStatus === 'ACTIVE' ? 'rgba(54, 199, 88, 0.8)' :
                      'rgba(125, 249, 255, 0.8)',
                  fontWeight: 'bold',
                  fontSize: '8px'
                }}>
                  {nodeStatus}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '8px' }}>STABILITY:</span>
                <span style={{
                  color: connectionStability > 75 ? 'rgba(54, 199, 88, 0.8)' :
                    connectionStability > 25 ? 'rgba(255, 204, 0, 0.8)' :
                      'rgba(125, 249, 255, 0.8)',
                  fontWeight: 'bold',
                  fontSize: '8px'
                }}>
                  {Math.round(connectionStability)}%
                </span>
              </div>
            </div>

            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '8px' }}>CONNECTION HEALTH:</span>
              <MemoryBar
                value={connectionStability}
                color={connectionStability > 75 ? 'rgba(54, 199, 88, 0.8)' :
                  connectionStability > 25 ? 'rgba(255, 204, 0, 0.8)' :
                    'rgba(125, 249, 255, 0.8)'}
                activity={activity}
              />
            </div>
          </div>
        </HUDSection>

        {/* Transaction Stats Section */}
        <HUDSection
          title="TRANSACTION STATS"
          value={`${txQueueSize}`}
          color={displayColor}
          position={{ top: '4px', right: '5px' }}
          width="45%"
          height="38%"
          activity={activity}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '8px' }}>CONNECTED APPS:</span>
                <span style={{
                  color: displayColor,
                  fontWeight: 'bold',
                  fontSize: '8px',
                  textShadow: activity > 0 ? `0 0 ${Math.min(activity / 2, 4)}px ${displayColor}` : 'none'
                }}>
                  {subnetCount || 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '8px' }}>TX QUEUE SIZE:</span>
                <span style={{
                  color: txLoad > 75 ? 'rgba(255, 78, 78, 0.8)' :
                    txLoad > 25 ? 'rgba(255, 204, 0, 0.8)' :
                      'rgba(54, 199, 88, 0.8)',
                  fontWeight: 'bold',
                  fontSize: '8px'
                }}>
                  {txQueueSize} tx
                </span>
              </div>
            </div>

            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '8px' }}>QUEUE CAPACITY:</span>
              <MemoryBar
                value={txLoad}
                color={txLoad > 75 ? 'rgba(255, 78, 78, 0.8)' :
                  txLoad > 25 ? 'rgba(255, 204, 0, 0.8)' :
                    'rgba(54, 199, 88, 0.8)'}
                activity={activity}
              />
            </div>
          </div>
        </HUDSection>

        {/* Transaction Log Section */}
        <HUDSection
          title="TRANSACTION LOG"
          value=""
          color={txQueueSize > 0 ? 'rgba(255, 204, 0, 0.8)' : displayColor}
          position={{ bottom: '5px', left: '5px' }}
          width="45%"
          height="45%"
          activity={activity}
        >
          <div style={{
            overflowY: 'hidden',
            height: '100%',
            fontSize: '8px',
            fontFamily: 'monospace',
            color: 'rgba(255, 255, 255, 0.7)'
          }}>
            {txQueueSize > 0 ? (
              <div>
                {/* Collect transactions from all subnets and show the latest */}
                {getAllPendingTransactions().slice(0, 3).map((tx, i) => (
                  <div key={i} style={{ marginBottom: '2px' }}>
                    <div style={{
                      color:
                        tx.type === 'transfer' ? 'rgba(54, 199, 88, 0.8)' :
                          tx.type === 'predict' ? 'rgba(255, 204, 0, 0.8)' :
                            'rgba(125, 249, 255, 0.8)',
                      fontWeight: 'bold',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>{tx.type.toUpperCase()} #{tx.nonce}</span>
                      <span style={{
                        fontSize: '6px',
                        color: 'rgba(255, 204, 0, 0.6)',
                        alignSelf: 'center'
                      }}>
                        {tx.subnet && tx.subnet.includes('.') ? tx.subnet.split('.')[1] : tx.subnet}
                      </span>
                    </div>
                    <div style={{ fontSize: '7px', color: 'rgba(255, 255, 255, 0.5)' }}>
                      {tx.type === 'transfer' && tx.signer && tx.to ?
                        `${tx.signer.slice(0, 4)}...${tx.signer.slice(-4)} → ${tx.to.slice(0, 4)}...${tx.to.slice(-4)}` :
                        tx.type === 'predict' ?
                          `Market: ${tx.marketId}, Outcome: ${tx.outcomeId}` :
                          'Claim Reward'
                      }
                    </div>
                  </div>
                ))}
                {txQueueSize > 3 && (
                  <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '7px', marginTop: '2px' }}>
                    + {txQueueSize - 3} more pending...
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(125, 249, 255, 0.5)'
              }}>
                No pending transactions
              </div>
            )}
          </div>
        </HUDSection>

        {/* Wallet Section */}
        <HUDSection
          title="WALLET STATUS"
          value=""
          color={signerColor}
          position={{ bottom: '5px', right: '5px' }}
          width="45%"
          height="45%"
          activity={activity}
        >
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {currentAccount && currentAccount.stxAddress ? (
              <div>
                <div style={{
                  fontSize: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'rgba(54, 199, 88, 0.8)',
                  marginBottom: '4px'
                }}>
                  <StatusIndicator
                    color="rgba(54, 199, 88, 0.8)"
                    value={activity}
                  />
                  <span style={{ fontWeight: 'bold' }}>WALLET CONNECTED</span>
                </div>
                <div style={{ fontSize: '7px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '2px' }}>
                  ACTIVE ADDRESS:
                </div>
                <div style={{
                  fontSize: '8px',
                  color: 'rgba(125, 249, 255, 0.9)',
                  wordBreak: 'break-all'
                }}>
                  {currentAccount.stxAddress.slice(0, 6)}...{currentAccount.stxAddress.slice(-6)}
                </div>
                <MemoryBar
                  value={100}
                  color={'rgba(54, 199, 88, 0.8)'}
                  activity={activity}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  color: 'rgba(255, 204, 0, 0.8)',
                }}>
                  <StatusIndicator
                    color="rgba(255, 204, 0, 0.8)"
                    value={activity}
                  />
                  <span>NO WALLET CONNECTED</span>
                </div>
                <div style={{
                  fontSize: '7px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginTop: '6px'
                }}>
                  Set up wallet in wallet tab
                </div>
              </div>
            )}
          </div>
        </HUDSection>
      </div>
    </animated.div>
  );
}