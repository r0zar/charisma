import { useSpring, animated } from "@react-spring/web";

interface ScanLineProps {
  trigger: any;
}

// Data refresh pulse effect - triggered by key changes
export const ScanLine = ({ trigger }: ScanLineProps) => {
  // Animation that runs once when trigger changes
  const scanSpring = useSpring({
    from: { y: '-10%', opacity: 0 },
    to: async (next) => {
      // Fade in quickly
      await next({ opacity: 0.3, immediate: true });
      // Animate downward
      await next({ y: '110%', config: { mass: 1, tension: 280, friction: 60 } });
      // Fade out
      await next({ opacity: 0 });
    },
    // Reset when trigger changes so animation runs again
    reset: true,
    immediate: false,
    config: { duration: 800 }
  });
  
  return (
    <animated.div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '3px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(125, 249, 255, 0.7) 50%, transparent 100%)',
        zIndex: 100,
        pointerEvents: 'none',
        opacity: scanSpring.opacity,
        transform: scanSpring.y.to(y => `translateY(${y})`)
      }}
    />
  );
};