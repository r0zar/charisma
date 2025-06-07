// Utility functions for swap logic
import { TokenCacheData } from '@repo/tokens';

export function formatTokenAmount(amount: number, decimals: number): string {
    const balance = amount / Math.pow(10, decimals);

    if (balance === 0) return '0';
    if (balance < 0.001) {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 10)
        });
    } else if (balance < 1) {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 6)
        });
    } else {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 4)
        });
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
    return (parseFloat(microUnits) / Math.pow(10, decimals)).toLocaleString(undefined, {
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