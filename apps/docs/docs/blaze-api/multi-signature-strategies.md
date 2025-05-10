---
slug: multi-signature-strategies
sidebar_position: 11
title: Multi-Signature & Composable Strategies
---

# Multi-Signature & Composable Strategies with Blaze

Blaze's intent-based system unlocks highly sophisticated DeFi strategies that require coordinated actions from multiple parties or involve multiple distinct asset movements authorized by different signed intents. These "Multi-Signature Intent Strategies" use a central Strategy Contract to orchestrate complex financial operations, with each constituent step or contribution powered by a Blaze-verified intent.

## The Core Concept: Coordinated Intent Execution

Imagine a scenario where a single desired financial outcome requires multiple inputs or authorizations. For example:

*   Alice wants to provide Token X and Bob wants to provide Token Y to form an LP position.
*   A user wants to use Token A from their `token-a-subnet` and Token B from their `token-b-subnet` as collateral for a loan.

A **Multi-Signature Strategy Contract** acts as the on-chain coordinator for such operations. It defines the overall goal and the individual contributions (intents) required. Each participant signs their respective Blaze intent(s) for their part of the deal.

**Key Characteristics:**

*   **Multiple, Independent Intents**: Each required asset movement or authorization is a separate Blaze intent, signed by the relevant party (or by the same party for different assets/subnets).
*   **Strategy Contract as Aggregator**: The Strategy Contract is designed to receive and verify these multiple intents sequentially (or in a specific order).
*   **Composable Execution**: Once all necessary intents are successfully processed and the corresponding assets are secured by (or authorized for) the Strategy Contract, it then executes the final, combined financial operation.

## Mechanics of Multi-Signature Strategies

1.  **Strategy Definition**: A smart contract (the "Strategy Contract") is deployed, outlining a multi-step or multi-party operation and the specific Blaze intents it expects as inputs (e.g., intent to transfer Token X from User A, intent to transfer Token Y from User B).

2.  **Individual Intent Creation & Signing**: Each participant creates and signs their Blaze intent(s):
    *   User A signs: "Intent to transfer 100 TokenX from my `token-x-subnet` balance to StrategyContract (UUID: ax123)".
    *   User B signs: "Intent to transfer 50 TokenY from my `token-y-subnet` balance to StrategyContract (UUID: by456)".

3.  **Intent Submission & Orchestration**: The signed intents are submitted to a Blaze Solver or an interface that communicates with the Strategy Contract. The solver (or the Strategy Contract's public functions) will handle the processing of these intents.

4.  **Sequential Verification & Asset Aggregation**: The Strategy Contract processes each intent:
    *   It takes User A's signed intent and calls `token-x-subnet.x-transfer(...)`, which validates the intent via `blaze-v1` and transfers Token X into the Strategy Contract.
    *   It then takes User B's signed intent and calls `token-y-subnet.x-transfer(...)`, similarly transferring Token Y into the Strategy Contract.
    *   The Strategy Contract may need internal state management to track which intents have been received and verified.

5.  **Execution of the Combined Operation**: Once all prerequisite intents are fulfilled and assets are pooled within (or spendable by) the Strategy Contract, it triggers the main financial logic. For example, it calls `amm-pool.add-liquidity(tokenX_amount, tokenY_amount)`.

6.  **Handling Partial Completions & Failures (Important Consideration)**:
    *   Strategy contracts must carefully consider what happens if only some of the required intents are submitted or if one fails verification. Options include:
        *   Time-locks: All intents must arrive within a certain window.
        *   Refund mechanisms: If the full operation cannot proceed, return already-collected assets to their original signers.
        *   State tracking to allow resumption if possible.
    *   Achieving true atomicity (all-or-nothing across multiple independent user intents) can be complex on-chain and often relies on well-designed commit/reveal schemes or escrow patterns within the Strategy Contract.

## Example Use Cases

*   **Decentralized Liquidity Provisioning (Multi-Party)**:
    *   Multiple users contribute different assets to an "LP Formation" Strategy Contract. Each user signs an intent for their specific token deposit. Once all components are funded, the contract creates the LP position and distributes LP tokens proportionally.

*   **Multi-Asset Collateralization**: 
    *   A user wishes to borrow against a diverse basket of assets (e.g., Token A from `subnet-A`, Token B from `subnet-B`).
    *   They sign an intent for each asset transfer to a "Multi-Collateral Loan" Strategy Contract. Once all collateral is received and verified, the contract allows the user to mint/borrow the debt asset.

*   **Coordinated DAO Actions / Group Investments**: 
    *   DAO members vote to make a joint investment. Each participating member signs an intent to contribute their share of tokens (from their personal subnet balances) to a "DAO Investment" Strategy Contract. Once the total funding goal is reached, the Strategy Contract executes the investment (e.g., buys another token, invests in a project).

*   **Batch Operations for Efficiency**: 
    *   A platform might want to perform many small token distributions. Instead of many individual `x-transfer` calls from a treasury, a Strategy Contract could be designed to take one large intent from the treasury to fund itself, and then multiple smaller intents *from recipients* authorizing the Strategy Contract to *send to them* from its pool. This is a more complex pattern but explores batching.

*   **Complex Financial Products (e.g., Structured Notes, Options Writing with Collateral)**:
    *   Creating a structured financial product might require one party to provide the underlying asset (via a Blaze intent) and another to provide premium or collateral (also via Blaze intents), all coordinated by a central Strategy Contract that then mints the product.

## Advanced Considerations

*   **Orchestration Logic**: The Strategy Contract needs robust logic for sequencing, state management (tracking received intents), error handling (e.g., if one party defaults or an intent is invalid), and potentially for distributing outputs or refunding inputs.
*   **User Experience (UX)**: Interfaces are needed to simplify the process for users to discover, understand, and participate in these multi-intent strategies. This might involve UIs that guide users in signing the correct intents or platforms where users can commit to participating in a strategy.
*   **Discoverability & Standardization**: As these patterns evolve, standards for how Strategy Contracts define their required intents could aid composability and UI development.
*   **Security Audits**: Given their role in coordinating multiple assets and authorizations, Multi-Signature Strategy Contracts require rigorous security audits.

Multi-Signature and Composable Strategies represent a frontier in DeFi, moving beyond simple transactions to truly programmable and collaborative financial operations, all anchored by the security and flexibility of the Blaze intent verification system. 