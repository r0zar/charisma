/**
 * Chart Data Utilities
 * Reusable functions for handling and processing chart data with resilience features
 */

export interface ChartDataPoint {
    time: number;
    value: number;
}

export interface TimeRange {
    start: number; // milliseconds
    end: number;   // milliseconds
}

/**
 * Validates if a data point is valid for chart display
 */
export function isValidDataPoint(point: ChartDataPoint): boolean {
    return !!(
        point &&
        typeof point.time !== 'undefined' &&
        typeof point.value === 'number' &&
        !isNaN(point.value) &&
        isFinite(point.value)
    );
}

/**
 * Extrapolates sparse data points across a time range to ensure meaningful charts
 * 
 * @param data - Original data points
 * @param targetTimeRange - Time range to cover
 * @param minPoints - Minimum number of points to generate (default: 10)
 * @returns Extrapolated data points
 */
export function extrapolateDataPoints(
    data: ChartDataPoint[], 
    targetTimeRange: TimeRange, 
    minPoints: number = 10
): ChartDataPoint[] {
    if (!data || data.length === 0) return [];
    
    // If we have enough data points, return as-is
    if (data.length >= minPoints) return data;
    
    console.log(`[extrapolateDataPoints] Extrapolating ${data.length} points (target: ${minPoints})`);
    
    // If we have only one data point, extrapolate it across the time range
    if (data.length === 1) {
        const price = data[0].value;
        const startTime = targetTimeRange.start;
        const endTime = targetTimeRange.end;
        const timeSpan = endTime - startTime;
        const interval = Math.max(timeSpan / (minPoints - 1), 60000); // At least 60 seconds between points
        
        const extrapolatedData: ChartDataPoint[] = [];
        for (let i = 0; i < minPoints; i++) {
            const time = startTime + (i * interval);
            extrapolatedData.push({
                time: Math.floor(time / 1000), // Convert to seconds for lightweight-charts
                value: price
            });
        }
        
        console.log(`[extrapolateDataPoints] Single point extrapolated to ${extrapolatedData.length} points`);
        return extrapolatedData;
    }
    
    // If we have few data points, extend the range and interpolate
    if (data.length < minPoints) {
        const extrapolatedData: ChartDataPoint[] = [...data];
        const startTime = targetTimeRange.start;
        const endTime = targetTimeRange.end;
        
        // Add points at the beginning if needed
        if (Number(data[0].time) * 1000 > startTime) {
            extrapolatedData.unshift({
                time: Math.floor(startTime / 1000),
                value: data[0].value
            });
        }
        
        // Add points at the end if needed
        if (Number(data[data.length - 1].time) * 1000 < endTime) {
            extrapolatedData.push({
                time: Math.floor(endTime / 1000),
                value: data[data.length - 1].value
            });
        }
        
        // If we still need more points, interpolate between existing points
        if (extrapolatedData.length < minPoints) {
            const interpolated = interpolateDataPoints(extrapolatedData, minPoints);
            console.log(`[extrapolateDataPoints] Interpolated ${extrapolatedData.length} to ${interpolated.length} points`);
            return interpolated;
        }
        
        console.log(`[extrapolateDataPoints] Extended ${data.length} to ${extrapolatedData.length} points`);
        return extrapolatedData;
    }
    
    return data;
}

/**
 * Interpolates additional points between existing data points
 */
function interpolateDataPoints(data: ChartDataPoint[], targetPoints: number): ChartDataPoint[] {
    if (data.length >= targetPoints || data.length < 2) return data;
    
    const result: ChartDataPoint[] = [];
    const pointsToAdd = targetPoints - data.length;
    const segmentSize = Math.floor(pointsToAdd / (data.length - 1));
    
    for (let i = 0; i < data.length - 1; i++) {
        result.push(data[i]);
        
        // Add interpolated points between current and next
        const current = data[i];
        const next = data[i + 1];
        const timeDiff = next.time - current.time;
        const valueDiff = next.value - current.value;
        
        for (let j = 1; j <= segmentSize; j++) {
            const ratio = j / (segmentSize + 1);
            result.push({
                time: Math.floor(current.time + (timeDiff * ratio)),
                value: current.value + (valueDiff * ratio)
            });
        }
    }
    
    // Add the last point
    result.push(data[data.length - 1]);
    
    return result;
}

