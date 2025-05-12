---
slug: execute
sidebar_position: 101
title: POST /execute
---

# POST `/execute`

Submit a signed **intent for an operation on a Blaze-compatible subnet contract**. The Blaze signer network will then attempt to construct and broadcast the corresponding Clarity transaction.

This endpoint is used for generic subnet interactions, such as token transfers, redemptions, or other custom actions defined by a specific Blaze-enabled subnet contract (e.g., `charisma-token-subnet`). The exact on-chain function called depends on the `intent` string provided in the request.

## Request Body (`intent.json`)

The request body should be a JSON object containing the details of the signed intent:

```json
{
  "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet",
  "intent": "TRANSFER_TOKENS", // e.g., "TRANSFER_TOKENS", "REDEEM_BEARER", etc.
  "signature": "0x...",        // 65-byte compressed signature (hex) of the SIP-018 structured data hash
  "uuid": "123e4567-e89b-12d3-a456-426614174000", // Unique identifier for the intent
  "amountOptional": 1000000,   // (Optional) uint, e.g., amount for transfer/redeem
  "targetOptional": "SP3FBR2...ZY6", // (Optional) principal, e.g., recipient for transfer
  "opcodeOptional": null,      // (Optional) buffer, for more complex intents
  "network": "mainnet"         // (Optional) "mainnet" or "testnet", defaults to mainnet
}
```

**Fields:**

*   `contractId` (string, required): The full principal of the target Blaze-compatible subnet contract (e.g., `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet`).
*   `intent` (string, required): An ASCII string (max 32 chars) identifying the specific action to be performed on the `contractId`. This dictates which on-chain function the signer will attempt to call (e.g., `x-transfer`, `x-redeem`).
*   `signature` (string, required): The 65-byte recoverable secp256k1 signature, in hexadecimal format, of the SIP-018 compliant hash of the intent data.
*   `uuid` (string, required): A Version 4 UUID (36 characters) to ensure replay protection for this specific intent.
*   `amountOptional` (number | null, optional): An optional unsigned integer. Its meaning depends on the `intent`. For `TRANSFER_TOKENS` or `REDEEM_BEARER`, this is the token amount.
*   `targetOptional` (string | null, optional): An optional Stacks principal. Its meaning depends on the `intent`. For `TRANSFER_TOKENS`, this is the recipient.
*   `opcodeOptional` (string | null, optional): An optional hex-encoded buffer. Used for more complex intents requiring additional specific data.
*   `network` (string, optional): Specifies the Stacks network, either `"mainnet"` or `"testnet"`. Defaults to `"mainnet"` if omitted.

_The exact structure of the signed data (which includes `contractId` as the `contract` field in the SIP-018 hash, `intent`, `uuid`, and the optional parameters) must match what the `blaze-v1` verifier and the target subnet contract expect. Refer to the "Intents & Signing (SIP-018)" and specific subnet documentation for details._

### Example: Intent for Token Transfer (cURL)

This example shows submitting an intent to transfer tokens using a hypothetical `charisma-token-subnet`.

```bash
curl -X POST https://blaze.charisma.rocks/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet",
    "intent": "TRANSFER_TOKENS",
    "signature": "0x7d1e9...",
    "uuid": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "amountOptional": 500000000, 
    "targetOptional": "SP3G3000...K8G",
    "network": "mainnet"
  }'
```

## Successful Response

If the intent is successfully queued for processing by the Blaze signers:

```json
{
  "success": true,
  "message": "Transaction intent queued successfully.",
  "uuid": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
}
```

*(Note: Successful queueing does not guarantee successful on-chain execution. The Blaze signers will attempt to process the transaction, which may still fail due to on-chain conditions, invalid signature for the reconstructed hash, or other errors during Clarity execution.)*

## Error Response (Client-Side Validation)

```json
{
  "success": false,
  "error": "Invalid request body: Missing required field signature."
}
```