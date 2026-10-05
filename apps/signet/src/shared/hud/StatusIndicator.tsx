import { useSpring, animated } from "@react-spring/web";
import { glow } from "~shared/styles/theme";

interface StatusIndicatorProps {
  color: string;
  value?: number;
}

export const StatusIndicator = ({ color, value = 0 }: StatusIndicatorProps) => {
  // The value prop represents activity level (0-10)
  const glowSpring = useSpring({
    blur: Math.max(0, value),
    scale: 1 + (value / 50),
    config: { tension: 300, friction: 10 }
  });
  
  return (
    <animated.span
      style={{
        color,
        textShadow: glowSpring.blur.to(b => `0 0 ${b}px ${glow(color, 1)}`),
        fontSize: '6px',
        display: 'inline-block',
        transform: glowSpring.scale.to(s => `scale(${s})`)
      }}
    >
      ●
    </animated.span>
  );
};