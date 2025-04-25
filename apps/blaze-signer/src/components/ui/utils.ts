import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * A utility to combine and merge Tailwind CSS classes
 * It handles merging/deduping conflicting classes
 *
 * @example
 * ```tsx
 * // Basic usage:
 * <div className={cn("bg-red-500", className)}>
 * 
 * // Conditional classes:
 * <button className={cn("bg-blue-500", { "opacity-50": disabled })}>
 * ```
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
} 