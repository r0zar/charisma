/**
 * Utility functions for address and transaction ID formatting
 */

/**
 * Truncates an address to show first 6 and last 4 characters
 * @param address The address or transaction ID to truncate
 * @returns Truncated string in format: "ABC123...XYZ9"
 */
export function truncateAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Truncates a transaction ID to show first 6 and last 4 characters
 * Alias for truncateAddress for semantic clarity
 */
export const truncateTxId = truncateAddress;

/**
 * Truncates a contract ID to show first 6 and last 4 characters
 * Alias for truncateAddress for semantic clarity
 */
export const truncateContractId = truncateAddress;