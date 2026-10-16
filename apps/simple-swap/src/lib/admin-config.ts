/** What the admin wallet signs (with a timestamp, valid 5 minutes) to call admin endpoints */
export const ADMIN_AUTH_MESSAGE = 'charisma-swap-admin';

// Centralized admin configuration - single source of truth
export const ADMIN_CONFIG = {
    // Pagination and loading
    PAGE_SIZE: 50,
    MAX_PAGES: 200,

    // Timing and refresh
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
    },

    // Date/time formatting options for consistent local time display
    DATE_TIME_OPTIONS: {
        DATE_ONLY: {
            year: 'numeric' as const,
            month: 'short' as const,
            day: 'numeric' as const
        },
        TIME_ONLY: {
            hour: '2-digit' as const,
            minute: '2-digit' as const,
            second: '2-digit' as const
        },
        FULL_DATE_TIME: {
            year: 'numeric' as const,
            month: 'short' as const,
            day: 'numeric' as const,
            hour: '2-digit' as const,
            minute: '2-digit' as const,
            second: '2-digit' as const
        },
        COMPACT_DATE_TIME: {
            month: 'short' as const,
            day: 'numeric' as const,
            hour: '2-digit' as const,
            minute: '2-digit' as const
        }
    }
} as const;

// Helper functions for common calculations
export const getPageSize = () => ADMIN_CONFIG.PAGE_SIZE;
export const getAutoRefreshSeconds = () => ADMIN_CONFIG.AUTO_REFRESH_SECONDS;

// Environment helpers
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';

// Date/time formatting utilities for consistent local time display
export const formatLocalDateTime = (dateString: string | Date, format: 'date' | 'time' | 'full' | 'compact' = 'full'): string => {
    if (!dateString) return 'N/A';

    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    // Check for invalid date
    if (isNaN(date.getTime())) return 'Invalid Date';

    const options = {
        'date': ADMIN_CONFIG.DATE_TIME_OPTIONS.DATE_ONLY,
        'time': ADMIN_CONFIG.DATE_TIME_OPTIONS.TIME_ONLY,
        'full': ADMIN_CONFIG.DATE_TIME_OPTIONS.FULL_DATE_TIME,
        'compact': ADMIN_CONFIG.DATE_TIME_OPTIONS.COMPACT_DATE_TIME
    }[format];

    return date.toLocaleString(undefined, options);
};

// Relative time helper (e.g., "2 minutes ago", "1 hour ago")
export const formatRelativeTime = (dateString: string | Date): string => {
    if (!dateString) return 'N/A';

    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Invalid Date';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return formatLocalDateTime(date, 'date');
}; 