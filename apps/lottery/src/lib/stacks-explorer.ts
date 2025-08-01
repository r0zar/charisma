/**
 * Utility functions for Stacks blockchain explorer links
 */

// Use mainnet by default, but allow environment override
const isMainnet = process.env.NEXT_PUBLIC_STACKS_NETWORK !== 'testnet'

/**
 * Get the base URL for the Stacks explorer based on network
 */
export function getStacksExplorerBaseUrl(): string {
  return isMainnet 
    ? 'https://explorer.stacks.co' 
    : 'https://explorer.stacks.co/?chain=testnet'
}

/**
 * Generate a transaction link for the Stacks explorer
 * @param txId - The transaction ID (with or without 0x prefix)
 * @returns Full URL to view the transaction
 */
export function getTransactionUrl(txId: string): string {
  // Remove 0x prefix if present
  const cleanTxId = txId.startsWith('0x') ? txId.slice(2) : txId
  const baseUrl = getStacksExplorerBaseUrl()
  
  if (isMainnet) {
    return `${baseUrl}/txid/0x${cleanTxId}`
  } else {
    return `${baseUrl}&txid=0x${cleanTxId}`
  }
}

/**
 * Generate an address link for the Stacks explorer
 * @param address - The Stacks address
 * @returns Full URL to view the address
 */
export function getAddressUrl(address: string): string {
  const baseUrl = getStacksExplorerBaseUrl()
  
  if (isMainnet) {
    return `${baseUrl}/address/${address}`
  } else {
    return `${baseUrl}&address=${address}`
  }
}

/**
 * Format a transaction ID for display (shortened version)
 * @param txId - The full transaction ID
 * @param length - Number of characters to show from start and end (default: 6)
 * @returns Formatted transaction ID like "0x123abc...def789"
 */
export function formatTransactionId(txId: string, length: number = 6): string {
  if (!txId) return ''
  
  // Ensure it has 0x prefix for display
  const prefixedTxId = txId.startsWith('0x') ? txId : `0x${txId}`
  
  if (prefixedTxId.length <= (length * 2) + 5) {
    return prefixedTxId // Short enough to show in full
  }
  
  return `${prefixedTxId.slice(0, length + 2)}...${prefixedTxId.slice(-length)}`
}

/**
 * Check if a transaction ID is valid format
 * @param txId - The transaction ID to validate
 * @returns True if valid hexadecimal transaction ID
 */
export function isValidTransactionId(txId: string): boolean {
  if (!txId) return false
  
  // Remove 0x prefix if present
  const cleanTxId = txId.startsWith('0x') ? txId.slice(2) : txId
  
  // Should be 64 characters of valid hex
  return /^[0-9a-fA-F]{64}$/.test(cleanTxId)
}