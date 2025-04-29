import { createClient } from "@stacks/blockchain-api-client";

// Create the client instance
export const apiClient = createClient({
    headers: { 'x-api-key': process.env.HIRO_API_KEY }
});
