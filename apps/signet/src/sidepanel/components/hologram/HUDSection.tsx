import { useSpring, animated, config } from "@react-spring/web";
import { ReactNode } from "react";
import { HexPattern } from "./HexPattern";
import { StatusIndicator } from "./StatusIndicator";

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
  color = "rgba(125, 249, 255, 0.8)",
  position,
  width,
  height,
  activity = 0, // 0-10 scale representing activity level
  children
}: HUDSectionProps) => {
  // Spring animation for highlight effects 
  const highlightSpring = useSpring({
    borderColor: color,
    boxShadow: `0 0 ${Math.max(0, activity)}px ${color.replace('0.8', '0.2')}`,
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
        ...highlightSpring,
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
        fontFamily: 'monospace'
      }}>
        <span>{title}</span>
        {/* Status indicator with spring animation */}
        <StatusIndicator color={color} value={activity} />
      </div>

      {/* Section content */}
      <div style={{
        padding: '4px',
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: 'monospace',
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