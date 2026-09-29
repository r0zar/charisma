/**
 * StatusDisplay component for the extension popup
 * Shows a cyberpunk-inspired real-time counter with animated spring effects
 */

import { useSpring, animated, config, useSpringRef, useChain } from "@react-spring/web"
import { colors, tint } from '../../shared/styles/theme'
import { useSignetContext } from "~shared/context/SignetContext"
import { useCallback, useEffect, useRef, useState } from "react"

interface StatusDotProps {
  isLoading?: boolean;
  error?: boolean;
  activity?: number;
}

// Status indicator dot with spring physics
function StatusDot({ isLoading, error, activity = 0 }: StatusDotProps) {
  // Default and active colors
  const idleColor = error ? '#FF4E4E' : colors.cyber;
  const activeColor = error ? '#FF8888' : '#80E6FF';

  // Glow spring - pulses once when activity changes to 10
  const glowSpring = useSpring({
    // Map activity to color and glow - more dramatic pulse
    colorProgress: activity === 10 ? 1 : 0,
    boxShadowSpread: activity === 10 ? 10 : 2,
    // Only reset when activity is set to max
    reset: activity === 10,
    // Faster physics for more noticeable pulse
    config: {
      tension: 300,
      friction: 10
    }
  });

  // Loading indicator separate from activity
  const loadingSpring = useSpring({
    rotate: isLoading ? 360 : 0,
    config: { duration: 1500 },
    loop: isLoading,
  });

  return (
    <animated.div
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        // Interpolate between colors based on activity
        backgroundColor: glowSpring.colorProgress.to({
          range: [0, 0.5, 1],
          output: [idleColor, activeColor, idleColor]
        }),
        boxShadow: glowSpring.boxShadowSpread.to(
          s => `0 0 ${s}px ${tint(idleColor, 0.53)}`
        ),
        // Only rotate if loading
        transform: loadingSpring.rotate.to(r =>
          isLoading ? `rotate(${r}deg)` : 'none'
        ),
        border: isLoading ? '1px solid rgba(255,255,255,0.5)' : 'none'
      }}
    />
  );
}

interface AnimatedDigitProps {
  digit: string;
  index: number;
}

// Animated digit component - with different behavior based on position
function AnimatedDigit({ digit, index, totalDigits }: AnimatedDigitProps & { totalDigits: number }) {

  // Create a combined key that includes position and value
  const uniqueKey = `pos-${index}-val-${digit}`;

  // Different animation behavior based on position
  const spring = useSpring({
    // Only animate opacity
    opacity: 1,
    // Very minimal change for most digits
    from: { opacity: 0.9 },
    // Fast settle for most digits, slower for rapidly changing ones
    config: {
      tension: 300,
      friction: 25,
    },
    // Only reset when digit changes
    reset: true,
    // Unique key to track position and value separately
    key: uniqueKey
  });

  // Compute color based on position - creates a gradient effect
  // Brightest for the rapidly changing digit
  const brightness = 0.7 + (index * 0.02);
  const digitColor = `rgba(125, 249, 255, ${brightness})`;

  return (
    <span
      style={{
        display: 'inline-block',
        width: '0.55em', // Slightly narrower to fit all digits
        textAlign: 'center',
        color: digitColor,
        textShadow: `0 0 4px ${tint(digitColor, 0.53)}`,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        position: 'relative', // For proper stacking
        fontSize: '10px'
      }}
    >
      {/* The actual visible digit */}
      {digit}

      {/* Overlay effect that animates opacity when the value changes */}
      <animated.span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: digitColor,
          opacity: spring.opacity.to(o => (1 - o) * (0.2)), // More noticeable for rapid digits
          borderRadius: '1px',
          pointerEvents: 'none'
        }}
      />
    </span>
  );
}

