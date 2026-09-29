/**
 * SystemMetrics component for the extension popup
 * Displays bottom control bar with system information and action buttons
 */

import { useSpring, animated, config, useSpringRef, useChain } from "@react-spring/web"
import { colors } from "../../shared/styles/theme"
import { useSignetContext } from "~shared/context/SignetContext"
import { useState, useEffect, useRef, useMemo } from "react"

interface RefreshButtonProps {
  onClick: () => void;
  isLoading: boolean;
  activity?: number;
}

// Enhanced refresh button with React Spring animations and continuous activity pulse
function RefreshButton({ onClick, isLoading, activity = 0 }: RefreshButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [counter, setCounter] = useState(0);

  // Reference to chain animations
  const pulseRef = useSpringRef();
  const buttonRef = useSpringRef();

  // Continuous animation ticker
  const tickSpring = useSpring({
    from: { t: 0 },
    to: { t: 1 },
    loop: true,
    config: { duration: 50 }, // 20fps is enough for this effect
    // Update counter to drive continuous animations
    onChange: () => {
      setCounter(c => c + 1);
    }
  });

  // Pulse effect animation - subtly breathes continuously
  const pulseSpring = useSpring({
    // Subtle pulsing glow that increases with activity
    glow: activity * 0.5 + Math.sin(counter * 0.05) * (2 + activity * 0.2),
    // This provides the continuous breath effect
    scale: 1 + Math.sin(counter * 0.05) * 0.01 + (activity * 0.002),
    config: { tension: 170, friction: 26 },
    ref: pulseRef
  });

  // Button spring animation with improved state transitions
  const buttonSpring = useSpring({
    // Background transitions between states with increased glow on activity
    background: isLoading
      ? 'rgba(125, 249, 255, 0.05)'
      : isHovered
        ? 'rgba(125, 249, 255, 0.15)'
        : 'rgba(125, 249, 255, 0.1)',
    // Dynamic box shadow based on activity and state
    boxShadow: isLoading
      ? `0 0 ${10 + pulseSpring.glow.get()}px rgba(125, 249, 255, 0.15)`
      : isHovered
        ? `0 0 ${12 + pulseSpring.glow.get()}px rgba(125, 249, 255, 0.2)`
        : `0 0 ${pulseSpring.glow.get()}px rgba(125, 249, 255, 0.1)`,
    // Scale effect on hover and activity
    scale: pulseSpring.scale.to(s =>
      isHovered && !isLoading ? s * 1.02 : s
    ),
    config: { tension: 210, friction: 20 },
    ref: buttonRef
  });

  // Spinner rotation animation - smoother continuous rotation
  const spinnerSpring = useSpring({
    rotation: isLoading ? tickSpring.t.to(t => t * 360) : 0,
    opacity: isLoading ? 1 : 0,
    config: { tension: 100, friction: 10 }
  });

  // Icon animation - fades and scales opposite to spinner
  const iconSpring = useSpring({
    opacity: isLoading ? 0 : 1,
    scale: isLoading ? 0.8 : 1,
    config: { tension: 200, friction: 17 }
  });

  // Chain the animations
  useChain(isLoading ? [pulseRef, buttonRef] : [buttonRef, pulseRef], [0, 0.1]);

  return (
    <animated.button
      onClick={isLoading ? undefined : onClick}
      disabled={isLoading}
      style={{
        background: buttonSpring.background,
        boxShadow: buttonSpring.boxShadow,
        transform: buttonSpring.scale.to(s => `scale(${s})`),
        border: '1px solid rgba(125, 249, 255, 0.3)',
        borderRadius: '4px',
        padding: '8px 16px',
        fontSize: '11px',
        color: isLoading ? 'rgba(125, 249, 255, 0.7)' : colors.cyber,
        cursor: isLoading ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        outline: 'none',
        transition: 'border-color 0.3s ease'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <animated.div
        style={{
          width: '14px',
          height: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        {/* Loading spinner that fades in/out */}
        <animated.div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            border: '2px solid rgba(125, 249, 255, 0.1)',
            borderTop: '2px solid rgba(125, 249, 255, 0.8)',
            transform: spinnerSpring.rotation.to(r => `rotate(${r}deg)`),
            opacity: spinnerSpring.opacity,
            position: 'absolute',
            boxSizing: 'border-box'
          }}
        />

        {/* Refresh icon that fades in/out opposite to spinner */}
        <animated.svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transform: iconSpring.scale.to(s => `scale(${s})`),
            opacity: iconSpring.opacity,
            position: 'absolute'
          }}
        >
          <path
            d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3"
            stroke={colors.cyber}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 8L16 3L20 8"
            stroke={colors.cyber}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </animated.svg>
      </animated.div>

      <animated.span
        style={{
          fontWeight: 'medium',
          letterSpacing: '0.5px',
          opacity: isLoading ?
            spinnerSpring.opacity.to(o => 0.7 + (o * 0.3)) :
            iconSpring.opacity.to(o => 0.7 + (o * 0.3))
        }}
      >
        {isLoading ? 'SYNCING...' : 'REFRESH'}
      </animated.span>
    </animated.button>
  );
}

