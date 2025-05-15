---
id: history
title: Security Architecture
sidebar_position: 6
---

# Security Architecture

Early iterations of the protocol relied on a very open governance process that prioritised flexibility over defence-in-depth. Over time we have moved towards a *security-first* posture and introduced multiple layers of protection for token supply and treasury operations.

## Layers of Defence (current system)

### 1. Supply-rate locks (CHA)
Minting or burning CHA is limited to **1 token per 1 440 Bitcoin blocks**. The logic is enforced on-chain and cannot be bypassed, even by administrators.

### 2. Multi-sig governance
All critical functions (Rulebook limits, CHA cooldown, treasury moves) require a **3-of-4** multi-signature from Rozar, Kraqen, MooningShark and Vinzo. No single key can unilaterally change parameters or move funds.

### 3. Rulebook middleware
Every EXP, ENERGY and DMG operation must be routed through the **Rulebook** contract, which:
* checks the caller against a verified-interaction whitelist,
* applies read-only status-effect modifiers,
* enforces per-operation hard caps before forwarding to the token.

### 4. Verified-interaction whitelist
Only pre-approved engines (e.g. Hold-to-Earn, meme engines, fatigue system) can invoke Rulebook functions. The list is governed by the same multi-sig and is auditable on-chain.

### 5. Read-only status effects
Perks like **Energetic Welsh** or **Raven Wisdom** cannot mint or burn tokens; they purely return adjusted numbers, which are still clamped by Rulebook limits.

### 6. On-chain ceilings
Caps such as `max-reward`, `max-mint`, etc. are stored in data-vars. Any change triggers an on-chain event and must pass the multi-sig.

### 7. Open-source & peer reviewed
All contracts are open-source and visible on chain explorers. External peer reviews are scheduled before major upgrades; minor parameter tweaks are traceable via transaction history.

These overlapping controls—rate-limits, multi-sig, middleware, whitelists and transparent code—combine to deliver a robust, defence-in-depth security architecture. 