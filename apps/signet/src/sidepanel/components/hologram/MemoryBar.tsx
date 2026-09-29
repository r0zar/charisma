import { useSpring, animated } from "@react-spring/web";

interface MemoryBarProps {
  value: number;
  color: string;
  max?: number;
  activity?: number;
}

// Memory bar component with spring physics
export const MemoryBar = ({ value, color, max = 100, activity = 0 }: MemoryBarProps) => {
  const percent = (value / max) * 100;
  
  // Spring animation for smooth bar width changes
  const barSpring = useSpring({
    width: `${percent}%`,
    // Add a subtle glow based on activity level
    boxShadow: `0 0 ${Math.max(4, activity)}px ${color}`,
    // Use natural physics for the transition
    config: {
      tension: 140,
      friction: 12,
      precision: 0.1
    }
  });

  return (
    <div style={{
      width: '100%',
      height: '6px',
      background: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '2px',
      overflow: 'hidden',
      marginTop: '2px',
      position: 'relative'
    }}>
      <animated.div
        style={{
          ...barSpring,
          height: '100%',
          background: color,
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />
    </div>
  );
};