export function SystemMetrics() {
  // Get state and actions from the context
  const { status, refreshStatus, isLoading, refreshBalances } = useSignetContext();

  // Counter to drive animations
  const [counter, setCounter] = useState(0);

  // Activity level tracking
  const [activity, setActivity] = useState(0);

  // Animation to continuously update our counter
  const tickSpring = useSpring({
    from: { t: 0 },
    to: { t: 1 },
    loop: true,
    config: { duration: 50 },
    onChange: () => {
      setCounter(c => c + 1);
    }
  });

  // Helper function to count all pending transactions
  const countPendingTx = () => {
    if (!status) return 0;
    return Object.values(status).reduce(
      (total, subnetStatus) => total + (subnetStatus.txQueue?.length || 0),
      0
    );
  };

  // Helper function to get highest block number
  const getHighestBlock = () => {
    if (!status) return 0;
    const blocks = Object.values(status)
      .map(subnetStatus => 0);
    return blocks.length > 0 ? Math.max(...blocks) : 0;
  };

  // Calculate metrics based on real data
  const txQueueSize = countPendingTx();
  const blockHeight = getHighestBlock();
  const subnetCount = status ? Object.keys(status).length : 0;

  // Detect changes to update activity level
  useEffect(() => {
    // Boost activity on data changes
    setActivity(10);

    // Decay activity over time
    const decay = setInterval(() => {
      setActivity(prev => Math.max(0, prev - 1));
    }, 200);

    return () => clearInterval(decay);
  }, [txQueueSize, subnetCount, isLoading]);

  // Format subnet version string
  const subnetVersions = status
    ? Object.values(status)
      .filter(s => s && s.subnet)
      .map(s => s.subnet.split('.')[1])
      .join(', ')
    : 'NA';

  // Truncate if too long
  const subnetVersion = subnetCount > 2
    ? `${subnetCount} SUBNETS`
    : subnetVersions;

  // Glow animation for container
  const containerSpring = useSpring({
    boxShadow: `0 5px 15px rgba(0, 0, 0, 0.3), inset 0 0 ${Math.max(0, activity)}px rgba(125, 249, 255, 0.1)`,
    borderTop: `1px solid rgba(125, 249, 255, ${0.3 + (activity * 0.02)})`,
    config: { tension: 170, friction: 26 }
  });

  // Handle refresh click
  const handleRefreshClick = () => {
    refreshStatus();
    refreshBalances();
    setActivity(10); // Boost activity on manual refresh
  };

  // Circular indicator spring animation
  const indicatorSpring = useSpring({
    rotation: counter * 2, // Slow rotation
    scale: 1 + Math.sin(counter * 0.05) * 0.05, // Subtle pulse
    opacity: txQueueSize > 0 ? 0.8 : 0.4,
    color: txQueueSize > 0 ?
      'rgba(255, 204, 0, 0.8)' :
      'rgba(125, 249, 255, 0.6)',
    config: { tension: 120, friction: 14 }
  });

  // Timestamp display that updates with counter
  const timestamp = useMemo(() => {
    // Get HH:MM:SS format
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }, [counter]); // Counter drives updates

  return (
    <animated.div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(180deg, rgba(13, 17, 23, 0.9) 0%, #0D1117 100%)',
      padding: '10px 12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTop: containerSpring.borderTop,
      boxShadow: containerSpring.boxShadow,
      zIndex: 2
    }}>
      {/* System readout with real metrics */}
      <div style={{
        fontSize: '9px',
        color: 'rgba(255, 255, 255, 0.7)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* Indicator dot */}
        <animated.div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: indicatorSpring.color,
          boxShadow: indicatorSpring.color.to(c => `0 0 6px ${c}`),
          opacity: indicatorSpring.opacity,
          transform: indicatorSpring.scale.to(s => `scale(${s})`),
        }} />

        {/* System time & metrics */}
        <div style={{
          opacity: txQueueSize > 0 ? 0.9 : 0.6,
          fontFamily: 'monospace'
        }}>
          <div>{timestamp}</div>
          {subnetCount > 0 && (
            <div>SUBNETS: {subnetCount}</div>
          )}
        </div>
      </div>

      {/* Control buttons with real actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Enhanced Sync button with activity pulse */}
        <RefreshButton
          onClick={handleRefreshClick}
          isLoading={isLoading}
          activity={activity}
        />
      </div>

      {/* Pending transactions indicator */}
      {txQueueSize > 0 && (
        <animated.div style={{
          fontSize: '10px',
          color: 'rgba(255, 204, 0, 0.8)',
          fontWeight: 'bold',
          marginLeft: '12px',
          padding: '2px 8px',
          background: 'rgba(255, 204, 0, 0.1)',
          border: '1px solid rgba(255, 204, 0, 0.3)',
          borderRadius: '10px',
          boxShadow: `0 0 ${Math.max(2, activity)}px rgba(255, 204, 0, 0.3)`,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>{txQueueSize}</span>
          <span style={{ fontSize: '8px', opacity: 0.8 }}>PENDING</span>
        </animated.div>
      )}
    </animated.div>
  );
}