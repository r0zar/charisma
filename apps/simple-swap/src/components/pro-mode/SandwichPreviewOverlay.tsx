"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

interface SandwichPreviewOverlayProps {
    chartContainerRef: React.RefObject<HTMLDivElement | null>;
    currentPrice?: number;
    priceRange?: { min: number; max: number };
    chartRef?: React.RefObject<IChartApi | null>;
    seriesRef?: React.RefObject<ISeriesApi<'Line'> | null>;
}

export default function SandwichPreviewOverlay({
    chartContainerRef,
    currentPrice,
    priceRange,
    chartRef,
    seriesRef
}: SandwichPreviewOverlayProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [overlayDimensions, setOverlayDimensions] = useState({ width: 0, height: 0 });
    const [mouseY, setMouseY] = useState<number | null>(null);
    const [mouseX, setMouseX] = useState<number | null>(null);
    const [visiblePriceRange, setVisiblePriceRange] = useState<{ min: number; max: number } | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const {
        selectedOrderType,
        sandwichBuyPrice,
        sandwichSellPrice,
        sandwichSpread,
        sandwichUsdAmount,
        handleSandwichSpreadChange,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
    } = useSwapContext();

    // Subscribe to chart's visible price range changes
    useEffect(() => {
        if (!chartRef?.current || !seriesRef?.current) return;

        const chart = chartRef.current;
        const series = seriesRef.current;

        // Function to get visible price range from chart
        const updateVisiblePriceRange = () => {
            try {
                // Get the chart's container height
                const chartHeight = overlayDimensions.height || 400; // fallback height

                // Calculate visible price range by using coordinate conversion
                // Get price at top and bottom of visible chart area
                const topPrice = series.coordinateToPrice(0);
                const bottomPrice = series.coordinateToPrice(chartHeight);

                if (topPrice !== null && bottomPrice !== null) {
                    setVisiblePriceRange({
                        min: Math.min(topPrice, bottomPrice),
                        max: Math.max(topPrice, bottomPrice)
                    });
                    console.log('Updated visible price range:', {
                        min: Math.min(topPrice, bottomPrice),
                        max: Math.max(topPrice, bottomPrice)
                    });
                } else {
                    // Fallback to data range
                    if (priceRange) {
                        setVisiblePriceRange(priceRange);
                    }
                }

            } catch (error) {
                console.warn('Failed to get visible price range:', error);
                // Fallback to data range
                if (priceRange) {
                    setVisiblePriceRange(priceRange);
                }
            }
        };

        // Subscribe to visible time range changes (which also affect price range when zooming)
        chart.timeScale().subscribeVisibleTimeRangeChange(() => {
            // Use a small delay to ensure the chart has updated
            setTimeout(updateVisiblePriceRange, 10);
        });

        // Initial update
        updateVisiblePriceRange();

        return () => {
            // Note: In lightweight-charts, subscribeVisibleTimeRangeChange doesn't return an unsubscribe function
            // The subscription is automatically cleaned up when the chart is destroyed
        };
    }, [chartRef, seriesRef, overlayDimensions.height, priceRange]);

    // Update overlay dimensions when chart container changes
    useEffect(() => {
        const updateDimensions = () => {
            if (chartContainerRef.current && overlayRef.current) {
                const chartRect = chartContainerRef.current.getBoundingClientRect();

                setOverlayDimensions({
                    width: chartRect.width,
                    height: chartRect.height
                });

                // Position overlay to match chart
                overlayRef.current.style.left = `${chartRect.left}px`;
                overlayRef.current.style.top = `${chartRect.top}px`;
            }
        };

        // Use a small delay to ensure chart is rendered
        const timeoutId = setTimeout(updateDimensions, 100);

        // Also update immediately
        updateDimensions();

        // Update on window resize
        window.addEventListener('resize', updateDimensions);

        // Use ResizeObserver for more accurate tracking
        let resizeObserver: ResizeObserver;
        if (chartContainerRef.current) {
            resizeObserver = new ResizeObserver(updateDimensions);
            resizeObserver.observe(chartContainerRef.current);
        }

        // Add mouse tracking to chart container
        const handleMouseMove = (event: MouseEvent) => {
            if (chartContainerRef.current) {
                const chartRect = chartContainerRef.current.getBoundingClientRect();
                const relativeY = event.clientY - chartRect.top;
                const relativeX = event.clientX - chartRect.left;
                setMouseY(relativeY);
                setMouseX(relativeX);
                setIsVisible(true);
            }
        };

        const handleMouseEnter = () => {
            setIsVisible(true);
        };

        const handleMouseLeave = () => {
            setMouseY(null);
            setMouseX(null);
            setIsVisible(false);
        };



        if (chartContainerRef.current) {
            chartContainerRef.current.addEventListener('mousemove', handleMouseMove);
            chartContainerRef.current.addEventListener('mouseenter', handleMouseEnter);
            chartContainerRef.current.addEventListener('mouseleave', handleMouseLeave);
        }

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updateDimensions);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            if (chartContainerRef.current) {
                chartContainerRef.current.removeEventListener('mousemove', handleMouseMove);
                chartContainerRef.current.removeEventListener('mouseenter', handleMouseEnter);
                chartContainerRef.current.removeEventListener('mouseleave', handleMouseLeave);
            }
        };
    }, [chartContainerRef]);

    // Calculate price line positions
    const calculateLinePosition = useCallback((price: number): number => {
        const activeRange = visiblePriceRange || priceRange;
        if (!activeRange || !overlayDimensions.height) return 0;

        const { min, max } = activeRange;
        const priceRatio = (price - min) / (max - min);
        // Invert Y axis (0 at top, height at bottom)
        return overlayDimensions.height * (1 - priceRatio);
    }, [visiblePriceRange, priceRange, overlayDimensions.height]);

    // Calculate price from Y position
    const calculatePriceFromY = useCallback((y: number): number => {
        const activeRange = visiblePriceRange || priceRange;
        if (!activeRange || !overlayDimensions.height) return currentPrice || 0;

        const { min, max } = activeRange;
        // Invert Y axis (0 at top, height at bottom)
        const priceRatio = 1 - (y / overlayDimensions.height);
        return min + (priceRatio * (max - min));
    }, [visiblePriceRange, priceRange, overlayDimensions.height, currentPrice]);

    // Update preview lines based on current spread
    const updatePreviewLines = useCallback(() => {
        if (!currentPrice || selectedOrderType !== 'sandwich') return;

        const spread = parseFloat(sandwichSpread || '5'); // Use context value, default to 5%
        const spreadMultiplier = spread / 100;

        // Use mouse position if available, otherwise use current price
        const centerPrice = mouseY !== null ? calculatePriceFromY(mouseY) : currentPrice;

        const buyPrice = centerPrice * (1 - spreadMultiplier);
        const sellPrice = centerPrice * (1 + spreadMultiplier);

        // Force re-render with new prices
        setBuyLineY(calculateLinePosition(buyPrice));
        setSellLineY(calculateLinePosition(sellPrice));

        // Store calculated prices for labels
        setBuyPrice(buyPrice);
        setSellPrice(sellPrice);
    }, [currentPrice, selectedOrderType, sandwichSpread, mouseY, calculatePriceFromY, calculateLinePosition]);

    const [buyLineY, setBuyLineY] = useState(0);
    const [sellLineY, setSellLineY] = useState(0);
    const [calculatedBuyPrice, setBuyPrice] = useState(0);
    const [calculatedSellPrice, setSellPrice] = useState(0);

    // Update preview when dependencies change
    useEffect(() => {
        updatePreviewLines();
    }, [updatePreviewLines]);



    // Don't render if not in sandwich mode or missing data
    if (selectedOrderType !== 'sandwich' || !currentPrice || !priceRange) {
        return null;
    }

    // If we're in sandwich mode but don't have dimensions, try to get them
    if (!overlayDimensions.width && chartContainerRef.current) {
        const chartRect = chartContainerRef.current.getBoundingClientRect();
        if (chartRect.width > 0) {
            setOverlayDimensions({
                width: chartRect.width,
                height: chartRect.height
            });
        }
        return null; // Return null this render, will re-render with dimensions
    }

    if (!overlayDimensions.width) {
        return null;
    }



    return (
        <div
            ref={overlayRef}
            className={`fixed pointer-events-none z-50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'
                }`}
            style={{
                width: overlayDimensions.width,
                height: overlayDimensions.height,
            }}
        >
            {mouseY !== null && (
                <>
                    {/* Buy Price Line */}
                    <div
                        className="absolute w-full border-t-2 border-green-500 opacity-70"
                        style={{
                            top: `${buyLineY}px`,
                            left: 0,
                        }}
                    >
                        <div
                            className="absolute -top-6 bg-green-500 text-white text-xs px-2 py-1 rounded"
                            style={{
                                left: mouseX !== null ? `${Math.max(0, Math.min(mouseX - 50, overlayDimensions.width - 100))}px` : '8px'
                            }}
                        >
                            Buy: ${calculatedBuyPrice.toFixed(6)}
                        </div>
                    </div>

                    {/* Sell Price Line */}
                    <div
                        className="absolute w-full border-t-2 border-red-500 opacity-70"
                        style={{
                            top: `${sellLineY}px`,
                            left: 0,
                        }}
                    >
                        <div
                            className="absolute -top-6 bg-red-500 text-white text-xs px-2 py-1 rounded"
                            style={{
                                left: mouseX !== null ? `${Math.max(0, Math.min(mouseX - 50, overlayDimensions.width - 100))}px` : '8px'
                            }}
                        >
                            Sell: ${calculatedSellPrice.toFixed(6)}
                        </div>
                    </div>

                    {/* Spread Zone */}
                    <div
                        className="absolute w-full bg-blue-500 opacity-10"
                        style={{
                            top: `${Math.min(buyLineY, sellLineY)}px`,
                            height: `${Math.abs(sellLineY - buyLineY)}px`,
                            left: 0,
                        }}
                    />
                </>
            )}
        </div>
    );
} 