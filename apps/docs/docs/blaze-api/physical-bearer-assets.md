---
slug: physical-bearer-assets
sidebar_position: 10
title: Physical Bearer Assets
---

# Physical Bearer Assets with Blaze Intents

Blaze's intent-based architecture can be uniquely extended into the physical world, creating tangible items that act as bearers for pre-signed digital actions. This concept merges the security of on-chain verification with the simplicity and familiarity of physical exchange.

## The Core Idea: Cryptographically Linked Physical Items

Imagine a physical item (a card, a note, a sticker on a product) that is inextricably linked to a specific, digitally signed Blaze intent. The physical possession of this item grants the holder control over the potential execution of that underlying digital intent.

*   **Value in Potentiality**: The value of the physical bearer asset can lie in the *potential* to execute an on-chain action (e.g., redeem tokens, claim an NFT) or simply in the verifiable, unique, and unexecuted link between the physical object and a digital promise.
*   **Physical Transfer as Value Exchange**: Passing the physical item from one person to another can, in itself, constitute a transfer of value or rights, acting as a highly scalable off-chain settlement layer.

## Mechanisms of a Physical Blaze Intent

Creating a secure and functional physical bearer asset with Blaze involves several components:

1.  **The Signed Intent**: A complete Blaze intent (including `contractId`, `intent` string, `uuid`, `signature`, and any necessary parameters like `amountOptional` or `targetOptional`) is generated and signed off-chain. This forms the digital core of the asset.

2.  **Publicly Verifiable Claim (Non-Destructive)**:
    *   The physical item should display some public information, such as:
        *   The `uuid` of the intent.
        *   Optionally, human-readable details about what the intent represents (e.g., "Redeemable for 100 CHA tokens").
    *   This allows anyone to use a tool (e.g., a website accessed via a QR code/deeplink on the item) to:
        *   Call `blaze-v1.check(uuid)` to verify if the intent has *already been executed* on-chain. An intact physical item whose UUID is  marked as already submitted on-chain would signify it's not redeemable on-chain.
        *   Potentially view non-sensitive details of the intent if the unsigned parameters are made public alongside the UUID.

3.  **Secure & Irreversible Reveal for Execution (Destructive Action)**:
    *   The critical part of the intent needed for execution—primarily the `signature` and potentially other sensitive parameters not publicly displayed—is hidden on or within the physical item.
    *   Accessing this hidden data must require a **physically evident and ideally irreversible action**. Examples:
        *   Scratching off an opaque coating (like a lottery ticket or gift card).
        *   Breaking a tamper-evident seal.
        *   Unfolding or tearing a specially designed paper note along perforations.
    *   This "reveal" signifies the holder's decision to make the intent fully executable on-chain.

4.  **Submission to Blaze API**: Once the full intent data (including the signature) is revealed, the holder can submit it to the Blaze API's `/execute` endpoint (e.g., via a simple web interface linked from the physical item).

5.  **Physical Anti-Counterfeiting**: The physical item itself must incorporate sufficient anti-counterfeiting measures to prevent forgery of the item or unauthorized pre-reveal access to the hidden signature. The stronger these measures, the more trust can be placed in the physical asset.

## Use Cases & Applications

This paradigm unlocks novel use cases:

*   **Physical Crypto Notes/Bills**: Tangible notes representing a fixed amount of a subnet-enabled token (e.g., a "10 CHA Note"). Scratching the note reveals the signature for an intent that, when executed via Blaze, transfers 10 CHA from a pre-funded treasury or escrow to the bearer.
*   **"Phygital" NFTs & Collectibles**: A physical artwork or collectible can be linked to a Blaze intent. The public part verifies authenticity. The hidden part might contain a signature for an intent to:
    *   Claim a related utility token.
    *   Register a unique on-chain status for the physical item's owner.
    *   Transfer the digital counterpart NFT if it's held in a Blaze-compatible contract.
*   **Decentralized Vouchers & Gift Cards**: Physical cards whose value (e.g., store credit, service access) is backed by a signed Blaze intent, redeemable on-chain or through a service that interacts with Blaze.
*   **Proof of Purity/Unclaimed Status**: The intact state of the reveal mechanism itself acts as a strong indicator that the underlying digital value has not yet been claimed or moved on-chain.
*   **Experiential Marketing & Unique Drops**: Distributing physical items that contain Blaze intents for claiming limited edition digital assets, airdrops, or exclusive access.

## Implications & Considerations

*   **Hyper-Scalability via Physical Exchange**: The physical items can be traded peer-to-peer any number of times without incurring gas fees or requiring immediate on-chain settlement. Only the final holder who wishes to realize the digital asset on-chain needs to interact with the blockchain.
*   **Optional On-Chain Settlement**: The primary value might remain in the physical item and its circulation, with on-chain settlement being an option rather than a necessity for every transfer of ownership.
*   **Shift in Security Focus**: While `blaze-v1` secures the on-chain execution, the integrity of the *unrevealed* intent relies heavily on the physical security and anti-counterfeiting of the bearer item.
*   **Intent Design**: The pre-signed intent must be crafted carefully. For example, an `x-redeem` intent from a known, funded contract is suitable for notes. Intents should be specific and limit potential misuse if revealed.
*   **Anonymity & Privacy**: Physical exchange can offer a degree of privacy not typically found in on-chain transactions until the point of on-chain redemption. For instance, if Bitcoin (BTC) is pegged into a Stacks-based wrapped asset like sBTC, and this sBTC is then used to back a physical bearer note (e.g., "0.1 sBTC Note") via a Blaze intent, these notes could be exchanged physically multiple times. Each exchange would be as private as a cash transaction. Only the final holder who decides to "digitize" their sBTC by revealing the intent and executing it on-chain would link their Stacks address to that specific sBTC note's redemption. Prior physical transfers would remain off-chain and pseudonymous under the guise of the physical note itself.

Physical Bearer Assets powered by Blaze intents represent a fascinating bridge between the digital and tangible worlds, opening up new design spaces for value representation and interaction. 