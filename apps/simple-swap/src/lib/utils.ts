import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatPriceUSD = (price: number) => {
  if (price === undefined || price === null || isNaN(price)) return 'Price not available';

  // Smart dynamic precision
  if (price === 0) return '$0.00';
  if (price < 0.000001) {
    return `$${price.toExponential(2)}`; // scientific notation for tiny values
  } else if (price < 0.01) {
    return `$${price.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')}`; // up to 8 decimals, trim trailing zeros
  } else if (price < 1) {
    return `$${price.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`; // up to 6 decimals
  } else if (price < 1000) {
    return `$${price.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`; // up to 4 decimals
  } else {
    // For large prices, use commas and 2 decimals
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export const isDevelopment = process.env.NODE_ENV === "development"