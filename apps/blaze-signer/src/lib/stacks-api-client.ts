import { createClient } from "@stacks/blockchain-api-client";

// --- Stacks API Client Setup ---
// Use default Hiro mainnet API URL (or use process.env.STACKS_API_URL)
const STACKS_API_BASE_PATH = process.env.STACKS_API_URL || "https://api.hiro.so";

// Create the client instance
export const apiClient = createClient({ baseUrl: STACKS_API_BASE_PATH });

// Use HIRO_API_KEY from environment variables if available
const apiKey = process.env.HIRO_API_KEY;
if (apiKey) {
    console.log("Using HIRO_API_KEY for Stacks API client.");
    apiClient.use({
        onRequest({ request }) {
            request.headers.set('x-api-key', apiKey);
        }
    });
} else {
    console.log("HIRO_API_KEY not found, Stacks API client using public rates.");
}
// --- End Stacks API Client Setup --- 