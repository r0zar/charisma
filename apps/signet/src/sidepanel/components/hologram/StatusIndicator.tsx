import { useSpring, animated } from "@react-spring/web";

interface StatusIndicatorProps {
  color: string;
  value?: number;
}

export const StatusIndicator = ({ color, value = 0 }: StatusIndicatorProps) => {
  // The value prop represents activity level (0-10)
  const glowSpring = useSpring({
    color,
    textShadow: `0 0 ${Math.max(0, value)}px ${color}`,
    scale: 1 + (value / 50),
    config: { tension: 300, friction: 10 }
  });
  
  return (
    <animated.span
      style={{
        ...glowSpring,
        fontSize: '6px',
        display: 'inline-block',
        transform: glowSpring.scale.to(s => `scale(${s})`)
      }}
    >
      ●
    </animated.span>
  );
};