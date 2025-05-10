---
slug: security-token-flow
sidebar_position: 9
title: Security & Token Flow
---

# Security Considerations & Token Flow with Blaze

Understanding how tokens move and what security guarantees Blaze offers is crucial for both users and developers. The system is designed to be non-custodial for users until the very moment an authorized operation is executed, and its security hinges on the `blaze-v1` verifier contract and the careful design of Subnet and Strategy contracts.

## 1. The Role of Subnet Token Contracts

*   **Gateway to Blaze**: Standard SIP-010 tokens (or other assets) are not directly manipulated by most Blaze intents. Instead, users first "wrap" or "deposit" their assets into a Blaze-compatible **Subnet Token contract** (e.g., `charisma-token-subnet` for `charisma-token`).
*   **Internal Balance Tracking**: This Subnet Token contract then manages the user's balance of that specific asset *within the Blaze ecosystem*. All Blaze-related operations for that token occur against this internal subnet balance.
*   **Example**: If a user has 1000 CHA (SIP-010) and deposits 200 into `charisma-token-subnet`, they now have 800 CHA (SIP-010) in their main wallet and a balance of 200 CHA within the `charisma-token-subnet` that can be used with Blaze intents.

## 2. Scope and Power of Signed Intents

*   **Subnet-Specific Authorization**: A signed intent is tied to a specific `contract` principal as part of its SIP-018 structured data. When `blaze-v1.execute` is called by a Subnet Token contract (e.g., `charisma-token-subnet`), the `contract-caller` (the Subnet Token contract itself) is used as the `contract` parameter for hash reconstruction. This means a signed intent for `charisma-token-subnet` can *only* authorize actions related to the user's balance *within* `charisma-token-subnet`.
*   **No Access to External Balances**: A signed intent for `charisma-token-subnet` cannot directly access or authorize the movement of the user's raw SIP-010 CHA tokens held outside the subnet, nor can it affect their balances in a different subnet (e.g., `usdc-subnet`), unless the user explicitly signs separate intents for those other contracts/subnets.
*   **Intent Parameters Define Action**: The `intent` string (e.g., "TRANSFER_TOKENS"), `amount`, `target`, and `opcode` within the signed data further specify what the user is authorizing *within that specific subnet contract*.

## 3. Non-Custodial Before Execution

*   **Tokens Remain in User's Subnet Balance**: When a user signs an intent (or multiple intents for a strategy), their tokens do not immediately move. The tokens remain credited to their principal within the respective Subnet Token contract.
*   **Example - DCA**: For a 12-month DCA strategy, the user signs 12 intents. Their total USDC for the DCA remains in their `usdc-subnet` balance. Only when the first month's intent is processed by a solver and a Strategy Contract does that *one month's portion* of USDC get transferred out of their `usdc-subnet` balance.

## 4. Just-in-Time Custody by Strategy Contracts

*   **Momentary Custody for Operations**: When a Blaze Solver submits a user's signed intent to a Strategy Contract (e.g., a Multi-Hop Router or a DCA contract):
    1.  The Strategy Contract typically first calls the relevant Subnet Token contract's `x-transfer` (or similar) function, using the provided signature and intent parameters.
    2.  The Subnet Token contract calls `blaze-v1.execute` for verification.
    3.  If valid, `blaze-v1` confirms the signer, and the Subnet Token contract transfers the *specified amount for that single operation* from the user's subnet balance to the Strategy Contract.
    4.  The Strategy Contract now momentarily holds these specific funds `(as-contract tx-sender)` and immediately uses them to perform its defined logic (e.g., execute a swap, call another protocol).
*   **Minimizing Exposure**: This "just-in-time" transfer minimizes the duration and amount of funds held directly by any single Strategy Contract. The Strategy Contract only has access to what's needed for the currently authorized operation.

## 5. Solver & Intent Management Considerations

*   **Solvers are Off-Chain**: Blaze Solvers operate off-chain. They are responsible for picking up signed intents, constructing transactions, and submitting them. The security of the on-chain execution is guaranteed by `blaze-v1` and the subnet/strategy contract logic.
*   **Trust in Solver for Execution**: Users rely on solvers (or platforms offering solver services) to:
    *   Submit their intents according to agreed-upon conditions (e.g., timing, price triggers).
    *   Not censor or indefinitely withhold their intents (though a user can always perform actions directly if the subnet allows, or use a different solver).
    *   Securely manage the pre-signed intents if they are submitted in advance (as intents are bearer instruments).
*   **Parameterization Power**: As solvers construct the final transaction, they can parameterize any part of it *not* covered by the signed SIP-018 hash. This is a powerful feature for oracle integration and dynamic responses but also means the design of Strategy Contracts should be clear about what parameters are fixed by user signature versus what can be influenced by the solver.

## 6. UUID Replay Protection

*   **Core `blaze-v1` Feature**: The `blaze-v1` contract's use of a `submitted-uuids` map ensures that any given signed intent (identified by its unique UUID) can only be successfully executed once. This prevents malicious replay of the same authorization.

By understanding these layers—Subnet Token wrappers for initial asset management, precisely scoped signed intents for authorization, just-in-time custody by Strategy Contracts, and the role of off-chain solvers—developers and users can confidently engage with the Blaze ecosystem. 