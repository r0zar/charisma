/**
 * Utilities for parsing and validating Stacks wallet addresses
 */

export interface ParsedAddress {
  address: string;
  isValid: boolean;
  originalText: string;
}

export interface AddressParseResult {
  validAddresses: string[];
  invalidAddresses: string[];
  totalFound: number;
  duplicatesRemoved: number;
}

/**
 * Validates a Stacks address format
 * Valid formats: ST, SP, or SM followed by alphanumeric characters
 */
export function isValidStacksAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Remove whitespace and normalize
  const normalized = address.trim().toUpperCase();
  
  // Check format: ST, SP, or SM followed by alphanumeric characters (length should be around 41 total)
  const stacksAddressRegex = /^(ST|SP|SM)[A-Z0-9]{35,45}$/;
  
  return stacksAddressRegex.test(normalized);
}

/**
 * Normalizes a Stacks address to standard format
 */
export function normalizeStacksAddress(address: string): string {
  return address.trim().toUpperCase();
}

/**
 * Detects and splits text by various delimiters
 */
export function splitAddressText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  // Common delimiters: newlines, commas, semicolons, spaces, tabs
  const delimiters = /[\n\r,;|\s\t]+/g;
  
  return text
    .split(delimiters)
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);
}

/**
 * Removes duplicate addresses while preserving order
 */
export function removeDuplicateAddresses(addresses: string[]): { unique: string[], duplicatesCount: number } {
  const seen = new Set<string>();
  const unique: string[] = [];
  let duplicatesCount = 0;
  
  addresses.forEach(addr => {
    const normalized = normalizeStacksAddress(addr);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(normalized);
    } else {
      duplicatesCount++;
    }
  });
  
  return { unique, duplicatesCount };
}

/**
 * Main function to parse a text block into validated Stacks addresses
 */
export function parseAddressText(text: string): AddressParseResult {
  // Split text into potential addresses
  const rawAddresses = splitAddressText(text);
  
  // Remove duplicates
  const { unique: uniqueAddresses, duplicatesCount } = removeDuplicateAddresses(rawAddresses);
  
  // Validate each address
  const validAddresses: string[] = [];
  const invalidAddresses: string[] = [];
  
  uniqueAddresses.forEach(address => {
    if (isValidStacksAddress(address)) {
      validAddresses.push(normalizeStacksAddress(address));
    } else {
      invalidAddresses.push(address);
    }
  });
  
  return {
    validAddresses,
    invalidAddresses,
    totalFound: rawAddresses.length,
    duplicatesRemoved: duplicatesCount
  };
}

/**
 * Real-time parsing for preview while typing
 */
export function parseAddressTextPreview(text: string): ParsedAddress[] {
  const rawAddresses = splitAddressText(text);
  
  return rawAddresses.map(address => ({
    address: normalizeStacksAddress(address),
    isValid: isValidStacksAddress(address),
    originalText: address
  }));
}

/**
 * Smart detection of delimiter type used in text
 */
export function detectDelimiterType(text: string): string {
  if (!text || text.trim().length === 0) return 'none';
  
  const delimiters = {
    'newline': /\n|\r\n|\r/g,
    'comma': /,/g,
    'semicolon': /;/g,
    'space': / +/g,
    'tab': /\t/g,
    'pipe': /\|/g
  };
  
  let mostCommon = 'single-address';
  let maxCount = 0;
  
  Object.entries(delimiters).forEach(([name, regex]) => {
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    if (count > maxCount) {
      maxCount = count;
      mostCommon = name;
    }
  });
  
  return maxCount > 0 ? mostCommon : 'single-address';
}

/**
 * Generate examples for different delimiter formats
 */
export function getExampleFormats(): { [key: string]: string } {
  const sampleAddresses = [
    'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
    'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ'
  ];
  
  return {
    'Comma-separated': sampleAddresses.join(', '),
    'One per line': sampleAddresses.join('\n'),
    'Space-separated': sampleAddresses.join(' '),
    'Mixed format': `${sampleAddresses[0]}, ${sampleAddresses[1]}\n${sampleAddresses[2]}`
  };
}