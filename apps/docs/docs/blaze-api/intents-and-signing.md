---
slug: intents-and-signing
sidebar_position: 5
title: Intents & Signing (SIP-018)
---

# Intents & Signing (SIP-018)

At the core of Blaze interactions is the concept of a user-signed "intent." An intent is a declaration of what a user wants to achieve, signed off-chain, and then submitted for potential execution.

Blaze leverages **SIP-018: Signed Structured Data** for creating these intents. This standard provides a way to hash and sign data structures that they can be verified by smart contracts.

## SIP-018 Primer

SIP-018 defines a standard way to prepare data for signing:

1.  **Domain Separation**: A `message-domain` tuple (containing `name`, `version`, `chain-id`) is defined and hashed. This ensures that a signature for one application or version cannot be misused in another.
2.  **Prefix**: A constant `structured-data-prefix` (0x534950303138) is used.
3.  **Structured Data Header**: The `structured-data-prefix` is concatenated with the hash of the `message-domain` to form a unique header for all messages within that domain.
4.  **Message Hashing**: The actual data tuple to be signed is converted to its consensus--buffered representation and then hashed (SHA256).
5.  **Final Hash**: The `structured-data-header` is concatenated with the message hash from step 4, and this final concatenation is hashed again (SHA256) to produce the 32-byte message hash that the user signs.

## Blaze `message-domain`

The `blaze-v1` contract defines its domain as:

```clarity
(define-constant message-domain {name: "BLAZE_PROTOCOL", version: "v1.0", chain-id: chain-id})
```

This results in a unique `message-domain-hash` and `structured-data-header` specific to the Blaze protocol.

## Constructing the Intent Hash in `blaze-v1`

The `blaze-v1` contract provides a `hash` read-only function to help construct the specific message hash that needs to be signed for a Blaze intent. This function takes the following parameters, which form the core data of a Blaze intent:

```clarity
(define-read-only (hash
    (contract principal)      ;; The subnet contract this intent is for
    (intent   (string-ascii 32)) ;; A string identifying the action within the subnet
    (opcode   (optional (buff 16))) ;; Optional: Further action specifier or parameters
    (amount   (optional uint))       ;; Optional: A uint amount relevant to the intent
    (target   (optional principal))  ;; Optional: A principal target relevant to the intent
    (uuid     (string-ascii 36))   ;; A unique ID to prevent replay attacks
  )
  (ok (sha256 (concat structured-data-header (sha256 
    (unwrap! (to-consensus-buff? {
      contract: contract, 
      intent: intent, 
      opcode: opcode, 
      amount: amount, 
      target: target, 
      uuid: uuid
    }) ERR_CONSENSUS_BUFF)
  ))))
)
```

**Parameters:**

*   `contract`: The principal of the **subnet contract** that will ultimately interpret and act upon this intent (e.g., the `charisma-token-subnet` address).
*   `intent`: An ASCII string (up to 32 chars) that names the specific action within the subnet contract (e.g., `"TRANSFER_TOKENS"`, `"REDEEM_BEARER"`).
*   `opcode`: An optional buffer (up to 16 bytes) that can provide additional context or parameters, specific to the `intent` type.
*   `amount`: An optional unsigned integer, typically representing a quantity (e.g., token amount).
*   `target`: An optional principal, often used as a recipient or other relevant address.
*   `uuid`: A mandatory Version 4 UUID (string, 36 chars) used for replay protection. This UUID is what `blaze-v1` records to ensure an intent isn't processed twice.

## Signing Process

1.  **Gather Intent Data**: The user or application assembles the `contract`, `intent` string, any optional `opcode`, `amount`, `target`, and a fresh `uuid`.
2.  **Compute the Hash**: These parameters are used to call the `blaze-v1.hash` function (or an equivalent off-chain implementation) to get the 32-byte message hash.
3.  **Sign the Hash**: The user signs this 32-byte hash using their private key (secp256k1 algorithm). This produces a 65-byte recoverable signature.

This signature, along with the original intent parameters (including the UUID), is then submitted to the Blaze API. 