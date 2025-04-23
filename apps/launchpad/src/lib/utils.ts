import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge
 * This is a commonly used utility in React projects
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const truncateAddress = (address: string) => {
    if (!address) return '';
    const start = address.slice(0, 6);
    const end = address.slice(-4);
    return `${start}...${end}`;
};