---
slug: /
sidebar_position: 0
title: Introduction to the Blaze Protocol
---

# Understanding the Blaze Protocol: A New Approach to Stacks Interactions

**The Blaze Protocol offers a refined way to interact with the Stacks blockchain. It allows users and applications to declare their objectives, and the protocol, through its network of solvers, works to fulfill these signed "intents" as secure on-chain actions.**

Blaze is an **intent-centric execution layer**. It shifts the focus from imperative transaction commands to declarative statements of purpose. You define *what* you aim to achieve, and Blaze handles the complexities of translating that into efficient, verified operations on the Stacks network.

## Key Features of the Blaze Protocol

*   **Simplified Interactions**: Blaze aims to streamline the user experience by abstracting many of the underlying blockchain mechanics.
*   **Off-Chain Intelligence, On-Chain Assurance**: The protocol utilizes off-chain solvers that can integrate external data and optimize execution. On-chain, the `blaze-v1` verifier contract ensures that all actions are authorized by the user's signature and are protected against replay.
*   **Versatile Operations**: Blaze supports a range of operations, from direct token movements to complex multi-hop swaps and the coordination of advanced DeFi strategies.
*   **Potential for Gas Abstraction**: Solvers can manage gas fees, potentially enabling users to interact with applications without directly handling STX for transaction costs.
*   **Enhanced Privacy for Off-Chain Stages**: The off-chain nature of intent creation and management, especially with applications like [Physical Bearer Assets](./physical-bearer-assets.md), can offer enhanced privacy for interactions before they reach on-chain settlement.
*   **Designed for Composability**: Blaze intents and Strategy Contracts are designed to be modular, facilitating the development of interconnected DeFi applications.

## Exploring This Documentation

These documents provide a comprehensive guide to the Blaze Protocol:

*   **Core Concepts**: Learn about the [System Architecture](./architecture.md), the mechanics of [Intents & Signing (SIP-018)](./intents-and-signing.md), and the function of the [On-Chain Verifier (`blaze-v1`)](./signature-verification.md).
*   **API Endpoints**: Understand the [`/execute`](./execute.md) endpoint for subnet operations and the [`/multihop/execute`](./multihop-execute.md) for swaps.
*   **Subnet Integration**: See an [Example Token Subnet](./subnet-example-token.md) to understand how contracts use Blaze.
*   **Advanced Capabilities**: Discover [Advanced Strategies & Composability](./advanced-strategies.md), [Multi-Signature Strategies](./multi-signature-strategies.md), and the concept of [Physical Bearer Assets](./physical-bearer-assets.md).
*   **Security Model**: Review the [Security & Token Flow](./security-token-flow.md) for a clear understanding of how assets are managed.

**The Blaze Protocol provides a robust foundation for developers building on Stacks, emphasizing ease of use, sophisticated automation, and verifiable security.**

We invite you to explore how Blaze can support your development efforts. 