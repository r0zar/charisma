/**
 * SystemMetrics component for the extension popup
 * Displays bottom control bar with system information and action buttons
 */

import { useSpring, animated, config, useSpringRef, useChain } from "@react-spring/web"
import { colors, glow, tint } from "../../shared/styles/theme"
import { useDiagnostics } from "./diagnostics-context"
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

  // Background and glow by state; colors stay out of springs, so a theme switch shows at once
  const background = tint(colors.accent, isLoading ? 0.05 : isHovered ? 0.15 : 0.1);
  const glowBase = isLoading ? 10 : isHovered ? 12 : 0;
  const glowAlpha = isLoading ? 0.15 : isHovered ? 0.2 : 0.1;

  // Button spring animation with improved state transitions
  const buttonSpring = useSpring({
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
        background,
        boxShadow: pulseSpring.glow.to(g => `0 0 ${Math.max(0, glowBase + g)}px ${glow(colors.accent, glowAlpha)}`),
        transform: buttonSpring.scale.to(s => `scale(${s})`),
        border: '1px solid color-mix(in srgb, var(--hud-accent) 30%, transparent)',
        borderRadius: '4px',
        padding: '8px 16px',
        fontSize: '11px',
        color: isLoading ? 'color-mix(in srgb, var(--hud-accent) 70%, transparent)' : colors.accent,
        cursor: isLoading ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        outline: 'none',
        transition: 'border-color 0.3s ease, background 0.2s ease'
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
            border: '2px solid color-mix(in srgb, var(--hud-accent) 10%, transparent)',
            borderTop: '2px solid color-mix(in srgb, var(--hud-accent) 80%, transparent)',
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
            stroke={colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 8L16 3L20 8"
            stroke={colors.accent}
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
  const { diag, refresh, loading: isLoading } = useDiagnostics();

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

  // Subnets where this account holds something, and how many subnets exist
  const txQueueSize = diag ? diag.subnets.filter(s => s.balance && s.balance !== '0').length : 0;
  const subnetCount = diag ? diag.subnets.length : 0;

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

  // Glow for the container, brighter with activity (it decays in steps; the transition smooths them)
  const containerStyle = {
    boxShadow: `0 5px 15px color-mix(in srgb, #000 calc(30% * var(--shade)), transparent), inset 0 0 ${Math.max(0, activity)}px ${glow(colors.accent, 0.1)}`,
    borderTop: `1px solid ${tint(colors.accent, 0.3 + (activity * 0.02))}`,
    transition: 'box-shadow 0.3s ease, border-color 0.3s ease'
  };

  // Handle refresh click
  const handleRefreshClick = () => {
    refresh();
    setActivity(10); // Boost activity on manual refresh
  };

  // Circular indicator spring animation
  const indicatorSpring = useSpring({
    rotation: counter * 2, // Slow rotation
    scale: 1 + Math.sin(counter * 0.05) * 0.05, // Subtle pulse
    opacity: txQueueSize > 0 ? 0.8 : 0.4,
    config: { tension: 120, friction: 14 }
  });
  const indicatorColor = txQueueSize > 0 ? tint(colors.warning, 0.8) : tint(colors.accent, 0.6);

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
      background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg) 90%, transparent) 0%, var(--bg) 100%)',
      padding: '10px 12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...containerStyle,
      zIndex: 2
    }} className="hud-chrome">
      {/* System readout with real metrics */}
      <div style={{
        fontSize: '9px',
        color: 'color-mix(in srgb, var(--ink) 70%, transparent)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* Indicator dot */}
        <animated.div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: indicatorColor,
          boxShadow: `0 0 6px ${glow(indicatorColor, 1)}`,
          opacity: indicatorSpring.opacity,
          transform: indicatorSpring.scale.to(s => `scale(${s})`),
        }} />

        {/* System time & metrics */}
        <div style={{
          opacity: txQueueSize > 0 ? 0.9 : 0.6,
          fontFamily: 'var(--font-mono)'
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
          color: 'color-mix(in srgb, var(--warning) 80%, transparent)',
          fontWeight: 'bold',
          marginLeft: '12px',
          padding: '2px 8px',
          background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
          borderRadius: '10px',
          boxShadow: `0 0 ${Math.max(2, activity)}px color-mix(in srgb, var(--warning) calc(30% * var(--glow)), transparent)`,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>{txQueueSize}</span>
          <span style={{ fontSize: '8px', opacity: 0.8 }}>HELD</span>
        </animated.div>
      )}
    </animated.div>
  );
}