// Centralized admin configuration - single source of truth
export const ADMIN_CONFIG = {
    // Price system configuration
    RETENTION_MS: Number(process.env.PRICE_RETENTION_MS ?? 1000 * 60 * 60 * 24 * 3),
    RETENTION_DAYS: 3,
    PRICE_EPSILON: Number(process.env.PRICE_EPSILON ?? 0.0001),
    PRICE_EPSILON_PERCENT: 0.01, // 0.0001 = 0.01%

    // Pagination and loading
    PAGE_SIZE: 50,
    MAX_PAGES: 200,

    // Timing and refresh
    CRON_FREQUENCY_MINUTES: 1,
    AUTO_REFRESH_SECONDS: 30,

    // UI constraints for large monitors
    MAX_WIDTH: {
        ADMIN_MAIN: 'max-w-[1600px]',   // Main admin pages
        ADMIN_WIDE: 'max-w-[2000px]',   // Extra wide for data tables
        ADMIN_NARROW: 'max-w-4xl',      // Narrow for forms/settings
    },

    // Status and messaging
    RESULT_DISPLAY_DURATION: 5000,

    // Performance thresholds
    PERFORMANCE: {
        GOOD_LOAD_TIME: 2000,
        WARNING_LOAD_TIME: 5000,
        ERROR_LOAD_TIME: 10000,
    }
} as const;

// Helper functions for common calculations
export const getRetentionDays = () => ADMIN_CONFIG.RETENTION_DAYS;
export const getPriceEpsilonPercent = () => ADMIN_CONFIG.PRICE_EPSILON_PERCENT;
export const getPageSize = () => ADMIN_CONFIG.PAGE_SIZE;
export const getCronFrequencyMinutes = () => ADMIN_CONFIG.CRON_FREQUENCY_MINUTES;
export const getAutoRefreshSeconds = () => ADMIN_CONFIG.AUTO_REFRESH_SECONDS;

// Environment helpers
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production'; 