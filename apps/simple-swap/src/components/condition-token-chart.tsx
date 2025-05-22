"use client";

import React, { useEffect, useRef } from "react";
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    LineSeries,
    ColorType,
    type IPriceLine,
    LineStyle,
} from "lightweight-charts";
import type { Token } from "../lib/swap-client";

interface Props {
    token: Token;
    baseToken?: Token | null; // null means SUSDT / USD
    targetPrice: string; // decimal string (ratio)
    onTargetPriceChange: (price: string) => void;
    colour?: string;
}

export default function ConditionTokenChart({ token, baseToken, targetPrice, onTargetPriceChange, colour = "#3b82f6" }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const priceLineRef = useRef<IPriceLine | null>(null);


    // create chart and series once
    useEffect(() => {
        if (!containerRef.current) return;
        chartRef.current = createChart(containerRef.current, {
            height: 220,
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#9ca3af",
            },
            grid: {
                vertLines: { color: "rgba(133,133,133,0.1)" },
                horzLines: { color: "rgba(133,133,133,0.1)" },
            },
            timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
            leftPriceScale: {
                visible: true,
                borderVisible: false,
                scaleMargins: { top: 0.2, bottom: 0.2 },
            },
            rightPriceScale: { visible: false },
            localization: {
                priceFormatter: (price: number) => {
                    // Determine the number of decimal places needed
                    // For very small numbers, use more precision.
                    // This is a basic heuristic; can be made more sophisticated.
                    if (price === 0) return '0.00';
                    const absPrice = Math.abs(price);
                    let decimals = 2;
                    if (absPrice < 0.0001) decimals = 8;
                    else if (absPrice < 0.01) decimals = 6;
                    else if (absPrice < 1) decimals = 4;
                    return price.toFixed(decimals);
                },
            },
        });

        seriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: colour,
            lineWidth: 2,
        }) as ISeriesApi<'Line'>;

        loadSeriesData(token, baseToken);

        // click handler to update targetPrice
        const clickHandler = (param: any) => {
            if (!param.point || !seriesRef.current) return;
            const price = seriesRef.current.coordinateToPrice(param.point.y);
            if (price && !isNaN(price)) {
                onTargetPriceChange(price.toPrecision(9));
            }
        };
        chartRef.current.subscribeClick(clickHandler);

        // responsive resize
        const resize = () => {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
            }
        };
        window.addEventListener("resize", resize);
        resize();

        return () => {
            chartRef.current?.unsubscribeClick(clickHandler);
            window.removeEventListener("resize", resize);
            chartRef.current?.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // reload series data when token changes
    useEffect(() => {
        if (!seriesRef.current) return;
        loadSeriesData(token, baseToken);
    }, [token, baseToken]);

    // update line colour when prop changes
    useEffect(() => {
        seriesRef.current?.applyOptions({ color: colour });
    }, [colour]);

    // update price line when targetPrice changes
    useEffect(() => {
        if (!seriesRef.current) return;
        const price = parseFloat(targetPrice);
        if (isNaN(price)) return;
        if (!priceLineRef.current) {
            priceLineRef.current = seriesRef.current.createPriceLine({
                price,
                color: "#f97316",
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: "Target",
            });
        } else {
            priceLineRef.current.applyOptions({ price });
        }
    }, [targetPrice]);

    // reset price line on token change
    useEffect(() => {
        if (!seriesRef.current) return;
        if (priceLineRef.current) {
            seriesRef.current.removePriceLine(priceLineRef.current);
            priceLineRef.current = null;
        }
        const price = parseFloat(targetPrice);
        if (!isNaN(price)) {
            priceLineRef.current = seriesRef.current.createPriceLine({
                price,
                color: "#f97316",
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: "Target",
            });
        }
    }, [token]);

    async function loadSeriesData(tok: Token, baseTok?: Token | null) {
        if (!seriesRef.current) return;
        try {
            const r = await fetch(`/api/price-series?contractId=${encodeURIComponent(tok.contractId)}`);
            const tokenData: LineData[] = await r.json();

            let ratioData: LineData[] = tokenData;

            if (baseTok) {
                const rb = await fetch(`/api/price-series?contractId=${encodeURIComponent(baseTok.contractId)}`);
                const baseData: LineData[] = await rb.json();

                // Both series should be sorted by time already (ascending unix timestamp)
                let baseIdx = 0;
                let currentBase: number | null = null;

                ratioData = [];
                for (const pt of tokenData) {
                    const timeNum = Number(pt.time);
                    // advance baseIdx to latest base point <= token time
                    while (baseIdx < baseData.length && Number(baseData[baseIdx].time) <= timeNum) {
                        currentBase = baseData[baseIdx].value;
                        baseIdx++;
                    }
                    if (currentBase && currentBase !== 0) {
                        ratioData.push({ time: pt.time, value: pt.value / currentBase });
                    }
                }
            }

            if (ratioData.length) {
                seriesRef.current.setData(ratioData);
                chartRef.current?.timeScale().fitContent();
            }
        } catch {
            // ignore
        }
    }

    return <div ref={containerRef} className="w-full h-[220px]" />;
} 