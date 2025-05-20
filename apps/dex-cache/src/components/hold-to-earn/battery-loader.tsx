import { FC, useEffect } from 'react';
import { useSpring, animated, easings } from '@react-spring/web';

/**
 * A full-width/height "battery charging" loader that animates between energy values
 * with logarithmic scaling for a faster initial movement that slows as it reaches capacity.
 *
 * Props
 * -----
 * • value        – current energy value to display
 * • maxCapacity  – total units when "full" (default 100)
 * • animationDuration - milliseconds for the animation (default 1000ms)
 * • logBase - base for logarithmic scaling (default 10, higher = more aggressive scaling)
 *
 * Put it inside any container; it will stretch to fill that box.
 */
export const BatteryLoader: FC<{
    value: number;         // current value to display
    maxCapacity: number;   // total units when full
    animationDuration?: number; // duration of animation in ms
    logBase?: number;      // base for logarithmic scaling
}> = ({
    value,
    maxCapacity,
    animationDuration = 1000,
    logBase = 10
}) => {

        // Animate between values when they change
        const [springs, api] = useSpring(() => ({
            val: value,
            config: {
                duration: animationDuration,
                easing: easings.easeOutQuad
            },
        }));

        // Update the animation when value changes
        useEffect(() => {
            api.start({
                val: value,
                config: {
                    duration: animationDuration,
                    easing: easings.easeOutQuad
                }
            });
        }, [value, animationDuration, api]);

        // Apply logarithmic scaling to create a faster initial movement
        const applyLogarithmicScaling = (value: number, max: number): number => {
            if (value <= 0) return 0;
            if (value >= max) return 1;

            // Calculate the percentage (0-1)
            const normalizedValue = value / max;

            // Apply logarithmic scaling
            // We use Math.log(normalizedValue * (logBase-1) + 1) / Math.log(logBase)
            // This ensures we get 0 when normalizedValue is 0, and 1 when normalizedValue is 1
            const logScaled = Math.log(normalizedValue * (logBase - 1) + 1) / Math.log(logBase);

            return logScaled;
        };

        // width (%) + color interpolate from val
        const barStyle = {
            width: springs.val.to(v => {
                const logScaledProgress = applyLogarithmicScaling(v, maxCapacity);
                return `${logScaledProgress * 100}%`;
            }),
            background: springs.val.to({
                range: [0, maxCapacity * 0.3, maxCapacity * 0.7, maxCapacity],
                output: ['#ff4d4d66', '#ffa50099', '#f5de30BB', '#12d87eDD'],
            }),
        };

        return (
            <div className="relative w-full h-full select-none scale-120 translate-y-5">
                {/* battery shell */}
                <div className="w-full h-2 overflow-hidden rounded-sm box-content">
                    <animated.div className="h-full" style={barStyle} />
                </div>
            </div>
        );
    };