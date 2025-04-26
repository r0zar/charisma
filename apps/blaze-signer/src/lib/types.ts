// Shared types for the application

// Interface for data stored in the queue
export interface QueuedTxIntent {
    signature: string;        // hex string (65 bytes)
    contractId: string;       // Full contract ID (e.g., SP...ADDR.contract-name)
    intent: string;           // The intent string (e.g., "TRANSFER_TOKENS")
    opcodeOptional?: string | null; // Optional hex buffer string (max 16 bytes)
    amountOptional?: number | null; // Optional uint
    targetOptional?: string | null; // Optional principal string (recipient)
    uuid: string;               // string-ascii (max 36 chars)
}

// Original request body interface (can also live here)
export interface ExecuteRequest {
    messageType: "TRANSFER_TOKENS" | "TRANSFER_TOKENS_LTE" | "REDEEM_BEARER";
    contractId: string; // e.g., SP...ADDR.contract-name
    signature: string;
    amount?: number;
    bound?: number;
    uuid: string;
    recipient?: string;
} 