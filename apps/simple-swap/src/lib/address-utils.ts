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

/**
 * Truncates a smart contract address while preserving the contract name
 * For addresses like "SP1234...ABC.contract-name", keeps the full contract name
 * and truncates only the address portion in the middle
 * @param contractAddress The contract address to truncate
 * @returns Truncated string preserving the contract name
 */
export function truncateSmartContract(contractAddress: string): string {
    if (contractAddress.length <= 20) return contractAddress;
    
    // Check if it's a contract address with a dot (e.g., "SP1234567890.contract-name")
    const dotIndex = contractAddress.lastIndexOf('.');
    if (dotIndex > 0) {
        const addressPart = contractAddress.substring(0, dotIndex);
        const contractName = contractAddress.substring(dotIndex); // includes the dot
        
        // Only truncate the address part if it's long enough
        if (addressPart.length > 10) {
            const truncatedAddress = `${addressPart.substring(0, 6)}...${addressPart.substring(addressPart.length - 4)}`;
            return `${truncatedAddress}${contractName}`;
        }
        return contractAddress; // Keep as-is if address part is short
    }
    
    // Fallback to regular address truncation for non-contract addresses
    return truncateAddress(contractAddress);
}