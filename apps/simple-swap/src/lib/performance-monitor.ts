/**
 * Performance monitoring utilities for tracking critical application metrics
 */

export interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

export class PerformanceMonitor {
    private static metrics: PerformanceMetric[] = [];
    private static maxMetrics = 1000; // Keep last 1000 metrics

    /**
     * Start timing an operation
     */
    static startTiming(name: string): PerformanceTimer {
        return new PerformanceTimer(name);
    }

    /**
     * Record a metric manually
     */
    static recordMetric(name: string, duration: number, metadata?: Record<string, any>): void {
        const metric: PerformanceMetric = {
            name,
            duration,
            timestamp: Date.now(),
            metadata
        };

        this.metrics.push(metric);
        
        // Keep only the most recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }

        // Log slow operations
        if (duration > 1000) {
            console.warn(`[PERFORMANCE] Slow operation detected: ${name} took ${duration}ms`, metadata);
        }
    }

    /**
     * Get metrics for analysis
     */
    static getMetrics(filterName?: string): PerformanceMetric[] {
        if (filterName) {
            return this.metrics.filter(m => m.name.includes(filterName));
        }
        return [...this.metrics];
    }

    /**
     * Get performance summary for a specific operation
     */
    static getSummary(name: string): {
        count: number;
        avgDuration: number;
        minDuration: number;
        maxDuration: number;
        recentDuration: number;
    } | null {
        const filtered = this.metrics.filter(m => m.name === name);
        if (filtered.length === 0) return null;

        const durations = filtered.map(m => m.duration);
        const recent = filtered[filtered.length - 1];

        return {
            count: filtered.length,
            avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            recentDuration: recent.duration
        };
    }

    /**
     * Clear all metrics
     */
    static clear(): void {
        this.metrics = [];
    }
}

export class PerformanceTimer {
    private startTime: number;
    private name: string;

    constructor(name: string) {
        this.name = name;
        this.startTime = performance.now();
    }

    /**
     * End timing and record the metric
     */
    end(metadata?: Record<string, any>): number {
        const duration = performance.now() - this.startTime;
        PerformanceMonitor.recordMetric(this.name, duration, metadata);
        return duration;
    }

    /**
     * End timing with a custom name
     */
    endAs(name: string, metadata?: Record<string, any>): number {
        const duration = performance.now() - this.startTime;
        PerformanceMonitor.recordMetric(name, duration, metadata);
        return duration;
    }
}

/**
 * Decorator for automatic performance monitoring of async functions
 */
export function monitor(name?: string) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const metricName = name || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function(...args: any[]) {
            const timer = PerformanceMonitor.startTiming(metricName);
            try {
                const result = await originalMethod.apply(this, args);
                timer.end({ success: true });
                return result;
            } catch (error) {
                timer.end({ success: false, error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Simple function wrapper for performance monitoring
 */
export async function withMonitoring<T>(
    name: string, 
    fn: () => Promise<T>, 
    metadata?: Record<string, any>
): Promise<T> {
    const timer = PerformanceMonitor.startTiming(name);
    try {
        const result = await fn();
        timer.end({ ...metadata, success: true });
        return result;
    } catch (error) {
        timer.end({ ...metadata, success: false, error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
}

// Export singleton instance for convenience
export const perfMonitor = PerformanceMonitor;