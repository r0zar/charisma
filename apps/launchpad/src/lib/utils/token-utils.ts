/**
 * Generates a Clarity-safe contract name from a token name.
 * Converts to lowercase, replaces spaces with hyphens, removes special characters,
 * and prepends 'token-' if the name starts with a number.
 * @param name - The token name.
 * @returns A valid Clarity contract name string.
 */
export const generateContractNameFromTokenName = (name: string): string => {
    if (!name) return '';
    // Convert to lowercase, replace spaces with hyphens, and remove special characters
    return name.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        // If it starts with a number, prepend 'token-'
        .replace(/^(\d)/, 'token-$1');
};

/**
 * Calculates the actual atomic unit supply based on user input and decimals.
 * @param supplyString - The initial supply string entered by the user.
 * @param decimalsString - The decimals string entered by the user.
 * @returns A formatted string representing the total atomic units, or "0".
 */
export const calculateAtomicSupply = (supplyString: string, decimalsString: string): string => {
    if (!supplyString || !decimalsString) return "0";
    try {
        const supply = parseFloat(supplyString);
        const dec = parseInt(decimalsString);
        if (isNaN(supply) || isNaN(dec) || supply <= 0 || dec < 0) return "0";

        // Format with commas for thousands and limit decimal places
        return (supply * Math.pow(10, dec)).toLocaleString(undefined, {
            maximumFractionDigits: 0,
        });
    } catch (e) {
        return "0";
    }
};

/**
 * Truncates a Stacks address for display.
 * Keeps the beginning and end characters, replacing the middle with "...".
 * @param address - The Stacks address string.
 * @param startLength - Number of characters to keep at the start (default: 6).
 * @param endLength - Number of characters to keep at the end (default: 4).
 * @returns The truncated address string, or the original if too short, or 'N/A' if invalid input.
 */
export const truncateAddress = (address: string | null | undefined, startLength: number = 6, endLength: number = 4): string => {
    if (!address) {
        return 'N/A'; // Handle null or undefined input
    }
    if (address.length <= startLength + endLength + 3) {
        return address; // No need to truncate if it's short
    }
    const start = address.substring(0, startLength);
    const end = address.substring(address.length - endLength);
    return `${start}...${end}`;
}; 