export function StatusDisplay() {
  // Get state from the context
  const { status, error, isLoading, refreshStatus } = useSignetContext();

  // Counter to force component updates
  const [counter, setCounter] = useState(0);

  // Spring ref to chain animations
  const activityRef = useSpringRef();

  // This animation continuously updates every 16ms (60fps)
  // It drives a counter state that forces re-renders
  const tickSpring = useSpring({
    from: { t: 0 },
    to: { t: 1 },
    loop: true,
    config: { duration: 16 }, // 60fps update rate
    // This is what makes the digits continuously update
    onChange: () => {
      setCounter(c => c + 1);
    }
  });

  // Separate spring for data refresh on a 5-second interval
  const refreshSpring = useSpring({
    from: { r: 0 },
    to: { r: 1 },
    loop: { reset: true },
    config: { duration: 5000 }, // 5 second interval
    // Only refresh data when completing a cycle
    onChange: ({ value }) => {
      if (value.r >= 0.99) {
        refreshStatus().catch(console.error);
      }
    }
  });

  // Activity level spring - spikes when refresh happens, then decays
  const activity = useSpring({
    activity: refreshSpring.r.to(r => r >= 0.99 || r <= 0.01 ? 10 : Math.max(0, 10 - (r * 10))),
    config: { tension: 120, friction: 14 },
    ref: activityRef
  });

  // Chain animations
  useChain([activityRef], [0]);

  // Format timestamp to show the full Date.now() value
  // Since we're using frame to trigger re-renders, this updates rapidly
  const formatTimestamp = () => {
    // Get the full timestamp - will be 13 digits
    return Date.now().toString();
  };

  // Display status text
  const statusText = isLoading ? "SYNCING" : error ? "ERROR" : "SIGNET";

  // Fixed border properties that don't animate
  const borderColor = error
    ? 'rgba(255, 78, 78, 0.6)'
    : 'rgba(125, 249, 255, 0.3)';

  // Container glow animation tied to activity
  const containerSpring = useSpring({
    boxShadow: activity.activity.to(a => `0 0 ${5 + Math.min(a, 10)}px rgba(125, 249, 255, 0.2)`),
    config: { tension: 120, friction: 14 }
  });

  // Manual reset tracking for shimmer effect
  const [shimmerKey, setShimmerKey] = useState(0);

  // Use counter value to drive shimmer resets
  useEffect(() => {
    // Every 300 counter increments (approx 5 seconds at 60fps)
    // This syncs with the refresh cycle
    if (counter % 300 === 0 && counter > 0) {
      // Increment key to force reset
      setShimmerKey(prev => prev + 1);
    }
  }, [counter]);

  // Horizontal shimmer effect spring - synced with refreshes
  // Using key ensures it resets properly
  const shimmerSpring = useSpring({
    x: 100,
    from: { x: -100 },
    config: {
      tension: 60,
      friction: 20
    },
    reset: true,
    // Using key to force re-initialization
    key: shimmerKey
  });

  return (
    <animated.div style={{
      background: `linear-gradient(90deg, rgba(13, 17, 23, 0.9) 0%, rgba(125, 249, 255, 0.05) 50%, rgba(13, 17, 23, 0.9) 100%)`,
      padding: '2px 12px', // Reduced padding for more compact design
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
      borderBottom: `1px solid ${borderColor}`,
      boxShadow: containerSpring.boxShadow,
      height: '28px' // Fixed height for consistency
    }}>
      {/* Horizontal shimmer effect - only visible when active */}
      <animated.div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(125, 249, 255, 0.08) 50%, transparent 100%)',
        opacity: activity.activity.to(a => a > 0 ? 0.7 : 0),
        pointerEvents: 'none',
        transform: shimmerSpring.x.to(x => `translateX(${x}%)`)
      }} />

      {/* Status indicators - with static styling */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <StatusDot isLoading={isLoading} error={!!error} activity={activity.activity.get()} />
        {/* Completely static text with fixed color - never changes except explicit error */}
        <span style={{
          fontSize: '12px',
          fontWeight: 'bold',
          // Fixed color that never changes for SIGNET
          color: error ? '#FF4E4E' : '#7DF9FF',
          // Very subtle fixed text shadow
          textShadow: '0 0 4px rgba(125, 249, 255, 0.2)',
          letterSpacing: '0.5px',
        }}>
          SIGNET
        </span>
      </div>

      {/* Time sequence counter */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '2px 6px', // Smaller padding
        borderRadius: '2px',
        border: '1px solid rgba(125, 249, 255, 0.15)',
        boxShadow: 'inset 0 0 4px rgba(125, 249, 255, 0.05)',
        fontFamily: 'monospace',
        fontSize: '11px' // Smaller font
      }}>
        {(() => {
          const timestamp = formatTimestamp();
          const totalDigits = timestamp.length;
          return timestamp.split('').map((digit, index) => (
            <AnimatedDigit
              key={`${index}-${digit}`}
              digit={digit}
              index={index}
              totalDigits={totalDigits}
            />
          ));
        })()}
      </div>
    </animated.div>
  );
}