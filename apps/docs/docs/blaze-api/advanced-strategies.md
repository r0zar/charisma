---
slug: advanced-strategies
sidebar_position: 8
title: Advanced Strategies & Composability
---

# Advanced Strategies & Composability with Blaze

While Blaze fundamentally provides a mechanism for executing single, verified user intents (like transferring tokens or swapping), its true power unfolds when combined with "Strategy Contracts." These are smart contracts that, once seeded with assets via a Blaze-verified operation (e.g., an `x-transfer` to the contract itself), can perform a sequence of complex actions with those assets without requiring further user signatures for each internal step.

## The Core Principle: Intent-Driven Operations

1.  **Subnet-Enabled Assets**: The user's assets must first reside within a Blaze-compatible Subnet Token contract (e.g., by depositing standard SIP-010 tokens into a subnet wrapper like `charisma-token-subnet`). Their balance is tracked by this subnet contract.

2.  **User Signs Intent(s)**: For each specific operation or for each step in a recurring strategy, the user signs a distinct intent. This intent authorizes the transfer of a specified amount of their subnet-enabled tokens *from their subnet balance to a specific Strategy Contract*, or authorizes a particular action by the Strategy Contract using those funds. Each intent has a unique UUID.

3.  **Intents Submitted to Solver**: These signed intents are provided to a Blaze Solver or a platform that manages them.

4.  **Solver Triggers Strategy Contract**: When conditions are met (e.g., scheduled time for DCA, market event for rebalancing), the solver selects the appropriate signed intent and calls a function on the designated Strategy Contract. This call includes the user's signed intent parameters.

5.  **Just-in-Time Custody & Execution**: 
    *   The Strategy Contract first calls the user's Subnet Token contract (e.g., its `x-transfer` function), which in turn uses `blaze-v1` to verify the user's signature and intent to transfer the *specific tranche of funds for that single operation* from their subnet balance to the Strategy Contract.
    *   Once the Strategy Contract receives these funds (now holding them `(as-contract tx-sender)`), it immediately proceeds with its pre-programmed logic (e.g., executing a swap, interacting with another DeFi protocol).

6.  **Non-Custodial Until Execution**: Crucially, the user's broader assets remain in their Subnet Token contract balance. The Strategy Contract only gains custody of the exact amount needed for the current operation, precisely when it's needed.

This model allows for sophisticated, multi-step operations to be authorized by granular, per-operation user intents, with the solver handling the gas fees and triggering the execution.

### The Solver: Off-Chain Powerhouse

A crucial aspect of this architecture is that the **Blaze Solver operates entirely off-chain**. This has significant implications:

*   **Oracle Integration**: Being off-chain, the solver can access and incorporate arbitrary external data (oracle data) when deciding how and when to act on a signed intent. This can include:
    *   Real-time price feeds from centralized or decentralized oracles.
    *   Current market conditions (e.g., volatility, gas prices).
    *   Data from other blockchains or traditional APIs.
    *   Any other external event or condition.

*   **Dynamic Transaction Parameterization**: The solver constructs the actual Clarity transaction that will be submitted to the Stacks network. While the core authorization comes from the user's signed intent (specifically, the data hashed according to SIP-018 and verified by `blaze-v1`), any parameters *not* included in that signed hash can be dynamically supplied by the solver at the time of transaction construction. This means the solver can:
    *   Adjust slippage tolerances for swaps based on current market volatility.
    *   Select specific liquidity pools or routes if the user's intent was more general.
    *   Populate memo fields or other non-critical transaction parameters.
    *   Even choose between different functions to call on the Strategy Contract if the signed intent is a generic authorization for a class of actions.

*   **Conditional Execution & Timing**: The solver has full control over *when* and *if* a transaction is submitted for a given intent. It can wait for specific market conditions, time-based triggers (e.g., for scheduled tasks like DCA), or any other off-chain logic to be met before broadcasting the transaction.

This off-chain flexibility, combined with the on-chain security of `blaze-v1` verifying the core signed intent, is what makes Blaze exceptionally powerful for building sophisticated and responsive applications.

## Example: Multi-Hop Swap Router

The `multi-hop-router.clar` contract provided in the reference material is a perfect illustration of this pattern.

