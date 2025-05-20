// BatteryLoader.tsx
import { FC } from 'react';
import { useSpring, animated, easings } from '@react-spring/web';

/** A looping “battery-charging” loader.
 *  • Arrow-function component, no classes
 *  • Pure CSS battery shell + terminal nub
 *  • Color interpolates ⟶ red → yellow → green as it fills
 */
export const BatteryLoader: FC<{
    width?: number;      // px
    height?: number;     // px
    duration?: number;   // ms for one 0→100 cycle
}> = ({
    width = 200,
    height = 80,
    duration = 1800,
}) => {
        // spring goes 0 → 1 forever
        const [{ fill }, api] = useSpring(() => ({
            from: { fill: 0 },
            to: { fill: 1 },
            loop: true,
            reset: true,
            config: { duration, easing: easings.easeInOutCubic },
        }), []);

        // width and color interpolate from the spring value
        const barStyle = {
            width: fill.to((v: number) => `${v * 100}%`),
            background: fill.to({
                range: [0, 0.3, 0.7, 1],
                output: ['#ff4d4d', '#ffa500', '#f5de30', '#12d87e'],
            }),
        };

        return (
            <div
                style={{ width, height }}
                className="relative select-none"
            >
                {/* terminal nub */}
                <div
                    className="absolute right-[-6px] top-[28%] w-[6px] h-[44%] rounded-r-sm bg-neutral-700"
                />
                {/* battery shell */}
                <div
                    className="w-full h-full overflow-hidden rounded-sm border-4 border-neutral-700 box-content"
                >
                    <animated.div
                        className="h-full"
                        style={barStyle}
                    />
                </div>
            </div>
        );
    };