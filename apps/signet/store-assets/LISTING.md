# Blaze Wallet — Chrome Web Store listing

Upload `build/blaze-wallet-chrome.zip` (made by `pnpm package:store` in apps/signet).

## Store listing

**Name:** Blaze Wallet

**Summary** (132 characters max):
> Do more on Stacks. Sign once for limit orders and scheduled buys that run on their own, settled on-chain and paid only to you.

**Category:** Tools (or Productivity; pick in the dashboard)

**Language:** English

**Description:**

> Blaze Wallet upgrades how you use Stacks. It does everything a Stacks wallet does, and adds Blaze: sign an order once and it runs on its own when its moment comes, settled on-chain and paid only to you. Built by Charisma, it lives in Chrome's side panel.
>
> SIGN ONCE, IT RUNS ON ITS OWN
> Limit orders and scheduled buys are signed ahead of time and run when their price or time arrives. Approve a whole plan, like a month of buys, with one card that shows how many orders there are, the total they can spend, and that they can only pay you.
>
> FAST WHERE IT CAN BE, ON-CHAIN WHERE IT COUNTS
> Blaze subnets move tokens as signed messages and settle every trade on the Stacks blockchain. The Status tab shows the network, Charisma's token list, and every Blaze subnet with your balance on each, read straight from the chain.
>
> WORKS WITH ANY STACKS APP
> Blaze Wallet speaks the standard Stacks wallet language, so it shows up in any app's "Connect wallet" list. Connect, sign messages, send STX and tokens, and run contract calls.
>
> EVERY TOKEN, ONE VIEW
> Balances with logos and dollar values. Sends allow exactly the amount you choose. Tokens that aren't on Charisma's token list, like scam airdrops, are tucked away and can't be sent by mistake.
>
> KNOW EXACTLY WHAT YOU SIGN
> Orders are shown in plain words: the action, the token, the amount, and who can be paid. Transactions list exactly which tokens can leave your wallet, and warn loudly when a site asks for more. Every request opens a sealed card the website can't read, cover or click.
>
> YOUR KEYS STAY YOURS
> Your seed phrase and keys are encrypted in your browser with your password and never sent anywhere. The wallet locks itself after 15 minutes idle. New seed phrases must be written down and confirmed before they're saved.
>
> LIGHT OR DARK
> Charisma's Light · Bitcoin and Dark · RPG looks. Blaze Wallet follows your device, or pick one in the Vault.
>
> Blaze Wallet has no accounts, no analytics and no tracking.

**Graphics:**
| Asset | File |
|---|---|
| Store icon (128×128) | `icon-128.png` |
| Screenshots (1280×800, light look) | `screenshot-1-tokens.png`, `-2-sign`, `-3-connect`, `-4-wallet`, `-5-status` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560) | `promo-marquee-1400x560.png` |

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

**Data usage — collected:** Tick **Financial and payment information** only, for app functionality: the wallet sends the active account's public Stacks address to Charisma's balance service (swap.charisma.rocks) to show its balances, including changes still on their way and amounts signed orders set aside, live while the Tokens tab is open. The service reads public blockchain data, keeps the address only in short-lived caches (under an hour) and doesn't tie it to an account. Addresses and signed transactions also go to the Stacks network (Hiro API) and to sites the user approves, as described in the privacy policy. Token names, logos and prices come from Charisma's token list and price feed, asked by token, never by address; token logos load from wherever each token hosts them.

Certify:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes
