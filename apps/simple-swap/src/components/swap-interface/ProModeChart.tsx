"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
    TrendingUp,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Crosshair,
    TrendingDown,
    Activity,
    BarChart3,
    Settings
} from 'lucide-react';
import { TokenCacheData } from '@repo/tokens';
import type { LimitOrder } from '../../lib/orders/types';
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    LineSeries,
    AreaSeries,
    ColorType,
    type IPriceLine,
    LineStyle,
} from "lightweight-charts";

// Enriched order type with token metadata
interface DisplayOrder extends LimitOrder {
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta: TokenCacheData;
    baseAssetMeta?: TokenCacheData | null;
}

interface TimeframeOption {
    label: string;
    value: string;
    hours: number;
}

const timeframes: TimeframeOption[] = [
    { label: '1H', value: '1h', hours: 1 },
    { label: '4H', value: '4h', hours: 4 },
    { label: '1D', value: '1d', hours: 24 },
    { label: '1W', value: '1w', hours: 168 },
    { label: '1M', value: '1m', hours: 720 },
];

interface ProModeChartProps {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    onTargetPriceChange: (price: string) => void;
    userOrders: DisplayOrder[];
    highlightedOrderId?: string | null;
    conditionDir?: 'gt' | 'lt';
    // Sandwich mode props
    isSandwichMode?: boolean;
    sandwichBuyPrice?: string;
    sandwichSellPrice?: string;
    onSandwichBuyPriceChange?: (price: string) => void;
    onSandwichSellPriceChange?: (price: string) => void;
    sandwichSpread?: string;
}

