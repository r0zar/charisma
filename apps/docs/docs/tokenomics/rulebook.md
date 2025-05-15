---
id: rulebook
title: Rulebook & GameFi Security
sidebar_position: 3
---

# Rulebook & GameFi Security Layer

All EXP, ENERGY and DMG operations first flow through the on-chain **Rulebook** contract (`charisma-rulebook-v0`).
It sits between gameplay / DeFi logic and the underlying SIP-010 token contracts, enforcing protocol-wide rules.

## Operation flow

1. **Verified interaction** – only addresses in the `verified-interactions` whitelist (e.g. meme engines, fatigue system, mining, etc.) can call the Rulebook.  
2. **Status-effects middleware** – the call is handed to the `status-effects` contract which applies NFT perks and other dynamic modifiers.  
3. **Hard caps enforced** – the Rulebook checks the modified amount against per-operation ceilings.  
4. **Token execution** – the final, capped amount is forwarded to the relevant token contract.

## Default hard caps

| Operation | Token | Limit |
|-----------|-------|-------|
| reward / punish | EXP | 1 000 |
| energize / exhaust | ENERGY | 1 000 |
| transfer / mint / burn / lock / unlock | DMG | 100 |

These limits are stored in on-chain variables (`max-reward`, `max-mint`, …) and can only be changed by a multi-owner vote (entries in `contract-owners`).

## Multi-owner architecture

* Multiple owners can be added or removed by consensus, preventing single-key failure.  
* The same owner set controls both the limits and the interaction whitelist.

## Status-effect examples

* **Energetic Welsh** – Welsh NFT holders earn up to 100 % bonus ENERGY when using approved meme engines.  
* **Raven Wisdom** – Raven NFT holders get up to 25 % fee reduction on DMG burns and transfers.  
* **Memobot Capacity** – Memobot NFTs increase a user's ENERGY storage beyond the 100-unit base.

All status-effect contracts are read-only; they cannot mint or burn directly. They only return adjusted numbers which must still respect the Rulebook caps. 