/**
 * Utility functions for formatting and converting values
 */

/**
 * Helper to convert string boolean to actual boolean
 */
export function stringToBoolean(value: string): boolean {
  return value === 'true';
}

/**
 * Helper to convert string number to actual number
 */
export function stringToNumber(value: string, fallback: number = 0): number {
  const parsed = parseInt(value);
  return isNaN(parsed) ? fallback : parsed;
}

// Currency formatting
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  if (amount === 0) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'USD', // Default to USD for display
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Relative time formatting
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = date.getTime() - now.getTime();
  const absDiffInMs = Math.abs(diffInMs);
  const diffInMinutes = Math.floor(absDiffInMs / (1000 * 60));
  const diffInHours = Math.floor(absDiffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(absDiffInMs / (1000 * 60 * 60 * 24));

  // Handle future dates (positive diffInMs)
  if (diffInMs > 0) {
    if (diffInMinutes < 1) return 'Very soon';
    if (diffInMinutes < 60) return `In ${diffInMinutes}m`;
    if (diffInHours < 24) return `In ${diffInHours}h`;
    if (diffInDays < 7) return `In ${diffInDays}d`;
    return `On ${date.toLocaleDateString()}`;
  }

  // Handle past dates (negative diffInMs)
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString();
}

// Address truncation
export function truncateAddress(address: string, length: number = 6): string {
  if (!address) return '';
  if (address.length <= length * 2) return address;

  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

// Number formatting
export function formatNumber(num: number, decimals: number = 2): string {
  if (num === 0) return '0';

  const absNum = Math.abs(num);

  if (absNum >= 1000000) {
    return `${(num / 1000000).toFixed(decimals)}M`;
  }
  if (absNum >= 1000) {
    return `${(num / 1000).toFixed(decimals)}K`;
  }

  return num.toFixed(decimals);
}

// Percentage formatting
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}