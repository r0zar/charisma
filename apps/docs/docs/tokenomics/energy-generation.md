---
id: energy-generation
title: ENERGY Generation
sidebar_position: 4
---

# ENERGY Generation & Hold-to-Earn

**ENERGY** is the universal reward currency of Charisma.

The flagship way to mint it is the **Hold-to-Earn engine** – a non-custodial, time-weighted staking mechanism generated from your balance history.

## Reward formula

1. **Integral of balance** – trapezoidal integral of balance between last `tap` and now.  
2. **Incentive multiplier** – per-token factor set by governance (defaults to 1×).  
3. **Supply normalisation** – divide by total supply so rewards stay proportionate.

`potential-energy = balanceIntegral × incentiveMultiplier ÷ totalSupply`

The engine then calls the Rulebook's `energize` function. Status-effects (e.g. Energetic Welsh) can boost the figure, and hard caps make sure it never exceeds protocol limits.

## Why it matters

* **Stake-less staking** – users keep custody of their tokens.  
* **History-aware** – rewards grow with both size *and* duration of the position.  
* **DAO-tunable** – governance can adjust multipliers or Rulebook caps without redeploying engines.  
* **Composable** – any SIP-010 token can get its own engine using the Launchpad template. 