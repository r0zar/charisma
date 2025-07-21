// Utility functions for swap logic
import { TokenCacheData } from '@/lib/contract-registry-adapter';

// Format numbers with k/M/B suffixes for compact display
export function formatCompactNumber(num: number): string {
    if (num === 0) return '0';
    if (num < 1000) {
        // Show up to 3 decimal places for small numbers
        return num < 0.001 ? '<0.001' : num.toFixed(3).replace(/\.?0+$/, '');
    }
    if (num < 1000000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    if (num < 1000000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
}

export function formatTokenAmount(amount: number, decimals: number): string {
    const balance = amount / Math.pow(10, decimals);

    // Use consistent formatting logic with balance feed
    if (balance === 0) return '0';
    if (balance < 0.001) {
        return balance.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 8)
        });
    } else if (balance < 1) {
        return balance.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 6)
        });
    } else {
        return balance.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 4)
        });
    }
}

// Helper function to format balance values consistently with the enhanced balance feed
export function formatBalanceDisplay(formattedBalance: number): string {
    if (formattedBalance === 0) return '0';
    if (formattedBalance >= 1000000) {
        return `${(formattedBalance / 1000000).toFixed(2)}M`;
    } else if (formattedBalance >= 1000) {
        return `${(formattedBalance / 1000).toFixed(2)}K`;
    } else if (formattedBalance >= 1) {
        return formattedBalance.toFixed(2);
    } else if (formattedBalance >= 0.000001) {
        return formattedBalance.toFixed(6);
    } else {
        return formattedBalance.toExponential(2);
    }
}

export function convertToMicroUnits(input: string, decimals: number): string {
    if (!input || input === '') return '0';
    try {
        const floatValue = parseFloat(input);
        if (isNaN(floatValue)) return '0';
        return Math.floor(floatValue * Math.pow(10, decimals)).toString();
    } catch {
        return '0';
    }
}

export function convertFromMicroUnits(microUnits: string, decimals: number): string {
    if (!microUnits || microUnits === '0') return '';
    return (parseFloat(microUnits) / Math.pow(10, decimals)).toLocaleString('en-US', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
    });
}

export function getTokenLogo(token: TokenCacheData): string {
    if (token.image) {
        return token.image;
    }

    const symbol = token.symbol?.toLowerCase() || '';

    if (symbol === "stx") {
        return "https://assets.coingecko.com/coins/images/2069/standard/Stacks_logo_full.png";
    } else if (symbol.includes("btc") || symbol.includes("xbtc")) {
        return "https://assets.coingecko.com/coins/images/1/standard/bitcoin.png";
    } else if (symbol.includes("usda")) {
        return "https://assets.coingecko.com/coins/images/17333/standard/usda.png";
    }

    // Default logo - first 2 characters of symbol
    return `https://placehold.co/32x32?text=${(token.symbol || "??").slice(0, 2)}`;
}

export function formatUsd(value: number | null): string | null {
    if (value === null || isNaN(value)) return null;
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
} 