**Key Mechanics:**

*   **Initial Deposit (`x-deposit`)**: The router's `x-swap-*` functions begin with an `x-deposit` step. This private function takes the user's `signature`, `amount`, `uuid` for a specific input `<subnet-trait>` token. It calls `x-transfer` on that token subnet, which in turn calls `blaze-v1.execute` to verify the user's intent to transfer `amount` of their tokens *to the router contract itself*.
    ```clarity
    (define-private (x-deposit 
      (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)}))
      (let ((t (get token in)) (a (get amount in)) (s (get signature in)) (u (get uuid in))
      (r (unwrap-panic (contract-call? t x-transfer s a u CONTRACT)))) ;; CONTRACT is (as-contract tx-sender)
      (print {type: "x-deposit", token: t, amount: a, signature: s, uuid: u, result: r}) r))
    ```
*   **Internal Hops (`execute`)**: Once the router contract holds the input tokens, it can perform a series of swaps. Each `hop-*` parameter in `x-swap-*` specifies a `<vault-trait>` (e.g., an AMM pool) and an `opcode` (parameters for that pool). The router calls `execute` on each vault in sequence, using the output of the previous hop as the input for the next.
    ```clarity
    (define-private (execute 
      (operation {vault: <vault-trait>, opcode: (buff 16)}) (amount uint))
      (let ((v (get vault operation)) (o (get opcode operation))
      ;; The router calls the vault AS ITSELF
      (r (unwrap-panic (as-contract (contract-call? v execute amount (some o))))))
      (print {type: "execute", vault: v, opcode: o, amount: amount, result: r}) r))
    ```
*   **Final Withdrawal (`withdraw`)**: After all hops, the router withdraws the final output token to the user-specified `to` address by calling `transfer` on the output `<sip10-trait>` token contract, again, `as-contract`.

**Implications:** A user can sign a single message to authorize a complex 5-hop swap. The Blaze solver submits the transaction to the `x-swap-5` function, and the router handles the entire chain of operations.

## Potential Use Cases

This "Blaze-initiated strategy contract" pattern, where Strategy Contracts operate on funds transferred just-in-time via specific user intents, enables a wide range of powerful applications:

1.  **Automated Portfolio Rebalancing**: Users pre-sign intents for potential rebalancing trades (e.g., "intent to transfer X of TokenA to RebalancerContract for rebalancing pair A/B"). A solver, monitoring portfolio drift, picks the relevant signed intent(s) to supply assets to the RebalancerContract, which then executes the necessary swaps internally.

2.  **Conditional DeFi Chains**: "If Token X reaches price Y, use my signed intent to transfer 100 TokenZ to StrategyContract, which will then swap Z for X and stake X in Vault V." The solver awaits the condition, then uses the intent to fund and execute the chain.

3.  **Dollar-Cost Averaging (DCA) / Recurring Investments**: Users pre-sign a series of intents, each for a single DCA purchase (e.g., 12 monthly intents for "transfer 100 USDC to DCAContract"). A solver, on schedule, submits one intent at a time. The DCAContract receives that specific 100 USDC and invests it.

4.  **Advanced Yield Farming Automation**: Users can pre-sign intents for various steps: an intent to deposit base assets into the YieldStrategyContract, further intents to authorize the contract to move those specific funds (once in the contract) between different LPs or staking pools if the strategy dictates a rotation. The solver triggers these based on yield opportunities or predefined logic, using the appropriate signed intent to fuel each step if it involves moving funds from the user's initial subnet holdings into the strategy contract, or authorizing the strategy contract to act.

5.  **Subscription Services & Scheduled Payments**: Similar to DCA, users pre-sign intents for each periodic payment. The solver submits the correct intent to the SubscriptionContract at each payment interval, transferring only that period's fee.

6.  **Managed & Automated Trading Strategies**: Contracts can execute complex trading logic (e.g., grid trading, arbitrage between on-contract pools) using user-deposited funds, with solvers triggering actions based on market data.

By leveraging `blaze-v1` for the initial secure, just-in-time transfer of asset control to a specialized smart contract for each operation, developers can build highly automated, non-custodial (until execution), gas-efficient (for the user), and user-friendly DeFi applications and services on Stacks. 