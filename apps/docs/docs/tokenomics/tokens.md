---
sidebar_position: 2
title: Tokens
---

# Tokens

Five fungible tokens, all with 6 decimals. CHA, DMG and HOOT trade freely; ENERGY and EXP can't be sent between wallets.

| Token | Contract | Used for today | Who can mint | Status |
|---|---|---|---|---|
| CHA | `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token` | Main token: pools, routing, Hold-to-Earn pairs | Anyone with a Red Pill, by wrapping DMG under the [throttle](./cha.md) | Current |
| DMG | `SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token` | Locked to wrap CHA; one side of the CHA–DMG pool | The DAO and any enabled extension. No supply cap | Legacy |
| ENERGY | `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy` | Earned by [Hold-to-Earn](./hold-to-earn.md), spent on HOOT | The DAO and any enabled extension; in practice the Rulebook | Current |
| EXP | `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.experience` | Reputation points, handed out in small amounts | The DAO and any enabled extension; in practice the Rulebook | Legacy |
| HOOT | `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl` | Bought with ENERGY; one side of the CHA–HOOT pool | Nobody. The whole supply was minted at deploy | Current |

Live supply: call `get-total-supply` on each contract in the [Hiro explorer](https://explorer.hiro.so/?chain=mainnet).

## Notes

- **DMG** is on-chain "Charisma Governance", the original DAO token. DMG voting is switched off: `dme001-proposal-voting` is no longer a DAO extension.
- **ENERGY** and **EXP** `transfer` only works when called by the DAO or an extension, so wallets can't move them.
- Anyone can burn their own CHA or HOOT.

Who controls each contract: [Governance](./governance.md).
