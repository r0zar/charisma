"use client";

import React, { useEffect, useRef, useMemo } from "react";
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    LineSeries,
    ColorType,
} from "lightweight-charts";
import type { Token } from "../lib/_swap-client";
import { useDominantColor } from "./utils/useDominantColor";

interface MiniTokenChartProps {
    tokens: Token[]; // expect 1–3 tokens
}

export default function MiniTokenChart({ tokens }: MiniTokenChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

    // fallback palette colours
    const palette = ["#3b82f6", "#f97316", "#10b981", "#ec4899", "#14b8a6"];

    // extract dominant colours for up to 5 tokens (max supported by palette)
    const dominant0 = useDominantColor(tokens[0]?.image ?? null);
    const dominant1 = useDominantColor(tokens[1]?.image ?? null);
    const dominant2 = useDominantColor(tokens[2]?.image ?? null);
    const dominant3 = useDominantColor(tokens[3]?.image ?? null);
    const dominant4 = useDominantColor(tokens[4]?.image ?? null);

    const computedColours = useMemo(() => {
        const arr = [dominant0, dominant1, dominant2, dominant3, dominant4];
        const obj: Record<string, string> = {};
        tokens.forEach((t, idx) => {
            const dom = arr[idx];
            obj[t.contractId] = dom ?? palette[idx % palette.length];
        });
        return obj;
    }, [tokens, dominant0, dominant1, dominant2, dominant3, dominant4]);

    // helper to sync series with current tokens
    const syncSeries = React.useCallback(() => {
        if (!chartRef.current) return;
        // remove outdated
        seriesRefs.current.forEach((series, id) => {
            if (!tokens.find((t) => t.contractId === id)) {
                try { chartRef.current?.removeSeries(series); } catch { }
                seriesRefs.current.delete(id);
            }
        });
        // add/update
        tokens.forEach((token, idx) => {
            let s = seriesRefs.current.get(token.contractId);
            if (!s) {
                // choose a price scale for this series so each token has independent scaling
                const scaleId = idx === 0 ? 'left' : idx === 1 ? 'right' : `scale-${idx}`;

                s = chartRef.current!.addSeries(LineSeries, {
                    color: computedColours[token.contractId],
                    lineWidth: 2,
                    priceScaleId: scaleId,
                }) as ISeriesApi<'Line'>;
                seriesRefs.current.set(token.contractId, s);
                loadSeriesData(token, s);

                // now the scale exists, apply consistent hidden styling for custom/non-default scales
                if (!['left', 'right'].includes(scaleId)) {
                    s.priceScale().applyOptions({
                        visible: false,
                        borderVisible: false,
                        scaleMargins: { top: 0.2, bottom: 0.2 },
                    });
                }
            } else {
                s.applyOptions({ color: computedColours[token.contractId] });
            }
        });

        // ensure the time scale fits the available data every time we sync
        chartRef.current?.timeScale().fitContent();
    }, [tokens, computedColours]);

    function loadSeriesData(token: Token, series: ISeriesApi<'Line'>) {
        async function fetchSeries(id: string) {
            try {
                const r = await fetch(`/api/price-series?contractId=${encodeURIComponent(id)}`);
                const data: LineData[] = await r.json();
                if (data.length) { series.setData(data); return true; }
            } catch { /* ignore */ }
            return false;
        }
        (async () => {
            const ok = await fetchSeries(token.contractId);
            if (!ok && token.contractId.includes('-subnet')) {
                const baseId = token.contractId.substring(0, token.contractId.lastIndexOf('-subnet'));
                await fetchSeries(baseId);
            }
        })();
    }

    // create chart if not existing, then sync on every token/colour change
    useEffect(() => {
        if (!containerRef.current) return;
        if (!chartRef.current) {
            chartRef.current = createChart(containerRef.current, {
                height: 130,
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
                    visible: false,
                    borderVisible: false,
                    scaleMargins: { top: 0.2, bottom: 0.2 },
                },
                rightPriceScale: {
                    visible: false,
                    borderVisible: false,
                    scaleMargins: { top: 0.2, bottom: 0.2 },
                },
            });
        }

        syncSeries();

        return () => { /* cleanup on unmount */ };
    }, [tokens, computedColours, syncSeries]);

    // responsive resize
    useEffect(() => {
        function handle() {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
            }
        }
        window.addEventListener("resize", handle);
        handle();
        return () => window.removeEventListener("resize", handle);
    }, []);

    return <div ref={containerRef} className="w-full h-[140px]" />;
} 