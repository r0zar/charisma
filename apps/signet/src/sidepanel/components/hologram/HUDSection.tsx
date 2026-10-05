import { useSpring, animated, config } from "@react-spring/web";
import type { ReactNode } from "react";
import { HexPattern } from "~shared/hud/HexPattern";
import { StatusIndicator } from "~shared/hud/StatusIndicator";
import { colors, glow, tint } from "~shared/styles/theme";

interface Position {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

interface HUDSectionProps {
  title: string;
  value?: string;
  color?: string;
  position: Position;
  width: string;
  height: string;
  activity?: number;
  children?: ReactNode;
}

// HUD section component
export const HUDSection = ({
  title,
  value,
  color = tint(colors.accent, 0.8),
  position,
  width,
  height,
  activity = 0, // 0-10 scale representing activity level
  children
}: HUDSectionProps) => {
  // Spring animation for highlight effects 
  const highlightSpring = useSpring({
    blur: Math.max(0, activity),
    config: { tension: 120, friction: 14 }
  });
  
  // Initial fade-in animation
  const fadeInSpring = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: config.gentle
  });

  return (
    <animated.div
      style={{
        ...fadeInSpring,
        borderColor: color,
        boxShadow: highlightSpring.blur.to(b => `0 0 ${b}px ${glow(color, 0.25)}`),
        position: 'absolute',
        ...position,
        width,
        height,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '2px',
        padding: '4px',
        overflow: 'hidden',
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* Background hex pattern */}
      <HexPattern color={color} activity={activity} />

      {/* Section header */}
      <div style={{
        borderBottom: `1px solid ${color}`,
        fontSize: '8px',
        fontWeight: 'bold',
        color,
        padding: '2px 4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)'
      }}>
        <span>{title}</span>
        {/* Status indicator with spring animation */}
        <StatusIndicator color={color} value={activity} />
      </div>

      {/* Section content */}
      <div style={{
        padding: '4px',
        fontSize: '10px',
        color: 'color-mix(in srgb, var(--ink) 90%, transparent)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.5px',
        height: 'calc(100% - 16px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        {children || (
          <div style={{ textAlign: 'center' }}>
            <span style={{
              color,
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {value}
            </span>
          </div>
        )}
      </div>
    </animated.div>
  );
};