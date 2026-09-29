import { useSpring, animated, config } from "@react-spring/web";

interface HexPatternProps {
  color: string;
  activity?: number;
}

// Hexagon background pattern with React Spring animations
export const HexPattern = ({ color, activity = 0 }: HexPatternProps) => {
  const hexSize = 16;
  const rows = 6;  // Reduced for performance
  const cols = 6;  // Reduced for performance
  
  // Initial fade-in animation for container
  const containerSpring = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: config.gentle
  });
  
  // Create a hex item with spring animations
  const Hex = ({ row, col, index }: { row: number; col: number; index: number }) => {
    const offsetX = row % 2 === 0 ? 0 : hexSize / 2;
    
    // Individual spring for each hex with randomness
    const spring = useSpring({
      // Base pulse animation
      opacity: 0.3 + Math.sin(Date.now() * 0.001 + index * 0.1) * 0.15,
      
      // Activity affects scale
      scale: 1 + (activity / 100) + Math.sin(Date.now() * 0.002 + index * 0.1) * 0.05,
      
      // Customized spring physics for organic motion
      config: {
        tension: 60 + Math.random() * 40,
        friction: 25 + Math.random() * 10,
        mass: 1 + Math.random() * 0.5
      },
      
      // Make animation loop continuously
      loop: true
    });
    
    // Derive borderColor from opacity
    const borderColor = spring.opacity.to(
      o => color.replace('0.8', (0.2 + o * 0.3).toFixed(2))
    );
    
    return (
      <animated.div
        style={{
          position: 'absolute',
          left: `${col * hexSize + offsetX}px`,
          top: `${row * (hexSize * 0.75)}px`,
          width: `${hexSize - 2}px`,
          height: `${hexSize - 2}px`,
          borderRadius: '1px',
          opacity: spring.opacity,
          transform: spring.scale.to(s => `rotate(45deg) scale(${s})`),
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor
        }}
      />
    );
  };
  
  // Static styles
  const staticStyles = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.05,
    zIndex: 0,
    pointerEvents: 'none'
  } as const;

  return (
    <animated.div
      style={{
        ...staticStyles,
        opacity: containerSpring.opacity.to(o => Math.max(0.05, o * 0.05)) // Keep minimum opacity
      }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        return <Hex key={i} row={row} col={col} index={i} />;
      })}
    </animated.div>
  );
};