export default function ProModeChart({
    token,
    baseToken,
    targetPrice,
    onTargetPriceChange,
    userOrders,
    highlightedOrderId,
    conditionDir = 'gt',
    isSandwichMode,
    sandwichBuyPrice,
    sandwichSellPrice,
    onSandwichBuyPriceChange,
    onSandwichSellPriceChange,
    sandwichSpread
}: ProModeChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const priceLineRef = useRef<IPriceLine | null>(null);
    const targetAreaRef = useRef<ISeriesApi<'Area'> | null>(null);
    const orderLinesRef = useRef<IPriceLine[]>([]);

    const [selectedTimeframe, setSelectedTimeframe] = useState('1d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<LineData[] | null>(null);
    const [crosshairMode, setCrosshairMode] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<{ value: number; percentage: number } | null>(null);

    // Sandwich mode state
    const [mousePrice, setMousePrice] = useState<number | null>(null);
    const [sandwichPreviewLines, setSandwichPreviewLines] = useState<{
        buyLine: IPriceLine | null;
        sellLine: IPriceLine | null;
    }>({ buyLine: null, sellLine: null });
    const [sandwichConfirmedLines, setSandwichConfirmedLines] = useState<{
        buyLine: IPriceLine | null;
        sellLine: IPriceLine | null;
    }>({ buyLine: null, sellLine: null });

    // Add refs to track preview lines more reliably
    const previewLinesRef = useRef<{
        buyLine: IPriceLine | null;
        sellLine: IPriceLine | null;
    }>({ buyLine: null, sellLine: null });

    // Add refs to track confirmed lines more reliably
    const confirmedLinesRef = useRef<{
        buyLine: IPriceLine | null;
        sellLine: IPriceLine | null;
    }>({ buyLine: null, sellLine: null });

    // Calculate price change
    useEffect(() => {
        if (data && data.length > 1) {
            const latest = data[data.length - 1].value;
            const previous = data[data.length - 2].value;
            const change = latest - previous;
            const percentage = (change / previous) * 100;

            setCurrentPrice(latest);
            setPriceChange({ value: change, percentage });
        }
    }, [data]);

    // Fetch chart data
    const loadChart = useCallback(async () => {
        if (!token?.contractId) return;

        setLoading(true);
        setError(null);

        try {
            const [tokenResponse, baseResponse] = await Promise.all([
                fetch(`/api/price-series?contractId=${encodeURIComponent(token.contractId)}&timeframe=${selectedTimeframe}`),
                baseToken?.contractId
                    ? fetch(`/api/price-series?contractId=${encodeURIComponent(baseToken.contractId)}&timeframe=${selectedTimeframe}`)
                    : Promise.resolve(null)
            ]);

            if (!tokenResponse.ok) {
                throw new Error(`Failed to fetch price data: ${tokenResponse.status}`);
            }

            const tokenData: LineData[] = await tokenResponse.json();
            let processedData = tokenData;

            if (baseResponse?.ok && baseToken?.contractId) {
                const baseData: LineData[] = await baseResponse.json();
                if (Array.isArray(baseData)) {
                    processedData = calculateRatioData(tokenData, baseData);
                }
            }

            const validData = processedData.filter(isValidDataPoint);
            setData(validData);

        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load chart data";
            setError(message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token.contractId, baseToken?.contractId, selectedTimeframe]);

    // Initialize chart
    useEffect(() => {
        if (!containerRef.current || !data || data.length === 0) return;

        // Clean up existing chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
            priceLineRef.current = null;
            targetAreaRef.current = null;
            orderLinesRef.current = [];
            // Clean up manual grid lines
            if ((window as any).manualGridLines) {
                (window as any).manualGridLines = [];
            }
        }

        try {
            const rect = containerRef.current.getBoundingClientRect();

            chartRef.current = createChart(containerRef.current, {
                width: rect.width,
                height: rect.height,
                layout: {
                    background: { type: ColorType.Solid, color: "transparent" },
                    textColor: "#d1d5db",
                    fontSize: 12,
                },
                localization: {
                    priceFormatter: (price: number) => {
                        // For very small numbers, show up to 10 decimal places
                        if (price < 0.001) {
                            return price.toFixed(10);
                        }
                        // For small numbers, show 8 decimal places
                        else if (price < 1) {
                            return price.toFixed(8);
                        }
                        // For larger numbers, show 6 decimal places
                        else if (price < 1000) {
                            return price.toFixed(6);
                        }
                        // For very large numbers, show 2 decimal places
                        else {
                            return price.toFixed(2);
                        }
                    }
                },
                grid: {
                    vertLines: {
                        color: "rgba(156, 163, 175, 0.4)",
                        style: LineStyle.Solid,
                        visible: true,
                    },
                    horzLines: {
                        color: "rgba(156, 163, 175, 0.8)",
                        style: LineStyle.Solid,
                        visible: true,
                    },
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                    borderVisible: false,
                    rightOffset: 12,
                    barSpacing: 3,
                },
                leftPriceScale: {
                    visible: false,
                    borderVisible: false,
                    scaleMargins: { top: 0.1, bottom: 0.1 },
                },
                rightPriceScale: {
                    visible: true,
                    borderVisible: true,
                    scaleMargins: { top: 0.1, bottom: 0.1 },
                    autoScale: true,
                    mode: 0, // Normal mode instead of logarithmic for better grid lines
                    invertScale: false,
                    alignLabels: true,
                    borderColor: "#374151",
                    textColor: "#d1d5db",
                    entireTextOnly: false,
                    ticksVisible: true,
                    minimumWidth: 150,
                },
                crosshair: {
                    mode: crosshairMode ? 1 : 0, // 0 = normal, 1 = magnet
                    vertLine: {
                        width: 1,
                        color: '#758694',
                        style: LineStyle.Dashed,
                    },
                    horzLine: {
                        width: 1,
                        color: '#758694',
                        style: LineStyle.Dashed,
                    },
                },
                handleScroll: {
                    mouseWheel: true,
                    pressedMouseMove: true,
                    horzTouchDrag: true,
                    vertTouchDrag: true,
                },
                handleScale: {
                    axisPressedMouseMove: {
                        time: true,
                        price: true,
                    },
                    axisDoubleClickReset: {
                        time: true,
                        price: true,
                    },
                    mouseWheel: true,
                    pinch: true,
                },
            });

            seriesRef.current = chartRef.current.addSeries(LineSeries, {
                color: '#3b82f6',
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: true,
            }) as ISeriesApi<'Line'>;

            seriesRef.current.setData(data);

            // Debug: Log data to understand the price range
            console.log('Chart data:', data.slice(0, 5), '...', data.slice(-5));
            if (data.length > 0) {
                const prices = data.map(d => d.value);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                console.log('Price range:', { minPrice, maxPrice, range: maxPrice - minPrice });

                // Add manual grid lines for better y-axis visibility
                const priceRange = maxPrice - minPrice;
                const gridSpacing = priceRange / 50; // Create 50 grid lines for good balance

                for (let i = 1; i < 50; i++) {
                    const gridPrice = minPrice + (gridSpacing * i);
                    try {
                        const gridLine = seriesRef.current.createPriceLine({
                            price: gridPrice,
                            color: "rgba(156, 163, 175, 0.15)", // Slightly more visible
                            lineWidth: 1,
                            lineStyle: LineStyle.Solid,
                            axisLabelVisible: false, // Hide labels for intermediate lines to avoid clutter
                            title: '',
                        });
                        // Store grid lines for cleanup
                        if (!(window as any).manualGridLines) {
                            (window as any).manualGridLines = [];
                        }
                        (window as any).manualGridLines.push(gridLine);
                    } catch (e) {
                        console.warn('Failed to create manual grid line:', e);
                    }
                }

                // For very small price ranges, force a minimum visible range
                const range = maxPrice - minPrice;
                if (range < maxPrice * 0.05) {
                    // Force the chart to show at least 5% range around the price
                    const center = (minPrice + maxPrice) / 2;
                    const minRange = center * 0.1; // 10% total range
                    const newMin = center - minRange / 2;
                    const newMax = center + minRange / 2;

                    // Apply the range after a short delay to ensure chart is ready
                    setTimeout(() => {
                        if (chartRef.current && seriesRef.current) {
                            chartRef.current.priceScale('right').applyOptions({
                                scaleMargins: { top: 0.1, bottom: 0.1 },
                            });
                            // Force specific price range to generate more grid lines
                            chartRef.current.timeScale().fitContent();

                            // Try to force the price scale to show more levels
                            chartRef.current.priceScale('right').applyOptions({
                                autoScale: false,
                            });

                            // Set a specific visible range to force grid generation
                            setTimeout(() => {
                                if (chartRef.current) {
                                    chartRef.current.priceScale('right').applyOptions({
                                        autoScale: true,
                                    });
                                }
                            }, 200);
                        }
                    }, 100);
                }
            }

            // Handle clicks for setting target price
            const handleClick = (param: any) => {
                if (!param.point || !seriesRef.current) return;
                const price = seriesRef.current.coordinateToPrice(param.point.y);
                if (price && !isNaN(price)) {
                    if (isSandwichMode) {
                        // In sandwich mode, set both buy and sell prices based on current mouse position
                        const priceStr = price.toPrecision(9);
                        if (onSandwichBuyPriceChange && onSandwichSellPriceChange) {
                            // Calculate buy and sell prices using dynamic spread
                            const spreadPercent = parseFloat(sandwichSpread || '5') / 100; // Default to 5% if not provided
                            const buyPrice = price * (1 - spreadPercent);
                            const sellPrice = price * (1 + spreadPercent);
                            onSandwichBuyPriceChange(buyPrice.toPrecision(9));
                            onSandwichSellPriceChange(sellPrice.toPrecision(9));

                            // Create confirmed lines
                            createSandwichConfirmedLines(buyPrice, sellPrice);
                        }
                    } else {
                        // Normal mode - single target price
                        onTargetPriceChange(price.toPrecision(9));
                    }
                }
            };

            // Handle mouse move for sandwich preview
            const handleMouseMove = (param: any) => {
                if (!isSandwichMode || !seriesRef.current) {
                    // Clear preview lines if not in sandwich mode or no valid point
                    clearSandwichPreviewLines();
                    setMousePrice(null);
                    return;
                }

                if (!param.point) {
                    // Mouse left the chart area - clear preview lines
                    clearSandwichPreviewLines();
                    setMousePrice(null);
                    return;
                }

                const price = seriesRef.current.coordinateToPrice(param.point.y);
                if (price && !isNaN(price)) {
                    setMousePrice(price);
                    updateSandwichPreviewLines(price);
                } else {
                    clearSandwichPreviewLines();
                    setMousePrice(null);
                }
            };

            chartRef.current.subscribeClick(handleClick);
            chartRef.current.subscribeCrosshairMove(handleMouseMove);

            // Add mouse leave handler to clear preview lines
            const handleMouseLeave = () => {
                if (isSandwichMode) {
                    clearSandwichPreviewLines();
                    setMousePrice(null);
                }
            };

            // Add mouse leave event to the container
            if (containerRef.current) {
                containerRef.current.addEventListener('mouseleave', handleMouseLeave);
            }

            // Add manual grid lines after chart is ready
            setTimeout(() => {
                addManualGridLines();
            }, 200);

            // Handle resize
            const handleResize = () => {
                if (containerRef.current && chartRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    chartRef.current.applyOptions({
                        width: rect.width,
                        height: rect.height
                    });
                }
            };

            window.addEventListener("resize", handleResize);

            return () => {
                window.removeEventListener("resize", handleResize);
                // Remove mouse leave event listener
                if (containerRef.current) {
                    containerRef.current.removeEventListener('mouseleave', handleMouseLeave);
                }
                if (chartRef.current) {
                    chartRef.current.remove();
                    chartRef.current = null;
                    seriesRef.current = null;
                    priceLineRef.current = null;
                    targetAreaRef.current = null;
                    orderLinesRef.current = [];
                    // Clean up area series
                    if ((window as any).orderAreaSeries) {
                        (window as any).orderAreaSeries = [];
                    }
                    // Clean up manual grid lines
                    if ((window as any).manualGridLines) {
                        (window as any).manualGridLines = [];
                    }
                    // Clean up sandwich lines
                    previewLinesRef.current = { buyLine: null, sellLine: null };
                    confirmedLinesRef.current = { buyLine: null, sellLine: null };
                    setSandwichPreviewLines({ buyLine: null, sellLine: null });
                    setSandwichConfirmedLines({ buyLine: null, sellLine: null });
                }
            };

        } catch (error) {
            console.error("Chart initialization failed:", error);
        }
    }, [data, crosshairMode, onTargetPriceChange, isSandwichMode, onSandwichBuyPriceChange, onSandwichSellPriceChange, sandwichSpread]);

    // Separate effect to ensure manual grid lines persist
    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        // Add a delay to ensure chart is ready
        const timeoutId = setTimeout(() => {
            // Clean up existing manual grid lines first
            if ((window as any).manualGridLines) {
                (window as any).manualGridLines.forEach((line: any) => {
                    try {
                        seriesRef.current?.removePriceLine(line);
                    } catch (e) {
                        // Ignore errors when removing lines
                    }
                });
                (window as any).manualGridLines = [];
            }

            // Recreate grid lines
            addManualGridLines();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [data]);

    // Separate effect to add order lines - this ensures they're added after chart creation
    useEffect(() => {
        if (!seriesRef.current || !userOrders.length) return;

        // Add a small delay to ensure chart is fully initialized
        const timeoutId = setTimeout(() => {
            addOrderLines();
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [data, userOrders, token.contractId, baseToken?.contractId, highlightedOrderId]);

    // Function to add order lines (extracted for reuse)
    const addOrderLines = useCallback(() => {
        if (!seriesRef.current) return;

        // Debug: Log what orders we received
        console.log(`=== Chart addOrderLines Debug ===`);
        console.log(`Chart token: ${token.symbol} (${token.contractId})`);
        console.log(`Base token: ${baseToken?.symbol || 'USD'} (${baseToken?.contractId || 'USD'})`);
        console.log(`Total orders received: ${userOrders.length}`);
        userOrders.forEach((order, i) => {
            console.log(`Order ${i}: ${order.inputTokenMeta.symbol} → ${order.outputTokenMeta.symbol} @ ${order.targetPrice} (${order.status})`);
        });
        console.log(`=== End Debug ===`);

        // Remove existing order lines
        orderLinesRef.current.forEach(line => {
            try {
                seriesRef.current?.removePriceLine(line);
            } catch (e) {
                // Ignore errors when removing lines
            }
        });
        orderLinesRef.current = [];

        // Clean up existing order fade lines
        if ((window as any).orderFadeLines) {
            (window as any).orderFadeLines.forEach((line: any) => {
                try {
                    seriesRef.current?.removePriceLine(line);
                } catch (e) {
                    // Ignore errors when removing lines
                }
            });
            (window as any).orderFadeLines = [];
        }

        // Clean up existing manual grid lines
        if ((window as any).manualGridLines) {
            (window as any).manualGridLines.forEach((line: any) => {
                try {
                    seriesRef.current?.removePriceLine(line);
                } catch (e) {
                    // Ignore errors when removing lines
                }
            });
            (window as any).manualGridLines = [];
        }

        // Clean up existing area series
        if ((window as any).orderAreaSeries) {
            (window as any).orderAreaSeries.forEach((areaSeries: any) => {
                try {
                    chartRef.current?.removeSeries(areaSeries);
                } catch (e) {
                    // Ignore errors when removing series
                }
            });
            (window as any).orderAreaSeries = [];
        }

        // Filter orders to only show those relevant to the current trading pair
        const relevantOrders = userOrders.filter(order => {
            // Only include open orders
            if (order.status !== 'open') {
                console.log(`Skipping order - status: ${order.status}`);
                return false;
            }

            // For now, show ALL open orders since the parent component already filters by trading pair
            // This ensures we don't double-filter and miss orders due to complex token relationships
            console.log(`Including order: ${order.inputTokenMeta.symbol} → ${order.outputTokenMeta.symbol} @ ${order.targetPrice}`);
            return true;
        });

        // If a specific order is highlighted, only show that one
        const ordersToShow = highlightedOrderId
            ? relevantOrders.filter(order => order.uuid === highlightedOrderId)
            : relevantOrders;

        console.log(`Filtering orders: ${userOrders.length} total, ${relevantOrders.length} relevant for ${token.symbol}/${baseToken?.symbol || 'USD'}${highlightedOrderId ? `, showing only highlighted order: ${highlightedOrderId}` : ', showing all relevant orders'}`);
        console.log(`Orders to show: ${ordersToShow.length}`);
        console.log(`Highlighted order ID: ${highlightedOrderId || 'none'}`);
        console.log(`Orders to show details:`, ordersToShow.map(o => `${o.uuid.slice(0, 8)} @ ${o.targetPrice}`));

        if (highlightedOrderId) {
            console.log(`🔍 HIGHLIGHT MODE: Only showing order ${highlightedOrderId.slice(0, 8)}`);
        } else {
            console.log(`📊 NORMAL MODE: Showing all ${ordersToShow.length} relevant orders`);
        }

        // Debug: Show current chart price range for comparison
        if (data && data.length > 0) {
            const chartPrices = data.map(d => d.value);
            const minChartPrice = Math.min(...chartPrices);
            const maxChartPrice = Math.max(...chartPrices);
            console.log(`Chart price range: ${minChartPrice.toFixed(8)} to ${maxChartPrice.toFixed(8)}`);

            // Show order prices for comparison
            ordersToShow.forEach((order, i) => {
                console.log(`Order ${i} price: ${order.targetPrice} (${order.inputTokenMeta.symbol} → ${order.outputTokenMeta.symbol})`);
            });
        }

        // Group orders by price level to avoid overlapping lines
        const ordersByPrice = new Map<string, DisplayOrder[]>();
        ordersToShow.forEach(order => {
            const priceKey = order.targetPrice;
            if (!ordersByPrice.has(priceKey)) {
                ordersByPrice.set(priceKey, []);
            }
            ordersByPrice.get(priceKey)!.push(order);
        });

        console.log(`Orders grouped by price: ${ordersByPrice.size} unique price levels`);
        ordersByPrice.forEach((orders, price) => {
            console.log(`Price ${price}: ${orders.length} orders`);
        });

        // Create aggregated order lines instead of individual ones
        ordersByPrice.forEach((orders, priceKey) => {
            try {
                const price = parseFloat(priceKey);

                if (!isNaN(price) && price > 0) {
                    // Calculate total amount and determine predominant direction
                    let totalAmount = 0;
                    let buyCount = 0;
                    let sellCount = 0;
                    let tokenSymbol = '';

                    orders.forEach(order => {
                        const amount = Number(order.amountIn) / (10 ** order.inputTokenMeta.decimals!);
                        totalAmount += amount;
                        tokenSymbol = order.inputTokenMeta.symbol;

                        if (order.direction === 'gt') {
                            buyCount++;
                        } else {
                            sellCount++;
                        }
                    });

                    // Determine predominant direction
                    const isPredominantlyBuy = buyCount >= sellCount;

                    // Format the total amount compactly
                    let formattedAmount: string;
                    if (totalAmount >= 1000000) {
                        formattedAmount = (totalAmount / 1000000).toFixed(1) + 'M';
                    } else if (totalAmount >= 1000) {
                        formattedAmount = (totalAmount / 1000).toFixed(1) + 'K';
                    } else if (totalAmount >= 1) {
                        formattedAmount = totalAmount.toFixed(2);
                    } else {
                        formattedAmount = totalAmount.toFixed(4);
                    }

                    // Create title showing aggregated info
                    let title = '';
                    if (orders.length === 1) {
                        title = `${isPredominantlyBuy ? '🟢' : '🔴'} ${formattedAmount} ${tokenSymbol}`;
                    } else {
                        title = `${isPredominantlyBuy ? '🟢' : '🔴'} ${formattedAmount} ${tokenSymbol} (${orders.length} orders)`;
                    }

                    console.log(`Creating aggregated price line at ${price}: ${title}`);

                    // Create aggregated ghost line with thicker line for multiple orders
                    const line = seriesRef.current!.createPriceLine({
                        price,
                        color: isPredominantlyBuy ? "#22c55e" : "#ef4444", // Bright green/red, fully opaque
                        lineWidth: 4, // Much thicker line
                        lineStyle: LineStyle.Solid, // Solid line instead of dashed for better visibility
                        axisLabelVisible: true,
                        title,
                    });
                    orderLinesRef.current.push(line);

                    // Create diminishing line effect to show order direction
                    if (data && data.length > 0) {
                        const chartPrices = data.map(d => d.value);
                        const minChartPrice = Math.min(...chartPrices);
                        const maxChartPrice = Math.max(...chartPrices);
                        const priceRange = maxChartPrice - minChartPrice;

                        // Create fading lines for each individual order (not just predominant)
                        orders.forEach(order => {
                            const numFadeLines = 8; // Fewer lines to avoid clutter
                            const maxFadeHeight = priceRange * 0.04; // Smaller, more focused fade area
                            const baseColor = order.direction === 'gt' ? "22, 197, 94" : "239, 68, 68"; // RGB values for green/red

                            // Store fade lines for cleanup (create array if it doesn't exist)
                            if (!(window as any).orderFadeLines) {
                                (window as any).orderFadeLines = [];
                            }

                            console.log(`Creating fade lines for order ${order.uuid.slice(0, 8)} at price ${price}, chart range: ${minChartPrice.toFixed(8)} - ${maxChartPrice.toFixed(8)}`);

                            if (order.direction === 'gt') {
                                // For buy orders (≥): create fading lines ABOVE the order price
                                for (let i = 1; i <= numFadeLines; i++) {
                                    const lineHeight = (maxFadeHeight / numFadeLines) * i;
                                    const linePrice = price + lineHeight;
                                    const opacity = Math.max(0.1, 1 - (i / (numFadeLines * 0.4))); // Slower fade, more visible

                                    // Ensure line is within chart bounds, or extend chart if needed
                                    if (linePrice <= maxChartPrice * 1.1) { // Allow slight extension beyond current range
                                        const fadeLine = seriesRef.current!.createPriceLine({
                                            price: linePrice,
                                            color: `rgba(${baseColor}, ${opacity * 0.6})`, // Higher opacity for better visibility
                                            lineWidth: Math.max(1, Math.floor(3 - (i / 3))) as 1 | 2 | 3 | 4, // Thicker lines
                                            lineStyle: LineStyle.Solid,
                                            axisLabelVisible: false,
                                            title: '',
                                        });

                                        orderLinesRef.current.push(fadeLine);
                                        (window as any).orderFadeLines.push(fadeLine);
                                        console.log(`  Created GT fade line ${i} at price ${linePrice.toFixed(8)} with opacity ${(opacity * 0.6).toFixed(2)}`);
                                    } else {
                                        console.log(`  Skipped GT fade line ${i} at price ${linePrice.toFixed(8)} (outside chart bounds)`);
                                    }
                                }
                            } else {
                                // For sell orders (≤): create fading lines BELOW the order price
                                for (let i = 1; i <= numFadeLines; i++) {
                                    const lineHeight = (maxFadeHeight / numFadeLines) * i;
                                    const linePrice = price - lineHeight;
                                    const opacity = Math.max(0.1, 1 - (i / (numFadeLines * 0.4))); // Slower fade, more visible

                                    // Ensure line is within chart bounds, or extend chart if needed
                                    if (linePrice >= minChartPrice * 0.9) { // Allow slight extension beyond current range
                                        const fadeLine = seriesRef.current!.createPriceLine({
                                            price: linePrice,
                                            color: `rgba(${baseColor}, ${opacity * 0.6})`, // Higher opacity for better visibility
                                            lineWidth: Math.max(1, Math.floor(3 - (i / 3))) as 1 | 2 | 3 | 4, // Thicker lines
                                            lineStyle: LineStyle.Solid,
                                            axisLabelVisible: false,
                                            title: '',
                                        });

                                        orderLinesRef.current.push(fadeLine);
                                        (window as any).orderFadeLines.push(fadeLine);
                                        console.log(`  Created LT fade line ${i} at price ${linePrice.toFixed(8)} with opacity ${(opacity * 0.6).toFixed(2)}`);
                                    } else {
                                        console.log(`  Skipped LT fade line ${i} at price ${linePrice.toFixed(8)} (outside chart bounds)`);
                                    }
                                }
                            }

                            console.log(`Created ${order.direction} order fade zone for order: ${order.uuid.slice(0, 8)} - ${numFadeLines} fading lines ${order.direction === 'gt' ? 'above' : 'below'} ${price}`);
                        });

                        console.log(`✅ Order line created at price ${price} with color ${isPredominantlyBuy ? 'green' : 'red'}`);

                        console.log(`Order line created successfully for ${isPredominantlyBuy ? 'buy' : 'sell'} orders`);
                    }
                }
            } catch (error) {
                console.warn("Failed to add aggregated order line:", error);
            }
        });

        // Recreate manual grid lines to ensure they persist
        setTimeout(() => {
            addManualGridLines();
        }, 100);
    }, [data, userOrders, token.contractId, baseToken?.contractId, highlightedOrderId]);

    // Update target price line and area zone
    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        try {
            // Remove existing target price line
            if (priceLineRef.current) {
                seriesRef.current.removePriceLine(priceLineRef.current);
                priceLineRef.current = null;
            }

            // Remove existing target area
            if (targetAreaRef.current) {
                chartRef.current?.removeSeries(targetAreaRef.current);
                targetAreaRef.current = null;
            }

            // Remove existing fade lines
            if ((window as any).targetFadeLines) {
                (window as any).targetFadeLines.forEach((line: any) => {
                    try {
                        seriesRef.current?.removePriceLine(line);
                    } catch (e) {
                        // Ignore errors when removing lines
                    }
                });
                (window as any).targetFadeLines = [];
            }

            const price = parseFloat(targetPrice);
            console.log(`Target price check: raw="${targetPrice}", parsed=${price}, valid=${!isNaN(price) && price > 0 && targetPrice.trim() !== '' && targetPrice !== '0'}`);
            if (!isNaN(price) && price > 0.001 && targetPrice.trim() !== '' && targetPrice !== '0' && targetPrice.length > 1) {
                // Create the target price line
                priceLineRef.current = seriesRef.current.createPriceLine({
                    price,
                    color: "rgba(249, 115, 22, 0.8)", // Slightly transparent orange
                    lineWidth: 2, // Thinner line
                    lineStyle: LineStyle.Solid,
                    axisLabelVisible: true,
                    title: `Target: ${conditionDir === 'gt' ? '≥' : '≤'} ${price.toFixed(6)}`,
                });

                // Create target price area zone based on condition direction
                const chartPrices = data.map(d => d.value);
                const minChartPrice = Math.min(...chartPrices);
                const maxChartPrice = Math.max(...chartPrices);
                const priceRange = maxChartPrice - minChartPrice;

                // Store references to all the fade lines for cleanup
                if (!(window as any).targetFadeLines) {
                    (window as any).targetFadeLines = [];
                }

                // Create multiple lines with fading opacity
                const numLines = 20; // More lines for tighter packing
                const maxHeight = priceRange * 0.12; // Extend further before transparent

                if (conditionDir === 'gt') {
                    // For ≥ (buy) orders: create fading lines ABOVE target price
                    for (let i = 1; i <= numLines; i++) {
                        const lineHeight = (maxHeight / numLines) * i;
                        const linePrice = price + lineHeight;
                        const opacity = Math.max(0.1, 1 - (i / (numLines * 0.7))); // Extend further before fading

                        if (linePrice <= maxChartPrice) {
                            const fadeLine = seriesRef.current!.createPriceLine({
                                price: linePrice,
                                color: `rgba(249, 115, 22, ${opacity * 0.5})`, // Orange with fading opacity
                                lineWidth: 2, // Thicker lines
                                lineStyle: LineStyle.Solid,
                                axisLabelVisible: false,
                                title: '',
                            });

                            (window as any).targetFadeLines.push(fadeLine);
                        }
                    }
                    console.log(`Created ≥ target zone: ${numLines} fading lines above ${price}`);

                } else {
                    // For ≤ (sell) orders: create fading lines BELOW target price
                    for (let i = 1; i <= numLines; i++) {
                        const lineHeight = (maxHeight / numLines) * i;
                        const linePrice = price - lineHeight;
                        const opacity = Math.max(0.1, 1 - (i / (numLines * 0.7))); // Extend further before fading

                        if (linePrice >= minChartPrice) {
                            const fadeLine = seriesRef.current!.createPriceLine({
                                price: linePrice,
                                color: `rgba(249, 115, 22, ${opacity * 0.5})`, // Orange with fading opacity
                                lineWidth: 2, // Thicker lines
                                lineStyle: LineStyle.Solid,
                                axisLabelVisible: false,
                                title: '',
                            });

                            (window as any).targetFadeLines.push(fadeLine);
                        }
                    }
                    console.log(`Created ≤ target zone: ${numLines} fading lines below ${price}`);
                }
            }
        } catch (error) {
            console.warn("Failed to update target price line and zone:", error);
        }
    }, [targetPrice, conditionDir, data]);

    // Function to add manual grid lines (extracted for reuse)
    const addManualGridLines = useCallback(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        const prices = data.map(d => d.value);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;

        // Dynamic precision calculation based on price range and magnitude
        const calculateOptimalGridInterval = (range: number, min: number, max: number): number => {
            // Calculate the order of magnitude for the range
            const rangeOrderOfMagnitude = Math.floor(Math.log10(range));

            // Calculate the order of magnitude for the average price
            const avgPrice = (min + max) / 2;
            const avgOrderOfMagnitude = Math.floor(Math.log10(Math.abs(avgPrice)));

            // Use the smaller order of magnitude to ensure good granularity
            const baseOrderOfMagnitude = Math.min(rangeOrderOfMagnitude, avgOrderOfMagnitude);

            // Start with a base interval
            let baseInterval = Math.pow(10, baseOrderOfMagnitude);

            // Adjust the interval to get a reasonable number of grid lines (10-50 lines)
            const targetGridLines = 20;
            let interval = baseInterval;
            let estimatedLines = range / interval;

            // Fine-tune the interval
            if (estimatedLines > 50) {
                // Too many lines, make interval larger
                if (estimatedLines > 100) {
                    interval = baseInterval * 5;
                } else {
                    interval = baseInterval * 2;
                }
            } else if (estimatedLines < 10) {
                // Too few lines, make interval smaller
                if (estimatedLines < 5) {
                    interval = baseInterval / 5;
                } else {
                    interval = baseInterval / 2;
                }
            }

            // Ensure minimum precision for very small numbers
            if (interval < 1e-12) {
                interval = 1e-12;
            }

            return interval;
        };

        const gridInterval = calculateOptimalGridInterval(priceRange, minPrice, maxPrice);

        // Calculate start and end prices aligned to grid
        const startPrice = Math.floor(minPrice / gridInterval) * gridInterval;
        const endPrice = Math.ceil(maxPrice / gridInterval) * gridInterval;

        // Determine appropriate decimal places for labels
        const getDecimalPlaces = (interval: number): number => {
            if (interval >= 1) return 2;
            if (interval >= 0.1) return 3;
            if (interval >= 0.01) return 4;
            if (interval >= 0.001) return 5;
            if (interval >= 0.0001) return 6;
            if (interval >= 0.00001) return 7;
            if (interval >= 0.000001) return 8;
            if (interval >= 0.0000001) return 9;
            if (interval >= 0.00000001) return 10;
            return 12; // Maximum precision
        };

        const decimalPlaces = getDecimalPlaces(gridInterval);

        // Create grid lines
        let lineCount = 0;
        const maxLines = 100; // Safety limit

        for (let price = startPrice; price <= endPrice && lineCount < maxLines; price += gridInterval) {
            // Round to avoid floating point precision issues
            price = Math.round(price / gridInterval) * gridInterval;

            if (price >= minPrice && price <= maxPrice) {
                try {
                    const gridLine = seriesRef.current!.createPriceLine({
                        price: price,
                        color: "rgba(156, 163, 175, 0.3)", // Subtle grid color
                        lineWidth: 1,
                        lineStyle: LineStyle.Solid,
                        axisLabelVisible: true,
                        title: '',
                    });

                    // Store grid lines for cleanup
                    if (!(window as any).manualGridLines) {
                        (window as any).manualGridLines = [];
                    }
                    (window as any).manualGridLines.push(gridLine);
                    lineCount++;
                } catch (e) {
                    console.warn('Failed to create grid line at price:', price, e);
                }
            }
        }

        console.log(`Added ${lineCount} manual grid lines from ${startPrice.toFixed(decimalPlaces)} to ${endPrice.toFixed(decimalPlaces)} with interval ${gridInterval.toFixed(decimalPlaces)} (range: ${priceRange.toFixed(decimalPlaces)})`);
    }, [data]);

    // Sandwich mode helper functions
    const updateSandwichPreviewLines = useCallback((centerPrice: number) => {
        if (!seriesRef.current || !isSandwichMode) return;

        // Always clear existing preview lines first using refs
        if (previewLinesRef.current.buyLine) {
            try {
                seriesRef.current.removePriceLine(previewLinesRef.current.buyLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
            previewLinesRef.current.buyLine = null;
        }
        if (previewLinesRef.current.sellLine) {
            try {
                seriesRef.current.removePriceLine(previewLinesRef.current.sellLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
            previewLinesRef.current.sellLine = null;
        }

        // Calculate buy and sell prices using dynamic spread
        const spreadPercent = parseFloat(sandwichSpread || '5') / 100; // Default to 5% if not provided
        const buyPrice = centerPrice * (1 - spreadPercent);
        const sellPrice = centerPrice * (1 + spreadPercent);

        // Create new preview lines (semi-transparent)
        try {
            const buyLine = seriesRef.current.createPriceLine({
                price: buyPrice,
                color: "rgba(34, 197, 94, 0.4)", // Semi-transparent green
                lineWidth: 2,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: `Buy: ${buyPrice.toFixed(6)}`,
            });

            const sellLine = seriesRef.current.createPriceLine({
                price: sellPrice,
                color: "rgba(239, 68, 68, 0.4)", // Semi-transparent red
                lineWidth: 2,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: `Sell: ${sellPrice.toFixed(6)}`,
            });

            // Update both refs and state
            previewLinesRef.current = { buyLine, sellLine };
            setSandwichPreviewLines({ buyLine, sellLine });
        } catch (e) {
            console.warn('Failed to create sandwich preview lines:', e);
        }
    }, [isSandwichMode, sandwichSpread]);

    const clearSandwichPreviewLines = useCallback(() => {
        if (!seriesRef.current) return;

        // Remove lines using refs for reliable tracking
        if (previewLinesRef.current.buyLine) {
            try {
                seriesRef.current.removePriceLine(previewLinesRef.current.buyLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
            previewLinesRef.current.buyLine = null;
        }
        if (previewLinesRef.current.sellLine) {
            try {
                seriesRef.current.removePriceLine(previewLinesRef.current.sellLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
            previewLinesRef.current.sellLine = null;
        }

        // Also clear state-based lines as backup
        if (sandwichPreviewLines.buyLine) {
            try {
                seriesRef.current.removePriceLine(sandwichPreviewLines.buyLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
        }
        if (sandwichPreviewLines.sellLine) {
            try {
                seriesRef.current.removePriceLine(sandwichPreviewLines.sellLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
        }

        // Clear state
        setSandwichPreviewLines({ buyLine: null, sellLine: null });
    }, []);

    const createSandwichConfirmedLines = useCallback((buyPrice: number, sellPrice: number) => {
        if (!seriesRef.current) return;

        // Remove existing confirmed lines using refs for reliable tracking
        if (confirmedLinesRef.current.buyLine) {
            try {
                seriesRef.current.removePriceLine(confirmedLinesRef.current.buyLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
            confirmedLinesRef.current.buyLine = null;
        }
        if (confirmedLinesRef.current.sellLine) {
            try {
                seriesRef.current.removePriceLine(confirmedLinesRef.current.sellLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
            confirmedLinesRef.current.sellLine = null;
        }

        // Also clean up state-based confirmed lines as backup
        if (sandwichConfirmedLines.buyLine) {
            try {
                seriesRef.current.removePriceLine(sandwichConfirmedLines.buyLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
        }
        if (sandwichConfirmedLines.sellLine) {
            try {
                seriesRef.current.removePriceLine(sandwichConfirmedLines.sellLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
        }

        // Clear preview lines using helper function
        clearSandwichPreviewLines();

        // Create confirmed lines (full opacity)
        try {
            const buyLine = seriesRef.current.createPriceLine({
                price: buyPrice,
                color: "#22c55e", // Full opacity green
                lineWidth: 3,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: `🟢 Buy Low: ${buyPrice.toFixed(6)}`,
            });

            const sellLine = seriesRef.current.createPriceLine({
                price: sellPrice,
                color: "#ef4444", // Full opacity red
                lineWidth: 3,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: `🔴 Sell High: ${sellPrice.toFixed(6)}`,
            });

            // Update both refs and state
            confirmedLinesRef.current = { buyLine, sellLine };
            setSandwichConfirmedLines({ buyLine, sellLine });
        } catch (e) {
            console.warn('Failed to create sandwich confirmed lines:', e);
        }
    }, [clearSandwichPreviewLines]);

    // Effect to handle sandwich mode changes
    useEffect(() => {
        if (!isSandwichMode && seriesRef.current) {
            // Clean up sandwich lines when exiting sandwich mode
            if (previewLinesRef.current.buyLine) {
                seriesRef.current.removePriceLine(previewLinesRef.current.buyLine);
                previewLinesRef.current.buyLine = null;
            }
            if (previewLinesRef.current.sellLine) {
                seriesRef.current.removePriceLine(previewLinesRef.current.sellLine);
                previewLinesRef.current.sellLine = null;
            }
            if (confirmedLinesRef.current.buyLine) {
                seriesRef.current.removePriceLine(confirmedLinesRef.current.buyLine);
                confirmedLinesRef.current.buyLine = null;
            }
            if (confirmedLinesRef.current.sellLine) {
                seriesRef.current.removePriceLine(confirmedLinesRef.current.sellLine);
                confirmedLinesRef.current.sellLine = null;
            }
            // Also clean up state-based lines as backup
            if (sandwichPreviewLines.buyLine) {
                seriesRef.current.removePriceLine(sandwichPreviewLines.buyLine);
            }
            if (sandwichPreviewLines.sellLine) {
                seriesRef.current.removePriceLine(sandwichPreviewLines.sellLine);
            }
            if (sandwichConfirmedLines.buyLine) {
                seriesRef.current.removePriceLine(sandwichConfirmedLines.buyLine);
            }
            if (sandwichConfirmedLines.sellLine) {
                seriesRef.current.removePriceLine(sandwichConfirmedLines.sellLine);
            }
            setSandwichPreviewLines({ buyLine: null, sellLine: null });
            setSandwichConfirmedLines({ buyLine: null, sellLine: null });
        }
    }, [isSandwichMode]);

    // Effect to update confirmed lines when sandwich prices change externally
    useEffect(() => {
        if (isSandwichMode && seriesRef.current && sandwichBuyPrice && sandwichSellPrice) {
            const buyPrice = parseFloat(sandwichBuyPrice);
            const sellPrice = parseFloat(sandwichSellPrice);
            if (!isNaN(buyPrice) && !isNaN(sellPrice)) {
                createSandwichConfirmedLines(buyPrice, sellPrice);
            }
        }
    }, [sandwichBuyPrice, sandwichSellPrice, isSandwichMode, createSandwichConfirmedLines]);

    // Load data on mount and when dependencies change
    useEffect(() => {
        loadChart();
    }, [loadChart]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
                    <div className="text-sm text-muted-foreground">Loading chart data...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <TrendingDown className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <div className="text-sm text-red-600 mb-2">Failed to load chart</div>
                    <Button variant="outline" size="sm" onClick={loadChart}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Chart Container */}
            <div ref={containerRef} className="flex-1 min-h-0" />
        </div>
    );
}

// Utility functions
function calculateRatioData(tokenData: LineData[], baseData: LineData[]): LineData[] {
    const ratioData: LineData[] = [];
    let baseIdx = 0;
    let currentBase: number | null = null;

    for (const point of tokenData) {
        const timeNum = Number(point.time);
        if (isNaN(timeNum)) continue;

        while (baseIdx < baseData.length && Number(baseData[baseIdx].time) <= timeNum) {
            if (isValidDataPoint(baseData[baseIdx])) {
                currentBase = baseData[baseIdx].value;
            }
            baseIdx++;
        }

        if (currentBase && currentBase !== 0 && !isNaN(currentBase) && point.value && point.value !== 0 && !isNaN(point.value)) {
            ratioData.push({
                time: point.time,
                value: currentBase / point.value  // Inverted: base/token instead of token/base
            });
        }
    }

    return ratioData;
}

function isValidDataPoint(point: LineData): boolean {
    return !!(
        point &&
        typeof point.time !== 'undefined' &&
        typeof point.value === 'number' &&
        !isNaN(point.value) &&
        isFinite(point.value)
    );
} 