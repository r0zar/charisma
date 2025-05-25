'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    LineSeries,
    ColorType,
} from 'lightweight-charts';

interface TokenChartProps {
    primary: string; // contract ID of the primary token
    compareId?: string | null; // optional compare ID
    primaryColor: string;
    compareColor: string;
}

export default function TokenChart({ primary, compareId, primaryColor, compareColor }: TokenChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const primarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const compareSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const [compareIdState, setCompareIdState] = useState<string | null>(compareId ?? null);
    const [loading, setLoading] = useState(false);

    // keep local state in sync with prop
    useEffect(() => {
        setCompareIdState(compareId ?? null);
    }, [compareId]);

    /* -------- initialise chart -------- */
    useEffect(() => {
        if (!containerRef.current) return;
        chartRef.current = createChart(containerRef.current, {
            height: 400,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3af', // tailwind muted-foreground
            },
            grid: {
                vertLines: { color: 'rgba(133, 133, 133, 0.1)' },
                horzLines: { color: 'rgba(133, 133, 133, 0.1)' },
            },
            timeScale: { timeVisible: true, secondsVisible: false },
            leftPriceScale: {
                visible: true,
                borderVisible: false,
                scaleMargins: { top: 0.2, bottom: 0.2 },
            },
            rightPriceScale: {
                visible: true,
                borderVisible: false,
                scaleMargins: { top: 0.2, bottom: 0.2 },
            },
        });
        primarySeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: primaryColor,
            priceScaleId: 'left',
        }) as ISeriesApi<'Line'>;

        // cleanup chart on unmount
        return () => {
            chartRef.current?.remove();
        };
    }, []);

    /* -------- load primary token series -------- */
    useEffect(() => {
        if (!primarySeriesRef.current) return;
        fetch(`/api/price-series?contractId=${encodeURIComponent(primary)}`)
            .then((res) => res.json())
            .then((data: LineData[]) => {
                primarySeriesRef.current?.setData(data);
            })
            .catch(console.error);
    }, [primary]);

    /* -------- update primary color when it changes -------- */
    useEffect(() => {
        primarySeriesRef.current?.applyOptions({ color: primaryColor });
    }, [primaryColor]);

    useEffect(() => {
        // remove previous compare series (if any)
        if (chartRef.current && compareSeriesRef.current) {
            try {
                chartRef.current.removeSeries(compareSeriesRef.current);
            } catch (e) {
                console.warn('removeSeries failed', e);
            }
            compareSeriesRef.current = null;
        }
        if (!compareIdState) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const newSeries = chartRef.current!.addSeries(LineSeries, {
            color: compareColor,
            priceScaleId: 'right',
        }) as ISeriesApi<'Line'>;

        compareSeriesRef.current = newSeries;

        fetch(`/api/price-series?contractId=${encodeURIComponent(compareIdState)}`)
            .then((res) => res.json())
            .then((data: LineData[]) => {
                newSeries.setData(data);
                setLoading(false);
            })
            .catch(console.error);
    }, [compareIdState, compareColor]);

    /* -------- responsive resize -------- */
    useEffect(() => {
        function handleResize() {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
            }
        }
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="mb-8">
            <div ref={containerRef} className="w-full relative">
                {loading && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
                        <svg className="animate-spin h-6 w-6 text-muted-foreground" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16 8 8 0 010-16z" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
}