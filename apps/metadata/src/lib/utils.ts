import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TokenMetadata } from './metadata-service';

/**
 * Combines class names using clsx and tailwind-merge
 * This is a commonly used utility in React projects
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function isLPToken(token: TokenMetadata | undefined | null): boolean {
    if (!token || !token.properties) {
        return false;
    }
    const { properties } = token;
    return (
        typeof properties.tokenAContract === 'string' &&
        typeof properties.tokenBContract === 'string' &&
        typeof properties.swapFeePercent === 'number'
    );
} 