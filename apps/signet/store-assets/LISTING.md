# Blaze Wallet — Chrome Web Store listing

Upload `build/blaze-wallet-chrome.zip` (made by `pnpm package:store` in apps/signet).

## Store listing

**Name:** Blaze Wallet

**Summary** (132 characters max):
> The wallet for Stacks and Blaze subnets. Connect to any Stacks app, sign and send, and see exactly what you approve.

**Category:** Tools (or Productivity; pick in the dashboard)

**Language:** English

**Description:**

> Blaze Wallet is a Stacks wallet that lives in Chrome's side panel, built by Charisma for Stacks apps and Blaze subnets.
>
> CONNECT TO ANY STACKS APP
> Blaze Wallet speaks the standard Stacks wallet language, so it shows up in any app's "Connect wallet" list. Connect, sign messages, send STX and tokens, and run contract calls.
>
> APPROVALS NOBODY CAN FAKE
> Every request opens a sealed approval card that the website can't read or click. Approve stays locked until the card has been fully visible, so a site can't trick you by covering it.
>
> KNOW EXACTLY WHAT YOU SIGN
> Blaze subnet orders are shown in plain words: the action, the token, the amount, and who can be paid. Transactions list exactly which tokens can leave your wallet, and warn loudly when a site asks for more.
>
> EVERY TOKEN, ONE VIEW
> Balances with logos and dollar values. Sends allow exactly the amount you choose. Tokens that aren't on Charisma's token list, like scam airdrops, are tucked away and can't be sent by mistake.
>
> YOUR KEYS STAY WITH YOU
> Your seed phrase and keys are encrypted in your browser with your password and never sent anywhere. The wallet locks itself after 15 minutes idle. New seed phrases must be written down and confirmed before they're saved.
>
> LIVE NETWORK VIEW
> A diagnostics hologram shows the Stacks network, every Charisma Blaze subnet, and your balance on each, read straight from the blockchain.
>
> Blaze Wallet has no accounts, no analytics and no tracking.

**Graphics:**
| Asset | File |
|---|---|
| Store icon (128×128, from 512) | `icon-512.png` |
| Screenshots (1280×800) | `screenshot-1-wallet.png` … `screenshot-5-sign.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |

**Links:**
| Field | URL |
|---|---|
| Homepage | https://wallet.charisma.rocks |
| Support | https://github.com/r0zar/charisma/issues |
| Privacy policy | https://wallet.charisma.rocks/privacy |

## Privacy practices tab

**Single purpose:**
> A cryptocurrency wallet for the Stacks blockchain: it holds the user's keys and lets them approve connections, signatures and transactions requested by Stacks websites.

**Permission justifications:**
| Permission | Justification |
|---|---|
| `storage` | Keeps the user's encrypted wallet vault on their device, and the unlocked key in session memory until it auto-locks. |
| `sidePanel` | The wallet's interface opens in Chrome's side panel. |
| `scripting` | Registers the standard Stacks wallet provider in web pages so Stacks apps can request a connection or signature. |
| Host permission `<all_urls>` | Any Stacks website can ask the wallet to connect or sign, so the provider and the approval card must be available on any site. The extension reads nothing from the pages. |

**Remote code:** No, I am not using remote code. (All scripts ship in the package.)

**Data usage — collected:** None of the categories are collected by the developer. Addresses and signed transactions go only to the Stacks network (Hiro API) and to sites the user approves, as described in the privacy policy.

Certify:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes
