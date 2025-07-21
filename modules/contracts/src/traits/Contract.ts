/**
 * Base Contract interface that all contract interfaces should extend
 * Provides common properties and methods for all contract types
 */

export interface Contract {
  /**
   * The fully qualified contract identifier (e.g., "SP1234...ABCD.my-contract")
   */
  readonly contractId: string;

  /**
   * Optional contract name (derived from contractId)
   */
  readonly contractName?: string;

  /**
   * Optional contract address (derived from contractId)
   */
  readonly contractAddress?: string;

  /**
   * Get the contract name from the contract ID
   */
  getContractName(): string;

  /**
   * Get the contract address from the contract ID
   */
  getContractAddress(): string;

  /**
   * Check if this contract is valid (has proper format)
   */
  isValid(): boolean;
}