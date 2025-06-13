"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

interface TargetPriceHoverOverlayProps {
    chartContainerRef: React.RefObject<HTMLDivElement | null>;
    currentPrice?: number;
    priceRange?: { min: number; max: number };
    chartRef?: React.RefObject<IChartApi | null>;
    seriesRef?: React.RefObject<ISeriesApi<'Line'> | null>;
}

export default function TargetPriceHoverOverlay({
    chartContainerRef,
    currentPrice,
    priceRange,
    chartRef,
    seriesRef
}: TargetPriceHoverOverlayProps) {
    const [mouseY, setMouseY] = useState<number | null>(null);
    const [mouseX, setMouseX] = useState<number | null>(null);
    const [visiblePriceRange, setVisiblePriceRange] = useState<{ min: number; max: number } | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });

    const {
        selectedOrderType,
        targetPrice,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
    } = useSwapContext();

    // Stable condition check - cache the tokens to prevent re-renders from clearing the overlay
    const [cachedTokens, setCachedTokens] = useState<{ from: any, to: any } | null>(null);

    useEffect(() => {
        if (selectedFromToken && selectedToToken) {
            setCachedTokens({ from: selectedFromToken, to: selectedToToken });
        }
    }, [selectedFromToken, selectedToToken]);

    // Don't render if in sandwich/perpetual mode, or if target price is already set
    const shouldShow = (selectedOrderType === 'dca' || selectedOrderType === 'single') &&
        (!targetPrice || targetPrice === '0') &&
        cachedTokens?.from && cachedTokens?.to;

    // Update chart dimensions
    useEffect(() => {
        if (!chartContainerRef.current || !shouldShow) return;

        const updateDimensions = () => {
            if (chartContainerRef.current) {
                const rect = chartContainerRef.current.getBoundingClientRect();
                setChartDimensions({ width: rect.width, height: rect.height });
            }
        };

        updateDimensions();

        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [chartContainerRef, shouldShow]);

    // Subscribe to chart's visible price range changes
    useEffect(() => {
        if (!chartRef?.current || !seriesRef?.current || !shouldShow || !chartDimensions.height) return;

        const chart = chartRef.current;
        const series = seriesRef.current;

        const updateVisiblePriceRange = () => {
            try {
                const topPrice = series.coordinateToPrice(0);
                const bottomPrice = series.coordinateToPrice(chartDimensions.height);

                if (topPrice !== null && bottomPrice !== null) {
                    setVisiblePriceRange({
                        min: Math.min(topPrice, bottomPrice),
                        max: Math.max(topPrice, bottomPrice)
                    });
                } else if (priceRange) {
                    setVisiblePriceRange(priceRange);
                }
            } catch (error) {
                if (priceRange) {
                    setVisiblePriceRange(priceRange);
                }
            }
        };

        const handler = () => {
            setTimeout(updateVisiblePriceRange, 10);
        };

        chart.timeScale().subscribeVisibleTimeRangeChange(handler);
        updateVisiblePriceRange();

        return () => {
            try {
                chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
            } catch (error) {
                // Ignore errors if chart is already destroyed
            }
        };
    }, [chartRef, seriesRef, chartDimensions.height, priceRange, shouldShow]);

    // Mouse event handlers
    useEffect(() => {
        if (!chartContainerRef.current || !shouldShow) return;

        const handleMouseMove = (event: MouseEvent) => {
            if (chartContainerRef.current) {
                const chartRect = chartContainerRef.current.getBoundingClientRect();
                const relativeY = event.clientY - chartRect.top;
                const relativeX = event.clientX - chartRect.left;

                // Only update if within chart bounds
                if (relativeY >= 0 && relativeY <= chartRect.height &&
                    relativeX >= 0 && relativeX <= chartRect.width) {
                    setMouseY(relativeY);
                    setMouseX(relativeX);
                    setIsVisible(true);
                }
            }
        };

        const handleMouseLeave = () => {
            setMouseY(null);
            setMouseX(null);
            setIsVisible(false);
        };

        const handleMouseEnter = () => {
            setIsVisible(true);
        };

        const element = chartContainerRef.current;
        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('mouseleave', handleMouseLeave);
        element.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            element.removeEventListener('mousemove', handleMouseMove);
            element.removeEventListener('mouseleave', handleMouseLeave);
            element.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [chartContainerRef, shouldShow]);

    // Calculate price from Y position
    const calculatePriceFromY = useCallback((y: number): number => {
        const activeRange = visiblePriceRange || priceRange;
        if (!activeRange || !chartDimensions.height) return currentPrice || 0;

        const { min, max } = activeRange;
        const priceRatio = 1 - (y / chartDimensions.height);
        return min + (priceRatio * (max - min));
    }, [visiblePriceRange, priceRange, chartDimensions.height, currentPrice]);

    // Don't render if conditions aren't met
    if (!shouldShow || !currentPrice || !priceRange || !chartDimensions.width || !cachedTokens) {
        return null;
    }

    // Calculate hover price
    const hoverPrice = mouseY !== null ? calculatePriceFromY(mouseY) : 0;

    return (
        <div
            className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-200 ${isVisible && mouseY !== null ? 'opacity-100' : 'opacity-0'
                }`}
            style={{
                width: chartDimensions.width,
                height: chartDimensions.height,
            }}
        >
            {mouseY !== null && (
                <>
                    {/* Target Price Line */}
                    <div
                        className="absolute w-full border-t-2 border-purple-500 opacity-70"
                        style={{
                            top: `${mouseY}px`,
                            left: 0,
                        }}
                    >
                        <div
                            className="absolute -top-8 bg-purple-500 text-white text-xs px-3 py-1 rounded shadow-lg whitespace-nowrap"
                            style={{
                                left: mouseX !== null ? `${Math.max(0, Math.min(mouseX - 75, chartDimensions.width - 150))}px` : '8px'
                            }}
                        >
                            <div className="text-center">
                                <div className="font-medium">Click to set target price</div>
                                <div className="text-xs opacity-90">
                                    1 {cachedTokens.from?.symbol} = {hoverPrice.toFixed(6)} {cachedTokens.to?.symbol}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Click hint dot */}
                    <div
                        className="absolute w-3 h-3 bg-purple-500 rounded-full border-2 border-white shadow-lg"
                        style={{
                            top: `${mouseY - 6}px`,
                            left: mouseX !== null ? `${mouseX - 6}px` : '10px',
                        }}
                    />
                </>
            )}
        </div>
    );
} 