---
slug: architecture
sidebar_position: 4
title: System Architecture
---

# Blaze System Architecture

Blaze is an intent-centric protocol designed to facilitate secure and flexible interactions with the Stacks blockchain. It combines off-chain message creation and solving with on-chain verification and execution.

## Core Components

1.  **User Intents**: Users (or applications on their behalf) create and sign "intents." An intent is a structured message (conforming to SIP-018) that declares a desired action (e.g., "transfer X tokens to Y address") without specifying the exact blockchain transaction details.

2.  **Blaze API & Solvers (Off-Chain)**: Signed intents are submitted to the Blaze API. Off-chain "solvers" (which can be operated by Charisma or third parties) receive these intents. Solvers are responsible for:
    *   Validating the intent against current market conditions or application state (e.g., checking if a swap is feasible).
    *   Constructing the necessary Clarity transaction(s) to fulfill the intent.
    *   Submitting the transaction to the Stacks network.

3.  **`blaze-v1` Contract (On-Chain Verifier)**: This is the cornerstone of the Blaze protocol on-chain. Its primary responsibilities are:
    *   **Signature Verification**: Ensuring that the intent embedded in a transaction was genuinely signed by the claimed author (using `secp256k1-recover?`).
    *   **Replay Protection**: Preventing the same signed intent (identified by a unique UUID) from being processed multiple times using the `submitted-uuids` map.
    *   Exposing the recovered signer's principal to the calling contract.

4.  **Subnet Contracts (On-Chain Application Logic)**: These are specific smart contracts that define the actual operations to be performed based on a verified intent. Examples include:
    *   Token contracts (like `charisma-token-subnet`) that handle intent-based transfers or redemptions.
    *   NFT marketplaces enabling signed bids or listings.
    *   DeFi protocols allowing complex interactions via signed intents.
    Subnet contracts call `blaze-v1` to verify the signature and intent details before executing their specific logic.

## Typical Flow

1.  **Intent Creation & Signing**: A user, via a wallet or application, generates a structured data message representing their intent (e.g., transfer 100 CHA tokens to Bob, identified by UUID `abc-123`). They sign this message with their private key.

2.  **Intent Submission**: The signed intent (message + signature + UUID) is submitted to a Blaze API endpoint (e.g., `/execute` or `/multihop/execute`).

3.  **Solving & Transaction Construction**: A Blaze solver picks up the intent. It might check oracle prices, liquidity, etc. If valid, it constructs a Clarity transaction. This transaction will typically call a function on a specific subnet contract, passing the original signed intent parameters (signature, intent details, UUID).

4.  **On-Chain Verification & Execution**:
    *   The subnet contract receives the call.
    *   It immediately calls the `blaze-v1.execute` function, passing the signature, intent parameters, and UUID.
    *   `blaze-v1` attempts to verify the signature against the reconstructed intent hash. It also checks if the UUID has already been submitted.
    *   If verification succeeds and the UUID is new, `blaze-v1` returns the principal of the original signer to the subnet contract.
    *   The subnet contract, now confident of the intent's authenticity and the signer's identity, proceeds with its own logic (e.g., updating token balances for a transfer).

This decoupled architecture allows for flexibility in how intents are processed off-chain while maintaining strong on-chain security and verifiability through the `blaze-v1` contract. 