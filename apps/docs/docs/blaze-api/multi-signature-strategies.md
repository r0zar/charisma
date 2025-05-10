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
*   Two users want to atomically swap NFTs without a centralized escrow.

A **Multi-Signature Strategy Contract** acts as the on-chain coordinator for such operations. It defines the overall goal and the individual contributions (intents) required. Each participant signs their respective Blaze intent(s) for their part of the deal. The key is that a **Blaze Solver** can collect these intents off-chain and submit them together in a single transaction.

**Key Characteristics:**

*   **Multiple, Independent Intents**: Each required asset movement or authorization is a separate Blaze intent, signed by the relevant party.
*   **Solver-Orchestrated Atomic Submission**: A Blaze Solver gathers all necessary signed intents off-chain. It then calls the Strategy Contract, providing all intents as parameters in a *single transaction*.
*   **Strategy Contract as Atomic Executor**: The Strategy Contract is designed to receive and verify these multiple intents simultaneously within that single transaction.
*   **Composable Execution**: Once all necessary intents are successfully verified and the corresponding assets are secured by (or authorized for) the Strategy Contract (often within the same transaction), it then executes the final, combined financial operation.

## Mechanics of Multi-Signature Strategies

1.  **Strategy Definition**: A smart contract (the "Strategy Contract") is deployed. It defines a multi-step or multi-party operation and includes a public function that expects all required signed intents as parameters (e.g., User A's intent, User B's intent, etc.).

2.  **Individual Intent Creation & Signing**: Each participant creates and signs their Blaze intent(s) for their specific contribution:
    *   User A signs: "Intent to transfer 100 TokenX from my `token-x-subnet` balance to StrategyContract (UUID: ax123)".
    *   User B signs: "Intent to transfer 50 TokenY from my `token-y-subnet` balance to StrategyContract (UUID: by456)".
    These signed intents are then communicated to a Blaze Solver (or a platform acting as one).

3.  **Solver-Driven Orchestration & Submission**:
    *   The Blaze Solver collects all required signed intents from the participating parties off-chain.
    *   The Solver validates these intents (e.g., ensuring signatures are valid, parameters seem correct).
    *   Once all necessary intents are gathered and validated, the Solver constructs a single Clarity transaction. This transaction calls the designated function on the Strategy Contract, passing all the collected signed intents (signatures, UUIDs, amounts, targets, etc.) as arguments.

4.  **Simultaneous On-Chain Verification & Asset Aggregation**:
    *   The Strategy Contract's function receives all signed intents in one go.
    *   Within this single transaction, it makes multiple calls to the relevant Subnet Token contracts' `x-transfer` (or similar) functions. Each `x-transfer` call uses the corresponding user's signed intent, and the Subnet contract, in turn, calls `blaze-v1.execute` for verification.
    *   If all intents are valid, the specified assets are transferred from the users' subnet balances to the Strategy Contract *within that same transaction*.

5.  **Execution of the Combined Operation**: With all assets now held by (or spendable by) the Strategy Contract (still within the same atomic transaction), it immediately triggers the main financial logic (e.g., calling `amm-pool.add-liquidity(tokenX_amount, tokenY_amount)` or executing a P2P NFT swap).

6.  **Atomicity & Simplified Failure Handling**:
    *   **Solver-Level Pre-Validation**: If any party fails to provide their signed intent to the solver, or if an intent is clearly invalid off-chain, the solver will not attempt to submit the transaction. The operation effectively fails off-chain without incurring gas fees or creating on-chain partial states.
    *   **On-Chain Atomicity**: Because all intents are processed and assets are moved to the Strategy Contract within a single transaction, the entire multi-party operation is atomic on-chain. If any `blaze-v1.execute` call fails during this transaction (e.g., an invalid signature for one intent, or a UUID already used), the entire transaction reverts. This means there's no risk of the Strategy Contract being left in a state where it holds assets from one party while waiting for another, greatly simplifying error handling and eliminating the need for complex refund mechanisms for partially completed multi-stage operations.

## Example Use Cases

*   **Decentralized Liquidity Provisioning (Multi-Party)**:
    *   Multiple users contribute different assets to an "LP Formation" Strategy Contract. Each user provides their signed intent to a solver. The solver bundles these and calls the Strategy Contract, which then atomically pulls all assets and creates the LP position, distributing LP tokens.

*   **Peer-to-Peer Atomic NFT Swaps (No Escrow)**:
    *   Alice wants to trade her NFT-A (in `nft-a-subnet`) for Bob's NFT-B (in `nft-b-subnet`).
    *   Alice signs an intent: "Transfer my NFT-A from `nft-a-subnet` to Bob, if Bob transfers NFT-B to me (UUID: alice123)".
    *   Bob signs an intent: "Transfer my NFT-B from `nft-b-subnet` to Alice, if Alice transfers NFT-A to me (UUID: bob456)".
    *   A solver collects both signed intents. It calls a P2P NFT Swap Strategy Contract, providing both intents.
    *   The Strategy Contract verifies Alice's intent (via `nft-a-subnet` and `blaze-v1`) to transfer NFT-A to itself, then Bob's intent (via `nft-b-subnet` and `blaze-v1`) to transfer NFT-B to itself. Once both NFTs are held by the Strategy Contract (within the same transaction), it then transfers NFT-A to Bob and NFT-B to Alice. If either initial intent fails verification, the whole transaction reverts, and no NFTs move.

*   **Multi-Asset Collateralization**:
    *   A user signs intents to transfer various collateral assets (Token A from `subnet-A`, Token B from `subnet-B`) to a "Multi-Collateral Loan" Strategy Contract. A solver submits these to the contract, which, upon verifying all, allows the user to mint/borrow the debt asset.

*   **Coordinated DAO Actions / Group Investments**:
    *   DAO members provide signed intents for their token contributions to a solver. The solver calls a "DAO Investment" Strategy Contract, which atomically collects all funds and executes the investment.

## Advanced Considerations

*   **Strategy Contract Design**: The Strategy Contract's primary function must be designed to accept all necessary signed intents as parameters.
*   **Solver Reliability & Trust**: While the on-chain execution is secure and atomic, users rely on the chosen solver to faithfully collect and submit the bundled intents. Different solver implementations might offer varying levels of guarantees or features.
*   **User Experience (UX)**: Platforms acting as solvers need to provide clear UIs for users to understand the multi-party operation they are signing up for and to submit their individual signed intents.

By leveraging solvers to bundle multiple intents for atomic on-chain execution, Blaze's Multi-Signature Strategies offer a powerful, secure, and efficient way to build complex, collaborative DeFi applications on Stacks, significantly reducing risks and simplifying development compared to traditional multi-step, stateful approaches. 