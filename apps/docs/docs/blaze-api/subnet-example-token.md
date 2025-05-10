---
slug: subnet-example-token
sidebar_position: 7
title: Subnet Example (Token)
---

# Subnet Example: Intent-Based Token (`charisma-token-subnet`)

This page demonstrates how a specific application, in this case a token contract (`charisma-token-subnet`), can integrate with `blaze-v1` to enable powerful, intent-based operations for its users.

The `charisma-token-subnet` contract acts as a wrapper around a standard SIP-010 token (`SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token`). It maintains its own ledger of balances for users who have deposited the underlying token into this subnet.

Its key innovation lies in exposing public functions that are gated by a successful call to `blaze-v1.execute`, allowing users to authorize actions like transfers via off-chain signed messages.

## Key Intent-Based Functions

Let's examine some of the `x-` prefixed functions in `charisma-token-subnet`:

### 1. `x-redeem` (Bearer Redemption)

```clarity
(define-public (x-redeem
    (signature (buff 65))
    (amount    uint)
    (uuid      (string-ascii 36))
    (to        principal))
  (let ((signer (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1 execute 
                               signature 
                               "REDEEM_BEARER" ;; intent string
                               none            ;; opcode
                               (some amount)   ;; amount
                               none            ;; target
                               uuid))))
    (try! (internal-transfer signer to amount))
    (print {event: "x-redeem", from: signer, to: to, amount: amount, uuid: uuid})
    (ok true)))
```

*   **Purpose**: Allows someone holding a signed intent from `signer` to redeem `amount` of tokens from `signer`'s balance within the subnet and send them to `to`.
*   **Blaze Integration**:
    *   It calls `blaze-v1.execute` with:
        *   `signature`: The user's provided signature.
        *   `intent`: The string `"REDEEM_BEARER"`.
        *   `opcode`: `none`.
        *   `amount`: `(some amount)` from the function arguments.
        *   `target`: `none`.
        *   `uuid`: The user's provided UUID.
    *   If `blaze-v1.execute` is successful, it returns `(ok signer_principal)`. This `signer` is the Stacks address that originally signed the intent to redeem these tokens.
*   **Logic**: The contract then performs an `internal-transfer` from the recovered `signer` to the specified `to` address.
*   **Use Case**: This enables "bearer intents." The original signer creates an intent to release a certain amount of tokens. Anyone who possesses this signed intent can submit it to the `x-redeem` function to claim the tokens. The `to` address is specified at redemption time.

### 2. `x-transfer` (Exact Transfer)

```clarity
(define-public (x-transfer
    (signature (buff 65))
    (amount uint)
    (uuid   (string-ascii 36))
    (to     principal))
  (let ((signer (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1 execute 
                               signature 
                               "TRANSFER_TOKENS" ;; intent string
                               none              ;; opcode
                               (some amount)     ;; amount
                               (some to)         ;; target
                               uuid))))
    (try! (internal-transfer signer to amount))
    (print {event: "x-transfer", from: signer, to: to, amount: amount, uuid: uuid})
    (ok true)))
```

*   **Purpose**: Allows a `signer` to authorize a transfer of an exact `amount` of tokens to a specific `to` address.
*   **Blaze Integration**:
    *   Calls `blaze-v1.execute` with `intent: "TRANSFER_TOKENS"`, `amount: (some amount)`, and `target: (some to)`.
    *   The `to` address is part of the signed message structure here.
*   **Logic**: Transfers `amount` from `signer` to `to`.
*   **Use Case**: Standard token transfer authorized by an off-chain signature. The recipient is fixed in the signed intent.

### 3. `x-transfer-lte` (Upper-Bound Transfer)

```clarity
(define-public (x-transfer-lte
    (signature (buff 65))
    (bound   uint)             ;; Max amount signer is willing to send
    (actual  uint)             ;; Actual amount to send (must be <= bound)
    (uuid    (string-ascii 36))
    (to      principal))
  (let ((signer (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1 execute 
                               signature 
                               "TRANSFER_TOKENS_LTE" ;; intent string
                               none                  ;; opcode
                               (some bound)          ;; amount (this is the bound)
                               (some to)             ;; target
                               uuid))))
    (asserts! (<= actual bound) ERR_EXCEEDS_BOUND)
    (try! (internal-transfer signer to actual))
    (print {event: "x-transfer-lte", from: signer, to: to, bound: bound, amount: actual, uuid: uuid})
    (ok true)))
```

*   **Purpose**: Allows a `signer` to authorize a transfer of *up to* `bound` tokens to `to`, with the `actual` amount being specified at the time of execution.
*   **Blaze Integration**:
    *   Calls `blaze-v1.execute` with `intent: "TRANSFER_TOKENS_LTE"`.
    *   Crucially, the `amount` parameter passed to `blaze-v1` is the `bound`.
*   **Logic**: 
    *   It first asserts that `actual <= bound`. 
    *   Then, it transfers the `actual` amount from `signer` to `to`.
*   **Use Case**: Useful for scenarios where the exact amount isn't known at the time of signing but an upper limit can be set. For example, paying for a service where the final cost might vary slightly, but the user wants to cap their maximum exposure.

## Summary

The `charisma-token-subnet` contract effectively uses `blaze-v1` as a generic authenticator. By defining different `intent` strings and carefully structuring the data passed to `blaze-v1.execute` (which then becomes part of the signed message), it can support various types of operations, all authorized by a single, standard mechanism of off-chain signing and on-chain verification.

This pattern can be extended to many other applications beyond tokens, such as NFT marketplaces, voting systems, or other DeFi primitives. 