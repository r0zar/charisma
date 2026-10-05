/**
 * HologramDisplay component for the extension popup
 * Displays an advanced HUD-style terminal interface with real-time Signet data
 */

import { useMemo, useState, useRef, useEffect } from "react";
import { useSpring, animated, config, useSpringRef, useChain } from "@react-spring/web";
import { useSignetContext } from "~shared/context/SignetContext";
import { useDiagnostics } from "../diagnostics-context";
import { colors, glow, tint } from "~shared/styles/theme";
import {
  StatusIndicator,
  HUDSection,
  ScanLine,
  MemoryBar
} from "./index";

/** Smallest units → short readable amount */
const formatUnits = (raw: string, decimals: number) =>
  (Number(raw) / 10 ** decimals).toLocaleString('en-US', { maximumFractionDigits: 4 });

// Main HUD component
export function HologramDisplay() {
  // Get state from the context
  const { currentAccount } = useSignetContext();
  const { diag, loading: isLoading, error } = useDiagnostics();

  // Time since the last real check
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const getSyncTimerDisplay = () => `${((Date.now() - lastRefreshTime) / 1000).toFixed(2)}s`;
  useEffect(() => { setLastRefreshTime(Date.now()); }, [diag?.checkedAt]);

  // Subnets where this account holds funds (also drives the scan pulses)
  const heldSubnets = diag ? diag.subnets.filter(subnet => subnet.balance && subnet.balance !== '0') : [];
  const txQueueSize = heldSubnets.length;
  const subnetCount = diag?.subnets.length ?? 0;
  const messyCount = diag ? diag.subnets.filter(subnet => subnet.issues.length > 0).length : 0;

  // Health from real response times: instant = 100%, 2 seconds or slower = 0%
  const healthOf = (ms: number) => Math.max(0, Math.min(100, 100 - ms / 20));
  const connectionStability = diag ? healthOf(diag.network.latencyMs) : 0;
  const txLoad = diag ? healthOf(diag.tokenCache.latencyMs) : 0;

  const nodeStatus = error ? 'ERROR' : !diag ? 'SYNCING' : 'LIVE';

  // Minutes until the wallet locks itself
  const lockMinutes = diag?.account.lockExpiresAt ? Math.max(0, Math.ceil((diag.account.lockExpiresAt - Date.now()) / 60000)) : null;

  // Determine display color based on status - but stable during loading to prevent flashing
  const displayColor = error ? 'color-mix(in srgb, var(--danger) 80%, transparent)' : // Red for error
    // Always use cyan for both loading and normal states to prevent color flashing
    'color-mix(in srgb, var(--hud-accent) 80%, transparent)'; // Cyan for both loading and normal

  // Active signer color - check if currentAccount exists first
  const signerColor = currentAccount && currentAccount.stxAddress ? 'color-mix(in srgb, var(--success) 80%, transparent)' : 'color-mix(in srgb, var(--hud-accent) 40%, transparent)';

  // Counter to drive animations
  const [counter, setCounter] = useState(0);

  // Re-read on every tick (the counter re-renders)
  const syncTimer = getSyncTimerDisplay();

  // Data metrics
  const metrics = [
    {
      label: "SYNC",
      value: syncTimer,
      color: 'color-mix(in srgb, var(--hud-accent) 80%, transparent)'
    },
    {
      label: "SUBNETS",
      value: subnetCount.toString(),
      color: subnetCount > 0 ? 'color-mix(in srgb, var(--success) 80%, transparent)' : 'color-mix(in srgb, var(--danger) 80%, transparent)'
    },
    {
      label: "HELD",
      value: txQueueSize.toString().padStart(2, '0'),
      color: txQueueSize > 0 ? 'color-mix(in srgb, var(--warning) 80%, transparent)' : 'color-mix(in srgb, var(--hud-accent) 80%, transparent)'
    },
    {
      label: "STATUS",
      value: nodeStatus,
      color: nodeStatus === 'ERROR' ? 'color-mix(in srgb, var(--danger) 80%, transparent)' :
        nodeStatus === 'LIVE' ? 'color-mix(in srgb, var(--success) 80%, transparent)' :
          'color-mix(in srgb, var(--hud-accent) 80%, transparent)'
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

      // Every 300 ticks, a pulse (the sync timer resets only when fresh data arrives)
      if (counter % 300 === 0 && counter > 0) {
        setActivity(10); // Boost activity
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

  // Glow and border follow the activity springs (colors stay out of springs, so a theme switch shows at once)
  const glowSpring = {
    // Dynamic glow effect based on activity and loading state
    glow: activitySpring.value.to(a =>
      `0 0 20px color-mix(in srgb, #000 calc(80% * var(--shade)), transparent), inset 0 0 ${Math.max(8, 8 + Math.min(txQueueSize, 4) + a / 2)}px ${glow(colors.accent, 0.8)}`
    ),
    // Border color that pulses when loading without changing hue
    border: activitySpring.loading.to(l =>
      l === 1
        ? tint(colors.accent, 0.3 + Math.sin(Date.now() * 0.005) * 0.3) // Pulsing opacity when loading
        : tint(colors.accent, 0.3) // Fixed when not loading
    ),
  };

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
    background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
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
          glow => `linear-gradient(165deg, color-mix(in srgb, var(--surface-raised) 90%, transparent) 0%, color-mix(in srgb, var(--bg) 85%, transparent) 100%)`
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
        background: 'color-mix(in srgb, #000 calc(50% * var(--shade)), transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--hud-accent) 40%, transparent)', // Fixed color instead of dynamic
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: '8px',
        color: 'color-mix(in srgb, var(--hud-accent) 80%, transparent)', // Fixed color to prevent flashing
        fontFamily: 'var(--font-mono)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <animated.span style={{
            color: 'color-mix(in srgb, var(--hud-accent) 80%, transparent)',
            // Dynamic text shadow that responds to activity - no animation
            textShadow: activitySpring.value.to(
              a => `0 0 ${Math.min(a, 5)}px color-mix(in srgb, var(--hud-accent) calc(60% * var(--glow)), transparent)`
            ),
            // No pulse animation for stability
            display: 'inline-block'
          }}>BLAZE</animated.span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {metrics.map((metric, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'color-mix(in srgb, var(--ink) 60%, transparent)' }}>{metric.label}:</span>
              <animated.span
                style={{
                  color: metric.color,
                  // Dynamic text shadow based on activity - no movement
                  textShadow: activitySpring.value.to(
                    a => `0 0 ${Math.min(a, 3)}px ${glow(metric.color, 0.375)}`
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
          title="STACKS NETWORK"
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
                <span style={{ color: 'color-mix(in srgb, var(--ink) 60%, transparent)', fontSize: '8px' }}>STATUS:</span>
                <span style={{
                  color: nodeStatus === 'ERROR' ? 'color-mix(in srgb, var(--danger) 80%, transparent)' :
                    nodeStatus === 'LIVE' ? 'color-mix(in srgb, var(--success) 80%, transparent)' :
                      'color-mix(in srgb, var(--hud-accent) 80%, transparent)',
                  fontWeight: 'bold',
                  fontSize: '8px'
                }}>
                  {nodeStatus}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: 'color-mix(in srgb, var(--ink) 60%, transparent)', fontSize: '8px' }}>BLOCK:</span>
                <span style={{
                  color: connectionStability > 75 ? 'color-mix(in srgb, var(--success) 80%, transparent)' :
                    connectionStability > 25 ? 'color-mix(in srgb, var(--warning) 80%, transparent)' :
                      'color-mix(in srgb, var(--hud-accent) 80%, transparent)',
                  fontWeight: 'bold',
                  fontSize: '8px'
                }}>
                  {diag ? diag.network.blockHeight.toLocaleString('en-US') : '—'}
                </span>
              </div>
            </div>

            <div>
              <span style={{ color: 'color-mix(in srgb, var(--ink) 60%, transparent)', fontSize: '8px' }}>RESPONSE {diag ? `${diag.network.latencyMs}MS` : ''}:</span>
              <MemoryBar
                value={connectionStability}
                color={connectionStability > 75 ? 'color-mix(in srgb, var(--success) 80%, transparent)' :
                  connectionStability > 25 ? 'color-mix(in srgb, var(--warning) 80%, transparent)' :
                    'color-mix(in srgb, var(--hud-accent) 80%, transparent)'}
                activity={activity}
              />
            </div>
          </div>
        </HUDSection>

        {/* Transaction Stats Section */}
        <HUDSection
          title="BLAZE SUBNETS"
          value={`${subnetCount}`}
          color={displayColor}
          position={{ top: '4px', right: '5px' }}
          width="45%"
          height="38%"
          activity={activity}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'color-mix(in srgb, var(--ink) 60%, transparent)', fontSize: '8px' }}>HOLDING FUNDS:</span>
                <span style={{
                  color: displayColor,
                  fontWeight: 'bold',
                  fontSize: '8px',
                  textShadow: activity > 0 ? `0 0 ${Math.min(activity / 2, 4)}px ${glow(displayColor, 1)}` : 'none'
                }}>
                  {txQueueSize}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: 'color-mix(in srgb, var(--ink) 60%, transparent)', fontSize: '8px' }}>MESSY METADATA:</span>
                <span style={{
                  color: messyCount > 0 ? 'color-mix(in srgb, var(--warning) 80%, transparent)' : 'color-mix(in srgb, var(--success) 80%, transparent)',
                  fontWeight: 'bold',
                  fontSize: '8px'
                }}>
                  {messyCount}
                </span>
              </div>
            </div>

            <div>
              <span style={{ color: 'color-mix(in srgb, var(--ink) 60%, transparent)', fontSize: '8px' }}>TOKEN LIST {diag ? `${diag.tokenCache.latencyMs}MS` : ''}:</span>
              <MemoryBar
                value={txLoad}
                color={txLoad > 75 ? 'color-mix(in srgb, var(--success) 80%, transparent)' :
                  txLoad > 25 ? 'color-mix(in srgb, var(--warning) 80%, transparent)' :
                    'color-mix(in srgb, var(--danger) 80%, transparent)'}
                activity={activity}
              />
            </div>
          </div>
        </HUDSection>

        {/* Transaction Log Section */}
        <HUDSection
          title="YOUR SUBNETS"
          value=""
          color={txQueueSize > 0 ? 'color-mix(in srgb, var(--warning) 80%, transparent)' : displayColor}
          position={{ bottom: '5px', left: '5px' }}
          width="45%"
          height="45%"
          activity={activity}
        >
          <div style={{
            overflowY: 'hidden',
            height: '100%',
            fontSize: '8px',
            fontFamily: 'var(--font-mono)',
            color: 'color-mix(in srgb, var(--ink) 70%, transparent)'
          }}>
            {heldSubnets.length > 0 ? (
              <div>
                {heldSubnets.slice(0, 5).map(subnet => (
                  <div key={subnet.contractId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ color: 'color-mix(in srgb, var(--success) 80%, transparent)', fontWeight: 'bold' }}>{subnet.symbol}</span>
                    <span>{formatUnits(subnet.balance!, subnet.decimals)}</span>
                  </div>
                ))}
                {heldSubnets.length > 5 && (
                  <div style={{ color: 'color-mix(in srgb, var(--ink) 40%, transparent)', fontSize: '7px', marginTop: '2px' }}>
                    + {heldSubnets.length - 5} more
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: 'color-mix(in srgb, var(--hud-accent) 50%, transparent)'
              }}>
                {diag ? `No funds on any of ${subnetCount} subnets` : 'Checking subnets…'}
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
                  color: 'color-mix(in srgb, var(--success) 80%, transparent)',
                  marginBottom: '4px'
                }}>
                  <StatusIndicator
                    color="color-mix(in srgb, var(--success) 80%, transparent)"
                    value={activity}
                  />
                  <span style={{ fontWeight: 'bold' }}>WALLET CONNECTED</span>
                </div>
                <div style={{ fontSize: '7px', color: 'color-mix(in srgb, var(--ink) 70%, transparent)', marginBottom: '2px' }}>
                  ACTIVE ADDRESS:
                </div>
                <div style={{
                  fontSize: '8px',
                  color: 'color-mix(in srgb, var(--hud-accent) 90%, transparent)',
                  wordBreak: 'break-all'
                }}>
                  {currentAccount.stxAddress.slice(0, 6)}...{currentAccount.stxAddress.slice(-6)}
                </div>
                <div style={{ fontSize: '7px', color: 'color-mix(in srgb, var(--ink) 70%, transparent)', marginTop: '4px' }}>
                  AUTO-LOCK IN {lockMinutes === null ? '—' : `${lockMinutes} MIN`}
                </div>
                <MemoryBar
                  value={lockMinutes === null ? 0 : (lockMinutes / 15) * 100}
                  color={'color-mix(in srgb, var(--success) 80%, transparent)'}
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
                  color: 'color-mix(in srgb, var(--warning) 80%, transparent)',
                }}>
                  <StatusIndicator
                    color="color-mix(in srgb, var(--warning) 80%, transparent)"
                    value={activity}
                  />
                  <span>NO WALLET CONNECTED</span>
                </div>
                <div style={{
                  fontSize: '7px',
                  color: 'color-mix(in srgb, var(--ink) 50%, transparent)',
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