/**
 * Calculates ratio data between two token price series with resilience features
 * 
 * @param tokenData - Primary token data (numerator)
 * @param baseData - Base token data (denominator)
 * @param options - Configuration options
 * @returns Calculated ratio data points
 */
export function calculateResilientRatioData(
    tokenData: ChartDataPoint[], 
    baseData: ChartDataPoint[],
    options: {
        minPoints?: number;
        defaultTimeRangeMs?: number;
    } = {}
): ChartDataPoint[] {
    const { minPoints = 10, defaultTimeRangeMs = 30 * 24 * 60 * 60 * 1000 } = options;
    
    if (!tokenData || !baseData || tokenData.length === 0 || baseData.length === 0) {
        console.warn('[calculateResilientRatioData] Insufficient data for ratio calculation');
        return [];
    }

    // Determine the time range we're working with
    const tokenTimes = tokenData.map(p => Number(p.time) * 1000);
    const baseTimes = baseData.map(p => Number(p.time) * 1000);
    const allTimes = [...tokenTimes, ...baseTimes];
    
    let timeRange: TimeRange;
    if (allTimes.length > 0) {
        timeRange = {
            start: Math.min(...allTimes),
            end: Math.max(...allTimes)
        };
    } else {
        // Fallback to default time range
        const now = Date.now();
        timeRange = {
            start: now - defaultTimeRangeMs,
            end: now
        };
    }

    // Extrapolate sparse data to ensure we have enough points for meaningful ratios
    const extrapolatedTokenData = extrapolateDataPoints(tokenData, timeRange, minPoints);
    const extrapolatedBaseData = extrapolateDataPoints(baseData, timeRange, minPoints);

    console.log(`[calculateResilientRatioData] Token: ${tokenData.length} -> ${extrapolatedTokenData.length}, Base: ${baseData.length} -> ${extrapolatedBaseData.length}`);

    // Calculate ratios with forward-fill logic for base prices
    const ratioData: ChartDataPoint[] = [];
    let baseIdx = 0;
    let currentBase: number | null = null;

    for (const point of extrapolatedTokenData) {
        const timeNum = Number(point.time);
        if (isNaN(timeNum)) continue;

        // Find the most recent base price at or before this time
        while (baseIdx < extrapolatedBaseData.length && Number(extrapolatedBaseData[baseIdx].time) <= timeNum) {
            if (isValidDataPoint(extrapolatedBaseData[baseIdx])) {
                currentBase = extrapolatedBaseData[baseIdx].value;
            }
            baseIdx++;
        }

        // If we don't have a base price yet, use the first available base price
        if (currentBase === null && extrapolatedBaseData.length > 0) {
            currentBase = extrapolatedBaseData[0].value;
        }

        // Calculate ratio if we have valid data
        if (currentBase && currentBase !== 0 && !isNaN(currentBase)) {
            ratioData.push({
                time: point.time,
                value: point.value / currentBase
            });
        }
    }

    console.log(`[calculateResilientRatioData] Generated ${ratioData.length} ratio points`);
    return ratioData;
}

/**
 * Gets a default time range for chart data (last 30 days)
 */
export function getDefaultTimeRange(): TimeRange {
    const now = Date.now();
    return {
        start: now - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: now
    };
}

/**
 * Applies extrapolation to single token data if it's sparse
 */
export function enhanceSparseTokenData(
    data: ChartDataPoint[], 
    timeRange?: TimeRange,
    minPoints: number = 10
): ChartDataPoint[] {
    if (!data || data.length === 0) return [];
    
    // Use provided time range or default
    const targetTimeRange = timeRange || getDefaultTimeRange();
    
    // Apply extrapolation if data is sparse
    if (data.length < minPoints) {
        return extrapolateDataPoints(data, targetTimeRange, minPoints);
    }
    
    return data;
}