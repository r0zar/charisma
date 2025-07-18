import { type LineData, type Time } from 'lightweight-charts';
import type { TimeSeriesEntry } from '@services/prices';

/**
 * Adapter for converting between TimeSeriesEntry and LineData formats
 */
export class TimeSeriesAdapter {
    /**
     * Convert a single TimeSeriesEntry to LineData
     */
    static entryToLineData(entry: TimeSeriesEntry): LineData<Time> {
        return {
            time: entry.timestamp as Time,
            value: entry.usdPrice || 0,
        };
    }

    /**
     * Convert an array of TimeSeriesEntry to LineData array
     */
    static entriesToLineData(entries: TimeSeriesEntry[]): LineData<Time>[] {
        return entries
            .map(entry => this.entryToLineData(entry))
            .filter(point => !isNaN(point.time as number) && !isNaN(point.value))
            .sort((a, b) => (a.time as number) - (b.time as number));
    }

    /**
     * Convert TimeSeriesEntry array to LineData with time range filtering
     */
    static entriesToLineDataWithRange(
        entries: TimeSeriesEntry[],
        fromTime?: number,
        toTime?: number
    ): LineData<Time>[] {
        let filtered = entries;

        if (fromTime !== undefined || toTime !== undefined) {
            filtered = entries.filter(entry => {
                if (fromTime !== undefined && entry.timestamp < fromTime) return false;
                if (toTime !== undefined && entry.timestamp > toTime) return false;
                return true;
            });
        }

        return this.entriesToLineData(filtered);
    }

    /**
     * Convert a single LineData to TimeSeriesEntry
     */
    static lineDataToEntry(
        data: LineData<Time>,
        tokenId: string,
        source: string = 'unknown',
        reliability: number = 1
    ): TimeSeriesEntry {
        return {
            timestamp: data.time as number,
            tokenId,
            usdPrice: data.value,
            sbtcRatio: 0, // This would need to be calculated separately
            source,
            reliability,
        };
    }

    /**
     * Convert an array of LineData to TimeSeriesEntry array
     */
    static lineDataToEntries(
        data: LineData<Time>[],
        tokenId: string,
        source: string = 'unknown',
        reliability: number = 1
    ): TimeSeriesEntry[] {
        return data.map(item => this.lineDataToEntry(item, tokenId, source, reliability));
    }

    /**
     * Convert bulk price series response to PriceSeriesData format
     */
    static bulkResponseToSeriesData(
        bulkData: { [tokenId: string]: TimeSeriesEntry[] },
        fromTime?: number,
        toTime?: number
    ): { [tokenId: string]: LineData<Time>[] } {
        const result: { [tokenId: string]: LineData<Time>[] } = {};

        Object.entries(bulkData).forEach(([tokenId, entries]) => {
            result[tokenId] = this.entriesToLineDataWithRange(entries, fromTime, toTime);
        });

        return result;
    }

    /**
     * Validate and sanitize LineData array
     */
    static validateLineData(data: LineData<Time>[]): LineData<Time>[] {
        return data
            .filter(point => {
                const time = point.time as number;
                const value = point.value;

                // Validate time is a positive number
                if (!time || time <= 0 || !isFinite(time)) return false;

                // Validate value is a finite number
                if (typeof value !== 'number' || !isFinite(value) || value < 0) return false;

                return true;
            })
            .sort((a, b) => (a.time as number) - (b.time as number));
    }

    /**
     * Fill gaps in time series data with interpolated values
     */
    static fillGaps(
        data: LineData<Time>[],
        intervalSeconds: number,
        maxGapToFill: number = 3600 // 1 hour default
    ): LineData<Time>[] {
        if (data.length < 2) return data;

        const filled: LineData<Time>[] = [];

        for (let i = 0; i < data.length - 1; i++) {
            const current = data[i];
            const next = data[i + 1];

            filled.push(current);

            const currentTime = current.time as number;
            const nextTime = next.time as number;
            const gap = nextTime - currentTime;

            // Only fill gaps smaller than maxGapToFill
            if (gap > intervalSeconds && gap <= maxGapToFill) {
                const steps = Math.floor(gap / intervalSeconds);
                const valueStep = (next.value - current.value) / (steps + 1);

                for (let j = 1; j <= steps; j++) {
                    filled.push({
                        time: (currentTime + (j * intervalSeconds)) as Time,
                        value: current.value + (valueStep * j),
                    });
                }
            }
        }

        // Add the last point
        filled.push(data[data.length - 1]);

        return filled;
    }

    /**
     * Downsample data to reduce number of points
     */
    static downsample(data: LineData<Time>[], maxPoints: number): LineData<Time>[] {
        if (data.length <= maxPoints) return data;

        const interval = Math.floor(data.length / maxPoints);
        const downsampled: LineData<Time>[] = [];

        for (let i = 0; i < data.length; i += interval) {
            // Take the average of points in the interval
            const endIndex = Math.min(i + interval, data.length);
            let sumValue = 0;
            let count = 0;

            for (let j = i; j < endIndex; j++) {
                sumValue += data[j].value;
                count++;
            }

            if (count > 0) {
                downsampled.push({
                    time: data[i].time, // Use the first timestamp in the interval
                    value: sumValue / count,
                });
            }
        }

        // Always include the last point
        if (downsampled[downsampled.length - 1]?.time !== data[data.length - 1].time) {
            downsampled.push(data[data.length - 1]);
        }

        return downsampled;
    }
}

// Export convenience functions
export const entriesToLineData = TimeSeriesAdapter.entriesToLineData.bind(TimeSeriesAdapter);
export const bulkResponseToSeriesData = TimeSeriesAdapter.bulkResponseToSeriesData.bind(TimeSeriesAdapter);
export const validateLineData = TimeSeriesAdapter.validateLineData.bind(TimeSeriesAdapter);