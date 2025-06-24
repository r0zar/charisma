import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts IPFS hash to full IPFS gateway URL
 * @param ipfsHash - IPFS hash like "QmRaKvxkd2GHieKjd7GtWhgtAftQwsfZC2hWvzFCixRpSb/01.jpeg"
 * @param gateway - IPFS gateway URL (defaults to ipfs.io)
 * @returns Full IPFS URL
 */
export function getIpfsUrl(ipfsHash: string, gateway: string = 'https://ipfs.io/ipfs'): string {
  if (!ipfsHash) return '';
  
  // If it's already a full URL, return as-is
  if (ipfsHash.startsWith('http')) {
    return ipfsHash;
  }
  
  // Remove "ipfs://" prefix if present
  const cleanHash = ipfsHash.replace(/^ipfs:\/\//, '');
  
  return `${gateway}/${cleanHash}`;
}

export const formatPriceUSD = (price: number) => {
  if (price === undefined || price === null || isNaN(price) || !isFinite(price)) {
    return 'Price not available';
  }

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

/**
 * Helper function to check if a price object has a valid price value
 * @param price - The price object from Blaze context
 * @returns true if price exists and has a valid price value
 */
export const hasValidPrice = (price: { price: number } | undefined): price is { price: number } => {
  return !!(price && price.price !== undefined && price.price !== null && !isNaN(price.price) && isFinite(price.price));
}

export const isDevelopment = process.env.NODE_ENV === "development"