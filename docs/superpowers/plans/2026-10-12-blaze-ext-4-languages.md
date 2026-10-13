# Blaze Wallet Extension, Plan 4: Nine Languages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Blaze Wallet Chrome extension (`apps/signet`, version 0.5.0) speaks English, Korean, Simplified Chinese, Spanish, French, German, Turkish, Japanese and Brazilian Portuguese. It starts in Chrome's language and has a Language picker in the Vault card.

**Architecture:**
- **Words:** Chrome's own format, `locales/{folder}/messages.json`. Plasmo copies the folders into `_locales`, so the manifest's description is translated too.
- **Lookup:** `src/shared/i18n-core.ts` bundles all nine files and fills in `$1`…`$9` and plural forms. It touches no DOM, so the background can use it. `src/shared/i18n.ts` adds the page's language (Automatic or the Vault card's pick) and exports `t`, `plural`, `pluralKey`, `count` and `locale`.
- **Errors:** the background throws `WalletError(key, fills)`, which crosses to the wallet's pages as `{ key, fills }`. Pages word it in their own language. Anything unexpected crosses as `{ message }` and is shown after a translated lead-in.
- **Check:** `scripts/check-locales.mjs` fails when any language is incomplete or unsafe, and `package:store` runs it first.

**Tech Stack:** Plasmo (Chrome MV3), React, TypeScript, `Intl` (`PluralRules`, number and date formatting), Node for the check.

**Spec:** `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md`, sections "Shared rules", "Chrome extension" and "Testing". The wallet terms each language uses are in `docs/i18n/wallet-terms.md` (plan 3b, Task 1).

**Baseline:** branch `feat/blaze-ios`. Nothing in `apps/signet` has changed since `main` except `scripts/ios-vectors.mjs` (plan 1).

---

## Working notes for every task

- **Pre-tested.** Every file here was written and checked in a copy of `apps/signet` before the plan was written:
  - `check-locales.mjs` passes for all nine languages
  - `tsc --noEmit` over the whole app reports only the one error that `main` already has (`wbip_providers` in `src/contents/signet-provider.ts`)
  - each language was checked by script: slots, never-translated names, the 132-character summary, typography, and the terms list
  - tight rows were measured in headless Chrome with the brand's fonts. The only overflow, the Vault card's three buttons in five languages, wraps since Task 3.

  Copy the code exactly. Patches must apply cleanly. If `git apply --check` fails, stop and report it.
- **Commands.** Run every command from the repo root.
- **Don't build or install.** Ross runs the dev server himself, and this plan never runs `pnpm install`, `plasmo build` or `pnpm dev`. The only thing to run is the locale check, which is plain Node.
- **Commits:** commit after every task, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

All paths are inside `apps/signet`.

| File | Responsibility |
|---|---|
| `locales/{folder}/messages.json` | Every message, in Chrome's format, in nine folders (`en` is the source) |
| `scripts/check-locales.mjs` | Fails when a language is missing a key or plural form, changes `$n` slots, has a `$word$` pattern, or the summary is over 132 characters, and when code uses a key English lacks |
| `src/shared/i18n-core.ts` | The nine bundled files, lookup, `$n` fills, plural forms; no DOM (the background imports it) |
| `src/shared/i18n.ts` | The page's language (Automatic or the pick, in `localStorage`), `t`, `plural`, `pluralKey`, `count`, `locale` |
| `src/shared/seed-words.ts` | The one seed-word normalization (NFKC, Turkish İ and ı, lowercase), for the side panel and the background |
| `src/background/lib/wallet-error.ts` | `WalletError(key, fills)` and its wire form |
| `src/shared/errors.ts` | Turning wire errors back into errors the pages word: `fromWire`, `describeError`, `UnexpectedError` |
| `store-assets/listing/{folder}.md` | Each language's store description, for Ross to paste into the dashboard |

---

### Task 1: The words in nine languages, and their check

**Files:**
- Create: `apps/signet/locales/en/messages.json`, `apps/signet/locales/{ko,zh_CN,es,fr,de,tr,ja,pt_BR}/messages.json`, `apps/signet/scripts/check-locales.mjs`
- Modify: `apps/signet/package.json` (patch below)

- [ ] **Write the English messages.** Every `description` says where the text appears.

`apps/signet/locales/en/messages.json`:

```json
{
  "extensionDescription": {
    "message": "Do more on Stacks. Sign once for limit orders and scheduled buys that run on their own, settled on-chain and paid only to you.",
    "description": "Chrome Web Store summary and chrome://extensions description. 132 characters or fewer."
  },
  "back": {
    "message": "Back",
    "description": "Button: back to the previous step"
  },
  "cancel": {
    "message": "Cancel",
    "description": "Button"
  },
  "continue": {
    "message": "Continue",
    "description": "Button: next step"
  },
  "done": {
    "message": "Done",
    "description": "Button: close after a send"
  },
  "copy": {
    "message": "Copy",
    "description": "Button: copy the address"
  },
  "copied": {
    "message": "Copied",
    "description": "Button label for a moment after copying"
  },
  "import": {
    "message": "Import",
    "description": "Button: import a seed phrase"
  },
  "unlink": {
    "message": "Unlink",
    "description": "Button: remove a seed phrase or the wallet from this browser (funds stay on the blockchain)"
  },
  "use": {
    "message": "Use",
    "description": "Button: make this account the active one"
  },
  "active": {
    "message": "Active",
    "description": "Badge on the active account"
  },
  "tryAgain": {
    "message": "Try again",
    "description": "Button after a crash"
  },
  "name": {
    "message": "Name",
    "description": "Field label: a name for a seed phrase"
  },
  "send": {
    "message": "Send",
    "description": "Button and review label: send tokens"
  },
  "to": {
    "message": "To",
    "description": "Review label: the recipient"
  },
  "amount": {
    "message": "Amount",
    "description": "Field and review label: how much of a token"
  },
  "lock": {
    "message": "Lock",
    "description": "Button: lock the wallet"
  },
  "review": {
    "message": "Review",
    "description": "Button: check a send before sending"
  },
  "max": {
    "message": "Max",
    "description": "Button: fill in the whole balance"
  },
  "address": {
    "message": "Address",
    "description": "Label: a Stacks address"
  },
  "tabWallet": {
    "message": "Wallet",
    "description": "Side panel tab"
  },
  "tabTokens": {
    "message": "Tokens",
    "description": "Side panel tab"
  },
  "tabStatus": {
    "message": "Status",
    "description": "Side panel tab"
  },
  "lockTheWallet": {
    "message": "Lock the wallet",
    "description": "Tooltip and screen reader label of the lock button"
  },
  "unlockLocked": {
    "message": "Locked. Enter your password to continue.",
    "description": "Lock screen, under the logo"
  },
  "unlockChoosePassword": {
    "message": "Choose a password to protect this wallet.",
    "description": "First run, under the logo"
  },
  "unlockTitle": {
    "message": "Unlock",
    "description": "Card title on the lock screen"
  },
  "createWalletTitle": {
    "message": "Create your wallet",
    "description": "Card title on first run"
  },
  "passwordLabel": {
    "message": "Password",
    "description": "Field label"
  },
  "newPasswordLabel": {
    "message": "New password ($1 or more characters)",
    "description": "Field label on first run. $1 is the minimum length (8)"
  },
  "passwordPlaceholder": {
    "message": "Your password",
    "description": "Field placeholder"
  },
  "newPasswordPlaceholder": {
    "message": "A strong password",
    "description": "Field placeholder on first run"
  },
  "passwordAgainLabel": {
    "message": "Type it again",
    "description": "Field label: repeat the new password"
  },
  "passwordAgainPlaceholder": {
    "message": "The same password",
    "description": "Field placeholder"
  },
  "unlockButton": {
    "message": "Unlock",
    "description": "Button"
  },
  "createWalletButton": {
    "message": "Create wallet",
    "description": "Button on first run"
  },
  "passwordShow": {
    "message": "Show",
    "description": "Button: show the password"
  },
  "passwordHide": {
    "message": "Hide",
    "description": "Button: hide the password"
  },
  "errorPasswordsDontMatch": {
    "message": "Passwords don't match",
    "description": "Error on first run"
  },
  "importTitle": {
    "message": "Import a seed phrase",
    "description": "Card title"
  },
  "seedNamePlaceholder": {
    "message": "My seed phrase",
    "description": "Placeholder for a seed phrase's name"
  },
  "importWordsLabel": {
    "message": "12 or 24 words",
    "description": "Field label for the seed words"
  },
  "importWordsPlaceholder": {
    "message": "word word word …",
    "description": "Placeholder for the seed words. Keep it in English: seed phrases are always English BIP39 words."
  },
  "errorSeedNotSaved": {
    "message": "The seed phrase was not saved",
    "description": "Error"
  },
  "newSeedTitle": {
    "message": "New seed phrase",
    "description": "Card title"
  },
  "generateWords": {
    "message": "Generate 24 words",
    "description": "Button"
  },
  "writeDownTitle": {
    "message": "Write these down",
    "description": "Card title over the 24 new words"
  },
  "writeDownWarning": {
    "message": "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.",
    "description": "Warning over the new words. Keep it exactly as strong."
  },
  "wroteDown": {
    "message": "I wrote all 24 words down, in order",
    "description": "Checkbox"
  },
  "confirmTitle": {
    "message": "Confirm your words",
    "description": "Card title"
  },
  "confirmNote": {
    "message": "Type these words from what you wrote down.",
    "description": "Note over the confirmation fields"
  },
  "wordNumber": {
    "message": "Word #$1",
    "description": "Field label. $1 is the word's position, 1 to 24"
  },
  "errorWordsDontMatch": {
    "message": "Word $1 doesn't match. Check what you wrote down",
    "description": "Error. $1 lists positions, for example \"#3, #7\""
  },
  "confirmAndSave": {
    "message": "Confirm and save",
    "description": "Button"
  },
  "newAccountTitle": {
    "message": "New account",
    "description": "Card title"
  },
  "newAccountNote": {
    "message": "The next address from this seed phrase becomes your active account.",
    "description": "Note"
  },
  "createAccount": {
    "message": "Create account",
    "description": "Button"
  },
  "accountName": {
    "message": "Account $1",
    "description": "An account's name. $1 is its number, starting at 1"
  },
  "noActiveAccount": {
    "message": "No active account",
    "description": "Card title when every seed phrase is unlinked"
  },
  "addAccountHint": {
    "message": "Add an account from a seed phrase below.",
    "description": "Hint under it"
  },
  "seedPhrasesTitle": {
    "message": "Seed phrases",
    "description": "Card title"
  },
  "noSeedPhrases": {
    "message": "None yet. Generate a new one or import yours.",
    "description": "Empty state"
  },
  "addAccount": {
    "message": "+ Account",
    "description": "Button: derive the next account of this seed phrase"
  },
  "generateNew": {
    "message": "Generate new",
    "description": "Button: a new seed phrase"
  },
  "confirmUnlinkSeed": {
    "message": "Unlink this seed phrase from this browser?\n\nIts accounts and funds stay safe on the blockchain. To use them here again, you will need the seed phrase words.",
    "description": "Confirmation dialog (Chrome's own OK and Cancel buttons)"
  },
  "vaultTitle": {
    "message": "Vault",
    "description": "Card title: the wallet's settings"
  },
  "vaultKeys": {
    "message": "Keys",
    "description": "Label"
  },
  "vaultKeysValue": {
    "message": "Encrypted, on this device only",
    "description": "Value of Keys"
  },
  "vaultAutoLock": {
    "message": "Auto-lock",
    "description": "Label"
  },
  "vaultAutoLockValue": {
    "message": "After 15 idle minutes",
    "description": "Value of Auto-lock"
  },
  "exportButton": {
    "message": "Export",
    "description": "Button: download the encrypted wallet backup"
  },
  "exportDone": {
    "message": "Wallet exported",
    "description": "Notice after the download"
  },
  "exportFailed": {
    "message": "Couldn't export the wallet",
    "description": "Notice when the download fails"
  },
  "confirmUnlinkWallet": {
    "message": "Unlink this wallet from this browser?\n\nEvery seed phrase and account is removed from this device. Your funds stay safe on the blockchain; you will need your seed phrase to get back in.",
    "description": "Confirmation dialog (Chrome's own OK and Cancel buttons)"
  },
  "themeLabel": {
    "message": "Theme",
    "description": "Label"
  },
  "themeSystem": {
    "message": "System",
    "description": "Theme choice: follow the device"
  },
  "themeSystemTitle": {
    "message": "Follow this device",
    "description": "Tooltip"
  },
  "themeLight": {
    "message": "Light",
    "description": "Theme choice"
  },
  "themeLightTitle": {
    "message": "Light · Bitcoin",
    "description": "Tooltip: the light look's name. Keep Bitcoin"
  },
  "themeDark": {
    "message": "Dark",
    "description": "Theme choice"
  },
  "themeDarkTitle": {
    "message": "Dark · RPG",
    "description": "Tooltip: the dark look's name. Keep RPG"
  },
  "languageLabel": {
    "message": "Language",
    "description": "Label of the language picker"
  },
  "languageAutomatic": {
    "message": "Automatic",
    "description": "Language choice: follow Chrome's language"
  },
  "tokensTitle": {
    "message": "Tokens",
    "description": "Card title"
  },
  "refresh": {
    "message": "Refresh",
    "description": "Button"
  },
  "refreshTitle": {
    "message": "Refresh balances",
    "description": "Tooltip"
  },
  "totalValue": {
    "message": "Total value",
    "description": "Label over the total in dollars"
  },
  "tokenCount_one": {
    "message": "$1 token",
    "description": "Under the total. $1 is the number of tokens"
  },
  "tokenCount_other": {
    "message": "$1 tokens",
    "description": "Under the total. $1 is the number of tokens"
  },
  "withoutPrice_one": {
    "message": "$1 without a price",
    "description": "Under the total. $1 is the number of tokens with no dollar price"
  },
  "withoutPrice_other": {
    "message": "$1 without a price",
    "description": "Under the total. $1 is the number of tokens with no dollar price"
  },
  "loadingBalances": {
    "message": "Loading balances…",
    "description": "While balances load"
  },
  "pricesUnavailable": {
    "message": "Prices unavailable: $1",
    "description": "Warning. $1 is the reason, already worded"
  },
  "unlisted_one": {
    "message": "$1 unlisted · not on Charisma's token list, may be a scam",
    "description": "Toggle for hidden tokens. $1 is how many"
  },
  "unlisted_other": {
    "message": "$1 unlisted · not on Charisma's token list, may be scams",
    "description": "Toggle for hidden tokens. $1 is how many"
  },
  "onBlaze": {
    "message": "$1 on Blaze",
    "description": "A token's Blaze balance. $1 is the amount"
  },
  "units": {
    "message": "$1 units",
    "description": "An unknown token's balance in its smallest units. $1 is the number"
  },
  "rowUnlisted": {
    "message": "Not on Charisma's token list: hidden from sends",
    "description": "Tooltip on an unlisted token"
  },
  "rowUnknown": {
    "message": "Unknown token: shown in smallest units, not sendable here",
    "description": "Tooltip on an unknown token"
  },
  "rowSend": {
    "message": "Send $1",
    "description": "Tooltip on a token. $1 is its symbol"
  },
  "rowAllOnBlaze": {
    "message": "$1 is all on Blaze: move it with Charisma Swap",
    "description": "Tooltip. $1 is the token's symbol"
  },
  "sendTitle": {
    "message": "Send $1",
    "description": "Card title. $1 is the token's symbol"
  },
  "recipientLabel": {
    "message": "Recipient",
    "description": "Field label"
  },
  "blazeNote": {
    "message": "Sends use your $1 $2 on Standard. Your $3 on Blaze stays in its subnet; move it with Charisma Swap.",
    "description": "Note on the send form. $1 the Standard amount, $2 the symbol, $3 the Blaze amount"
  },
  "sentTitle": {
    "message": "$1 sent",
    "description": "Card title after sending. $1 is the token's symbol"
  },
  "sentNote": {
    "message": "It confirms on Stacks in a few minutes.",
    "description": "After sending"
  },
  "viewOnExplorer": {
    "message": "View on explorer",
    "description": "Link to the block explorer"
  },
  "networkFee": {
    "message": "Network fee",
    "description": "Review label"
  },
  "feeAutomatic": {
    "message": "Set automatically",
    "description": "Value of Network fee"
  },
  "safety": {
    "message": "Safety",
    "description": "Review label"
  },
  "safetyExact": {
    "message": "Exactly this amount, nothing else",
    "description": "Value of Safety: the transaction can't move more than this"
  },
  "sending": {
    "message": "Sending…",
    "description": "Button while sending"
  },
  "errorRecipient": {
    "message": "Enter a Stacks address (SP…)",
    "description": "Error on the send form"
  },
  "errorAmountLike": {
    "message": "Enter an amount like $1",
    "description": "Error. $1 is an example such as 1.5, with this language's decimal mark"
  },
  "errorMaxDecimals_one": {
    "message": "At most $1 decimal place",
    "description": "Error. $1 is the token's decimals"
  },
  "errorMaxDecimals_other": {
    "message": "At most $1 decimal places",
    "description": "Error. $1 is the token's decimals"
  },
  "errorAmountPositive": {
    "message": "Amount must be more than zero",
    "description": "Error"
  },
  "errorYouHave": {
    "message": "You have $1 $2",
    "description": "Error when the amount is more than the balance. $1 the balance, $2 the symbol"
  },
  "checkedAt": {
    "message": "Checked at $1",
    "description": "When the checks ran. $1 is a time"
  },
  "checking": {
    "message": "Checking…",
    "description": "While checks run"
  },
  "checkAgain": {
    "message": "Check again",
    "description": "Button"
  },
  "checkingButton": {
    "message": "Checking",
    "description": "Button while checks run"
  },
  "stateError": {
    "message": "Error",
    "description": "Status pill"
  },
  "stateChecking": {
    "message": "Checking",
    "description": "Status pill"
  },
  "stateLive": {
    "message": "Live",
    "description": "Status pill: everything answered"
  },
  "somethingWrong": {
    "message": "Something isn't working",
    "description": "Card title over an error"
  },
  "stacksNetwork": {
    "message": "Stacks network",
    "description": "Card title"
  },
  "block": {
    "message": "Block",
    "description": "Label: the latest block number"
  },
  "response": {
    "message": "Response",
    "description": "Label: how fast a server answered"
  },
  "tokenListTitle": {
    "message": "Charisma token list",
    "description": "Card title"
  },
  "statusTokens": {
    "message": "Tokens",
    "description": "Label: how many tokens the list has"
  },
  "blazeSubnets": {
    "message": "Blaze subnets",
    "description": "Card title"
  },
  "holdingFunds": {
    "message": "Holding your funds",
    "description": "Label: how many subnets hold your tokens"
  },
  "noFundsOnSubnets_one": {
    "message": "No funds on the $1 subnet.",
    "description": "$1 is the number of subnets"
  },
  "noFundsOnSubnets_other": {
    "message": "No funds on any of the $1 subnets.",
    "description": "$1 is the number of subnets"
  },
  "thisWallet": {
    "message": "This wallet",
    "description": "Card title"
  },
  "autoLockIn_one": {
    "message": "In $1 min",
    "description": "When the wallet locks itself. $1 is minutes"
  },
  "autoLockIn_other": {
    "message": "In $1 min",
    "description": "When the wallet locks itself. $1 is minutes"
  },
  "tabCrashed": {
    "message": "This tab crashed",
    "description": "Card title over a crash report"
  },
  "cardSendStx": {
    "message": "Send STX",
    "description": "Approval card title"
  },
  "cardRunTransaction": {
    "message": "Run a transaction",
    "description": "Approval card title"
  },
  "cardSignOrder": {
    "message": "Sign an order",
    "description": "Approval card title"
  },
  "cardSignOrders_one": {
    "message": "Sign $1 order",
    "description": "Approval card title. $1 is the number of orders"
  },
  "cardSignOrders_other": {
    "message": "Sign $1 orders",
    "description": "Approval card title. $1 is the number of orders"
  },
  "cardSignMessage": {
    "message": "Sign a message",
    "description": "Approval card title"
  },
  "cardConnect": {
    "message": "Connect",
    "description": "Approval card title"
  },
  "approveSign": {
    "message": "Sign",
    "description": "Approve button"
  },
  "approveSignAll": {
    "message": "Sign all",
    "description": "Approve button for many orders"
  },
  "approveConnect": {
    "message": "Connect",
    "description": "Approve button"
  },
  "deny": {
    "message": "Deny",
    "description": "Button: refuse the request"
  },
  "denyAndClose": {
    "message": "Deny and close",
    "description": "Screen reader label of the close button"
  },
  "holdUnlockFirst": {
    "message": "Unlock the wallet first",
    "description": "Approve button while the wallet is locked"
  },
  "holdChecking": {
    "message": "Checking…",
    "description": "Approve button while the card's visibility is checked"
  },
  "lockedNote": {
    "message": "Blaze Wallet is locked. Open it to unlock ›",
    "description": "Link on the card"
  },
  "coveredNote": {
    "message": "Something is covering this card. Continue in a Blaze Wallet window ›",
    "description": "Link on the card"
  },
  "errorNoAnswer": {
    "message": "Blaze Wallet did not answer",
    "description": "Error"
  },
  "riskLow": {
    "message": "Low risk",
    "description": "Pill on the card"
  },
  "riskReview": {
    "message": "Review carefully",
    "description": "Pill on the card"
  },
  "askConnect": {
    "message": "$1 wants to connect to Blaze Wallet",
    "description": "$1 is the website"
  },
  "askSignMessage": {
    "message": "$1 wants you to sign this message",
    "description": "$1 is the website"
  },
  "askSignOrder": {
    "message": "$1 wants you to sign a subnet order",
    "description": "$1 is the website"
  },
  "askSignData": {
    "message": "$1 wants you to sign data for $2",
    "description": "$1 is the website, $2 the app the data is for"
  },
  "askSignOrders_one": {
    "message": "$1 wants you to sign $2 subnet order",
    "description": "$1 is the website, $2 the number of orders"
  },
  "askSignOrders_other": {
    "message": "$1 wants you to sign $2 subnet orders",
    "description": "$1 is the website, $2 the number of orders"
  },
  "askSendStx": {
    "message": "$1 wants you to send STX",
    "description": "$1 is the website"
  },
  "askRunTransaction": {
    "message": "$1 wants you to run a transaction",
    "description": "$1 is the website"
  },
  "shareAddressAs": {
    "message": "Share your address $1",
    "description": "$1 is the shortened address"
  },
  "shareAddress": {
    "message": "Share your address",
    "description": "When there's no active account"
  },
  "cantMoveFunds": {
    "message": "It can't move funds: every signature asks you first",
    "description": "Reassurance on the connect card"
  },
  "signsAs": {
    "message": "Signs as $1",
    "description": "$1 is the shortened address"
  },
  "signsWithActive": {
    "message": "Signs with your active account",
    "description": "When the address isn't known yet"
  },
  "messageMovesNothing": {
    "message": "Signing a message doesn't move funds",
    "description": "Reassurance"
  },
  "payoutOnlyYou": {
    "message": "Only to you",
    "description": "Who a signed order can pay out to"
  },
  "payoutSubmitter": {
    "message": "Wherever the submitter chooses",
    "description": "Who a signed order can pay out to (a warning)"
  },
  "orderAction": {
    "message": "Action",
    "description": "Label"
  },
  "orderToken": {
    "message": "Token",
    "description": "Label"
  },
  "amountSmallestUnits": {
    "message": "Amount (smallest units)",
    "description": "Label for an unknown token's amount"
  },
  "sendsTo": {
    "message": "Sends to",
    "description": "Label: the order pays straight to this address"
  },
  "payout": {
    "message": "Payout",
    "description": "Label: where the order's funds can go"
  },
  "handledBy": {
    "message": "Handled by $1",
    "description": "$1 is a contract's name"
  },
  "orderId": {
    "message": "Order ID",
    "description": "Label"
  },
  "orderData": {
    "message": "Data",
    "description": "Label for unrecognized signed data"
  },
  "signsAsSentence": {
    "message": "Signs as $1.",
    "description": "A sentence before the next one. $1 is the shortened address"
  },
  "orderRunsOnce": {
    "message": "Anyone holding this signature can run this order once.",
    "description": "Note"
  },
  "signOnlyRecognized": {
    "message": "Only sign data you recognize.",
    "description": "Note"
  },
  "ordersCount": {
    "message": "Orders",
    "description": "Label: how many orders"
  },
  "canSpendTotal": {
    "message": "Can spend in total",
    "description": "Label"
  },
  "smallestUnitsOf": {
    "message": "$1 (smallest units of $2)",
    "description": "$1 is a number, $2 a token's contract name"
  },
  "ordersRunOnce": {
    "message": "Anyone holding these signatures can run each order once.",
    "description": "Note"
  },
  "memo": {
    "message": "Memo",
    "description": "Label"
  },
  "contract": {
    "message": "Contract",
    "description": "Label"
  },
  "function": {
    "message": "Function",
    "description": "Label: the contract function called"
  },
  "argument": {
    "message": "Arg $1",
    "description": "Label: a function argument. $1 is its position"
  },
  "allowMode": {
    "message": "⚠ Any of your tokens could move (allow mode)",
    "description": "Warning: the transaction has no limit on what leaves the wallet"
  },
  "onlyTheseTransfers": {
    "message": "Only these transfers can happen:",
    "description": "Heading over the transaction's allowed transfers"
  },
  "noTokensLeave": {
    "message": "No tokens can leave your wallet",
    "description": "When a transaction allows no transfers"
  },
  "sentFrom": {
    "message": "Sent from $1.",
    "description": "A sentence before the next one. $1 is the shortened address"
  },
  "feeSetAutomatically": {
    "message": "Network fee is set automatically.",
    "description": "Note"
  },
  "tokenSmallestUnits": {
    "message": "$1 $2 (smallest units)",
    "description": "$1 is a number, $2 a token's asset name"
  },
  "pcYouSendExactly": {
    "message": "You send exactly $1",
    "description": "A transfer the transaction allows. $1 is an amount with its token"
  },
  "pcTheySendExactly": {
    "message": "$1 sends exactly $2",
    "description": "A transfer the transaction allows. $1 is who sends (an address or contract), $2 an amount with its token"
  },
  "pcYouSendMoreThan": {
    "message": "You send more than $1",
    "description": "A transfer the transaction allows. $1 is an amount with its token"
  },
  "pcTheySendMoreThan": {
    "message": "$1 sends more than $2",
    "description": "A transfer the transaction allows. $1 is who sends (an address or contract), $2 an amount with its token"
  },
  "pcYouSendAtLeast": {
    "message": "You send at least $1",
    "description": "A transfer the transaction allows. $1 is an amount with its token"
  },
  "pcTheySendAtLeast": {
    "message": "$1 sends at least $2",
    "description": "A transfer the transaction allows. $1 is who sends (an address or contract), $2 an amount with its token"
  },
  "pcYouSendLessThan": {
    "message": "You send less than $1",
    "description": "A transfer the transaction allows. $1 is an amount with its token"
  },
  "pcTheySendLessThan": {
    "message": "$1 sends less than $2",
    "description": "A transfer the transaction allows. $1 is who sends (an address or contract), $2 an amount with its token"
  },
  "pcYouSendAtMost": {
    "message": "You send at most $1",
    "description": "A transfer the transaction allows. $1 is an amount with its token"
  },
  "pcTheySendAtMost": {
    "message": "$1 sends at most $2",
    "description": "A transfer the transaction allows. $1 is who sends (an address or contract), $2 an amount with its token"
  },
  "pcYouSendNft": {
    "message": "You send $1 $2",
    "description": "An NFT transfer the transaction allows. $1 the collection, $2 the item"
  },
  "pcTheySendNft": {
    "message": "$1 sends $2 $3",
    "description": "An NFT transfer. $1 who sends, $2 the collection, $3 the item"
  },
  "pcYouKeepNft": {
    "message": "You keep $1 $2",
    "description": "An NFT the transaction can't move. $1 the collection, $2 the item"
  },
  "pcTheyKeepNft": {
    "message": "$1 keeps $2 $3",
    "description": "An NFT the transaction can't move. $1 who, $2 the collection, $3 the item"
  },
  "pcStacking": {
    "message": "$1: stacking condition",
    "description": "$1 is who, or the word You"
  },
  "pcYou": {
    "message": "You",
    "description": "Who sends, in pcStacking"
  },
  "errorUnexpected": {
    "message": "Something went wrong: $1",
    "description": "Lead-in for an error from a library or a server. $1 is its own text (often English)"
  },
  "errorInvalidSeedPhrase": {
    "message": "That isn't a valid seed phrase: check each word's spelling and that none are missing",
    "description": "Error"
  },
  "errorSeedNotFound": {
    "message": "Seed phrase not found",
    "description": "Error"
  },
  "errorNoActiveAccount": {
    "message": "Blaze Wallet has no active account",
    "description": "Error"
  },
  "errorStacksUnavailable": {
    "message": "Stacks network unavailable (Hiro $1)",
    "description": "Error. $1 is an HTTP status"
  },
  "errorTokenCacheEmpty": {
    "message": "Charisma's token cache returned no tokens",
    "description": "Error"
  },
  "errorLocked": {
    "message": "Wallet is locked",
    "description": "Error"
  },
  "errorLockedIdle": {
    "message": "Wallet locked after 15 minutes of inactivity",
    "description": "Error"
  },
  "errorPasswordShort": {
    "message": "Password must be at least $1 characters",
    "description": "Error. $1 is the minimum length (8)"
  },
  "errorWrongPassword": {
    "message": "Wrong password",
    "description": "Error"
  },
  "errorNoWallet": {
    "message": "No wallet yet",
    "description": "Error"
  },
  "errorSeedNameTaken": {
    "message": "A seed phrase named “$1” already exists",
    "description": "Error. $1 is the name"
  },
  "errorAccountNotFound": {
    "message": "Account not found",
    "description": "Error"
  },
  "errorBalances": {
    "message": "Couldn't load balances ($1)",
    "description": "Error. $1 is an HTTP status"
  },
  "errorTokenListUnavailable": {
    "message": "Charisma's token list is unavailable, so tokens can't be checked against the block list",
    "description": "Error"
  },
  "errorRejected": {
    "message": "The network rejected the transfer: $1",
    "description": "Error. $1 is the network's own reason (English)"
  },
  "errorRequestGone": {
    "message": "This request is no longer waiting",
    "description": "Error on an approval card the site already closed"
  }
}
```

- [ ] **Write the eight translations.** They're compact here, `{ key: message }` in English's order, and a script writes each one in Chrome's format with English's descriptions. Write each block to `/tmp/blaze-ext-translations/{folder}.json` (temporary: the locale files keep the result).

`/tmp/blaze-ext-translations/ko.json` (Korean):

```json
{
 "extensionDescription": "Stacks에서 더 많은 일을 해 보세요. 지정가 주문과 예약 매수에 한 번만 서명하면 알아서 실행되고, 온체인에서 정산되며, 본인에게만 지급됩니다.",
 "back": "뒤로",
 "cancel": "취소",
 "continue": "계속",
 "done": "완료",
 "copy": "복사",
 "copied": "복사됨",
 "import": "가져오기",
 "unlink": "연결 해제",
 "use": "사용",
 "active": "사용 중",
 "tryAgain": "다시 시도",
 "name": "이름",
 "send": "보내기",
 "to": "받는 사람",
 "amount": "수량",
 "lock": "잠금",
 "review": "검토",
 "max": "최대",
 "address": "주소",
 "tabWallet": "지갑",
 "tabTokens": "토큰",
 "tabStatus": "상태",
 "lockTheWallet": "지갑 잠그기",
 "unlockLocked": "잠겨 있습니다. 계속하려면 비밀번호를 입력하세요.",
 "unlockChoosePassword": "이 지갑을 보호할 비밀번호를 설정하세요.",
 "unlockTitle": "잠금 해제",
 "createWalletTitle": "지갑 만들기",
 "passwordLabel": "비밀번호",
 "newPasswordLabel": "새 비밀번호($1자 이상)",
 "passwordPlaceholder": "비밀번호 입력",
 "newPasswordPlaceholder": "강력한 비밀번호",
 "passwordAgainLabel": "다시 입력",
 "passwordAgainPlaceholder": "같은 비밀번호",
 "unlockButton": "잠금 해제",
 "createWalletButton": "지갑 만들기",
 "passwordShow": "표시",
 "passwordHide": "숨기기",
 "errorPasswordsDontMatch": "비밀번호가 일치하지 않습니다",
 "importTitle": "시드 문구 가져오기",
 "seedNamePlaceholder": "내 시드 문구",
 "importWordsLabel": "단어 12개 또는 24개",
 "importWordsPlaceholder": "word word word …",
 "errorSeedNotSaved": "시드 문구가 저장되지 않았습니다",
 "newSeedTitle": "새 시드 문구",
 "generateWords": "단어 24개 생성",
 "writeDownTitle": "이 단어를 적어 두세요",
 "writeDownWarning": "이 24개 단어는 이 지갑을 복구할 수 있는 유일한 방법입니다. 이 단어를 보는 사람은 누구나 자금을 마음대로 움직일 수 있으며, Blaze Wallet은 이 단어를 복구할 수 없습니다.",
 "wroteDown": "단어 24개를 모두 순서대로 적었습니다",
 "confirmTitle": "단어 확인",
 "confirmNote": "적어 둔 내용을 보고 아래 단어를 입력하세요.",
 "wordNumber": "단어 #$1",
 "errorWordsDontMatch": "일치하지 않는 단어: $1. 적어 둔 내용을 확인하세요",
 "confirmAndSave": "확인 후 저장",
 "newAccountTitle": "새 계정",
 "newAccountNote": "이 시드 문구의 다음 주소가 사용 중인 계정이 됩니다.",
 "createAccount": "계정 만들기",
 "accountName": "계정 $1",
 "noActiveAccount": "사용 중인 계정 없음",
 "addAccountHint": "아래 시드 문구에서 계정을 추가하세요.",
 "seedPhrasesTitle": "시드 문구",
 "noSeedPhrases": "아직 없습니다. 새로 생성하거나 가지고 있는 시드 문구를 가져오세요.",
 "addAccount": "+ 계정",
 "generateNew": "새로 생성",
 "confirmUnlinkSeed": "이 브라우저에서 이 시드 문구를 연결 해제하겠습니까?\n\n이 시드 문구의 계정과 자금은 블록체인에 안전하게 남아 있습니다. 여기서 다시 사용하려면 시드 문구의 단어가 필요합니다.",
 "vaultTitle": "보관함",
 "vaultKeys": "키",
 "vaultKeysValue": "암호화됨, 이 기기에만",
 "vaultAutoLock": "자동 잠금",
 "vaultAutoLockValue": "15분 동안 사용하지 않으면",
 "exportButton": "내보내기",
 "exportDone": "지갑을 내보냈습니다",
 "exportFailed": "지갑을 내보내지 못했습니다",
 "confirmUnlinkWallet": "이 브라우저에서 이 지갑을 연결 해제하겠습니까?\n\n모든 시드 문구와 계정이 이 기기에서 제거됩니다. 자금은 블록체인에 안전하게 남아 있으며, 다시 접근하려면 시드 문구가 필요합니다.",
 "themeLabel": "테마",
 "themeSystem": "시스템",
 "themeSystemTitle": "이 기기 설정 따르기",
 "themeLight": "라이트",
 "themeLightTitle": "라이트 · Bitcoin",
 "themeDark": "다크",
 "themeDarkTitle": "다크 · RPG",
 "languageLabel": "언어",
 "languageAutomatic": "자동",
 "tokensTitle": "토큰",
 "refresh": "새로고침",
 "refreshTitle": "잔액 새로고침",
 "totalValue": "총 평가액",
 "tokenCount_other": "토큰 $1개",
 "withoutPrice_other": "가격 정보 없음 $1개",
 "loadingBalances": "잔액 불러오는 중…",
 "pricesUnavailable": "가격 정보를 사용할 수 없음: $1",
 "unlisted_other": "목록에 없음 $1개 · Charisma 토큰 목록에 없으며, 사기일 수 있습니다",
 "onBlaze": "Blaze에 있는 $1",
 "units": "$1 단위",
 "rowUnlisted": "Charisma 토큰 목록에 없어 여기서 보낼 수 없습니다",
 "rowUnknown": "알 수 없는 토큰입니다. 가장 작은 단위로 표시되며, 여기서 보낼 수 없습니다",
 "rowSend": "$1 보내기",
 "rowAllOnBlaze": "$1 잔액은 모두 Blaze에 있습니다. Charisma Swap을 사용해 옮기세요",
 "sendTitle": "$1 보내기",
 "recipientLabel": "받는 사람",
 "blazeNote": "보내기에는 일반 잔액($1 $2)이 사용됩니다. Blaze에 있는 잔액($3)은 해당 서브넷에 그대로 남습니다. Charisma Swap을 사용해 옮기세요.",
 "sentTitle": "$1 보내기 완료",
 "sentNote": "몇 분 안에 Stacks에서 확정됩니다.",
 "viewOnExplorer": "탐색기에서 보기",
 "networkFee": "네트워크 수수료",
 "feeAutomatic": "자동 설정",
 "safety": "안전",
 "safetyExact": "정확히 이 수량만, 그 이상은 없음",
 "sending": "보내는 중…",
 "errorRecipient": "Stacks 주소(SP…)를 입력하세요",
 "errorAmountLike": "수량은 $1 같은 형식으로 입력하세요",
 "errorMaxDecimals_other": "소수점 이하는 $1자리까지만 입력할 수 있습니다",
 "errorAmountPositive": "수량은 0보다 커야 합니다",
 "errorYouHave": "보유 잔액: $1 $2",
 "checkedAt": "확인 시각: $1",
 "checking": "확인 중…",
 "checkAgain": "다시 확인",
 "checkingButton": "확인 중",
 "stateError": "오류",
 "stateChecking": "확인 중",
 "stateLive": "정상",
 "somethingWrong": "문제가 있습니다",
 "stacksNetwork": "Stacks 네트워크",
 "block": "블록",
 "response": "응답 시간",
 "tokenListTitle": "Charisma 토큰 목록",
 "statusTokens": "토큰 수",
 "blazeSubnets": "Blaze 서브넷",
 "holdingFunds": "자금 보유 중",
 "noFundsOnSubnets_other": "서브넷 $1개 중 어디에도 자금이 없습니다.",
 "thisWallet": "이 지갑",
 "autoLockIn_other": "$1분 후",
 "tabCrashed": "이 탭에서 오류가 발생했습니다",
 "cardSendStx": "STX 보내기",
 "cardRunTransaction": "트랜잭션 실행",
 "cardSignOrder": "주문 서명",
 "cardSignOrders_other": "주문 $1개 서명",
 "cardSignMessage": "메시지 서명",
 "cardConnect": "연결",
 "approveSign": "서명",
 "approveSignAll": "모두 서명",
 "approveConnect": "연결",
 "deny": "거부",
 "denyAndClose": "거부하고 닫기",
 "holdUnlockFirst": "먼저 지갑 잠금 해제",
 "holdChecking": "확인 중…",
 "lockedNote": "Blaze Wallet이 잠겨 있습니다. 열어서 잠금을 해제하세요 ›",
 "coveredNote": "무언가가 이 카드를 가리고 있습니다. Blaze Wallet 창에서 계속하세요 ›",
 "errorNoAnswer": "Blaze Wallet이 응답하지 않았습니다",
 "riskLow": "위험 낮음",
 "riskReview": "신중히 검토",
 "askConnect": "$1 사이트에서 Blaze Wallet에 연결하려고 합니다",
 "askSignMessage": "$1 사이트에서 이 메시지에 서명을 요청합니다",
 "askSignOrder": "$1 사이트에서 서브넷 주문에 서명을 요청합니다",
 "askSignData": "$1 사이트에서 $2 앱용 데이터에 서명을 요청합니다",
 "askSignOrders_other": "$1 사이트에서 서브넷 주문 $2개에 서명을 요청합니다",
 "askSendStx": "$1 사이트에서 STX 보내기를 요청합니다",
 "askRunTransaction": "$1 사이트에서 트랜잭션 실행을 요청합니다",
 "shareAddressAs": "내 주소($1)를 공유합니다",
 "shareAddress": "내 주소를 공유합니다",
 "cantMoveFunds": "연결해도 자금은 옮길 수 없습니다. 서명할 때마다 먼저 확인을 요청합니다",
 "signsAs": "$1 주소로 서명합니다",
 "signsWithActive": "사용 중인 계정으로 서명합니다",
 "messageMovesNothing": "메시지에 서명해도 자금은 이동하지 않습니다",
 "payoutOnlyYou": "본인에게만",
 "payoutSubmitter": "제출자가 선택하는 곳이면 어디로든",
 "orderAction": "작업",
 "orderToken": "토큰",
 "amountSmallestUnits": "수량(최소 단위)",
 "sendsTo": "받는 주소",
 "payout": "지급 대상",
 "handledBy": "$1 컨트랙트에서 처리",
 "orderId": "주문 ID",
 "orderData": "데이터",
 "signsAsSentence": "$1 주소로 서명합니다.",
 "orderRunsOnce": "이 서명을 가진 사람은 누구나 이 주문을 한 번 실행할 수 있습니다.",
 "signOnlyRecognized": "내용을 알고 있는 데이터에만 서명하세요.",
 "ordersCount": "주문 수",
 "canSpendTotal": "총 지출 가능 수량",
 "smallestUnitsOf": "$1($2 최소 단위)",
 "ordersRunOnce": "이 서명들을 가진 사람은 누구나 각 주문을 한 번씩 실행할 수 있습니다.",
 "memo": "메모",
 "contract": "컨트랙트",
 "function": "함수",
 "argument": "인수 $1",
 "allowMode": "⚠ 보유한 어떤 토큰이든 이동될 수 있습니다(허용 모드)",
 "onlyTheseTransfers": "다음 전송만 가능합니다:",
 "noTokensLeave": "지갑에서 토큰이 나갈 수 없습니다",
 "sentFrom": "$1 주소에서 전송됩니다.",
 "feeSetAutomatically": "네트워크 수수료는 자동으로 설정됩니다.",
 "tokenSmallestUnits": "$1 $2(최소 단위)",
 "pcYouSendExactly": "내 계정: 정확히 $1 보냄",
 "pcTheySendExactly": "$1: 정확히 $2 보냄",
 "pcYouSendMoreThan": "내 계정: $1 초과 보냄",
 "pcTheySendMoreThan": "$1: $2 초과 보냄",
 "pcYouSendAtLeast": "내 계정: $1 이상 보냄",
 "pcTheySendAtLeast": "$1: $2 이상 보냄",
 "pcYouSendLessThan": "내 계정: $1 미만 보냄",
 "pcTheySendLessThan": "$1: $2 미만 보냄",
 "pcYouSendAtMost": "내 계정: $1 이하 보냄",
 "pcTheySendAtMost": "$1: $2 이하 보냄",
 "pcYouSendNft": "내 계정: $1 $2 보냄",
 "pcTheySendNft": "$1: $2 $3 보냄",
 "pcYouKeepNft": "내 계정: $1 $2 계속 보유",
 "pcTheyKeepNft": "$1: $2 $3 계속 보유",
 "pcStacking": "$1: 스태킹 조건",
 "pcYou": "내 계정",
 "errorUnexpected": "문제가 발생했습니다: $1",
 "errorInvalidSeedPhrase": "유효한 시드 문구가 아닙니다. 각 단어의 철자가 맞는지, 빠진 단어가 없는지 확인하세요",
 "errorSeedNotFound": "시드 문구를 찾을 수 없습니다",
 "errorNoActiveAccount": "Blaze Wallet에 사용 중인 계정이 없습니다",
 "errorStacksUnavailable": "Stacks 네트워크를 사용할 수 없습니다(Hiro $1)",
 "errorTokenCacheEmpty": "Charisma 토큰 캐시에서 받은 토큰이 없습니다",
 "errorLocked": "지갑이 잠겨 있습니다",
 "errorLockedIdle": "15분 동안 사용하지 않아 지갑이 잠겼습니다",
 "errorPasswordShort": "비밀번호는 $1자 이상이어야 합니다",
 "errorWrongPassword": "비밀번호가 올바르지 않습니다",
 "errorNoWallet": "아직 지갑이 없습니다",
 "errorSeedNameTaken": "이름이 ‘$1’인 시드 문구가 이미 있습니다",
 "errorAccountNotFound": "계정을 찾을 수 없습니다",
 "errorBalances": "잔액을 불러오지 못했습니다($1)",
 "errorTokenListUnavailable": "Charisma 토큰 목록을 사용할 수 없어 토큰을 차단 목록과 대조할 수 없습니다",
 "errorRejected": "네트워크가 전송을 거부했습니다: $1",
 "errorRequestGone": "이 요청은 더 이상 대기 중이 아닙니다"
}
```

`/tmp/blaze-ext-translations/zh_CN.json` (Simplified Chinese):

```json
{
 "extensionDescription": "在 Stacks 上做得更多。限价单和定时买入只需签名一次，便会自动执行，在链上结算，且只付给你。",
 "back": "返回",
 "cancel": "取消",
 "continue": "继续",
 "done": "完成",
 "copy": "复制",
 "copied": "已复制",
 "import": "导入",
 "unlink": "取消关联",
 "use": "使用",
 "active": "使用中",
 "tryAgain": "重试",
 "name": "名称",
 "send": "发送",
 "to": "收款人",
 "amount": "数量",
 "lock": "锁定",
 "review": "核对",
 "max": "最大",
 "address": "地址",
 "tabWallet": "钱包",
 "tabTokens": "代币",
 "tabStatus": "状态",
 "lockTheWallet": "锁定钱包",
 "unlockLocked": "已锁定。请输入密码以继续。",
 "unlockChoosePassword": "请设置一个密码来保护此钱包。",
 "unlockTitle": "解锁",
 "createWalletTitle": "创建钱包",
 "passwordLabel": "密码",
 "newPasswordLabel": "新密码（至少 $1 个字符）",
 "passwordPlaceholder": "你的密码",
 "newPasswordPlaceholder": "设置一个强密码",
 "passwordAgainLabel": "再输入一次",
 "passwordAgainPlaceholder": "相同的密码",
 "unlockButton": "解锁",
 "createWalletButton": "创建钱包",
 "passwordShow": "显示",
 "passwordHide": "隐藏",
 "errorPasswordsDontMatch": "两次输入的密码不一致",
 "importTitle": "导入助记词",
 "seedNamePlaceholder": "我的助记词",
 "importWordsLabel": "12 或 24 个单词",
 "importWordsPlaceholder": "word word word …",
 "errorSeedNotSaved": "助记词未保存",
 "newSeedTitle": "新助记词",
 "generateWords": "生成 24 个单词",
 "writeDownTitle": "抄下这些单词",
 "writeDownWarning": "这 24 个单词是恢复此钱包的唯一方式。任何看到它们的人都能控制你的资金，而且 Blaze Wallet 无法找回它们。",
 "wroteDown": "我已按顺序抄下全部 24 个单词",
 "confirmTitle": "确认单词",
 "confirmNote": "请根据你抄下的内容输入这些单词。",
 "wordNumber": "第 $1 个单词",
 "errorWordsDontMatch": "单词 $1 不匹配。请检查你抄下的内容",
 "confirmAndSave": "确认并保存",
 "newAccountTitle": "新账户",
 "newAccountNote": "此助记词的下一个地址将成为使用中的账户。",
 "createAccount": "创建账户",
 "accountName": "账户 $1",
 "noActiveAccount": "没有使用中的账户",
 "addAccountHint": "请从下方的助记词添加账户。",
 "seedPhrasesTitle": "助记词",
 "noSeedPhrases": "还没有助记词。生成一个新的，或导入你自己的。",
 "addAccount": "+ 账户",
 "generateNew": "生成新助记词",
 "confirmUnlinkSeed": "要将此助记词与此浏览器取消关联吗？\n\n该助记词下的账户和资金仍安全地保存在区块链上。要在此再次使用它们，你需要这组助记词。",
 "vaultTitle": "保险库",
 "vaultKeys": "密钥",
 "vaultKeysValue": "已加密，仅保存在此设备上",
 "vaultAutoLock": "自动锁定",
 "vaultAutoLockValue": "闲置 15 分钟后",
 "exportButton": "导出",
 "exportDone": "钱包已导出",
 "exportFailed": "无法导出钱包",
 "confirmUnlinkWallet": "要将此钱包与此浏览器取消关联吗？\n\n所有助记词和账户都将从此设备上移除。你的资金仍安全地保存在区块链上；你需要凭助记词才能重新访问。",
 "themeLabel": "主题",
 "themeSystem": "跟随系统",
 "themeSystemTitle": "跟随此设备的设置",
 "themeLight": "浅色",
 "themeLightTitle": "浅色 · Bitcoin",
 "themeDark": "深色",
 "themeDarkTitle": "深色 · RPG",
 "languageLabel": "语言",
 "languageAutomatic": "自动",
 "tokensTitle": "代币",
 "refresh": "刷新",
 "refreshTitle": "刷新余额",
 "totalValue": "总价值",
 "tokenCount_other": "$1 个代币",
 "withoutPrice_other": "$1 个暂无价格",
 "loadingBalances": "正在加载余额…",
 "pricesUnavailable": "价格不可用：$1",
 "unlisted_other": "$1 个未收录 · 不在 Charisma 代币列表中，可能是诈骗代币",
 "onBlaze": "$1 在 Blaze 上",
 "units": "$1 个单位",
 "rowUnlisted": "不在 Charisma 代币列表中：无法在此发送",
 "rowUnknown": "未知代币：以最小单位显示，无法在此发送",
 "rowSend": "发送 $1",
 "rowAllOnBlaze": "$1 全部在 Blaze 上：请使用 Charisma Swap 转移",
 "sendTitle": "发送 $1",
 "recipientLabel": "收款人",
 "blazeNote": "发送使用的是你标准余额中的 $1 $2。你在 Blaze 上的 $3 会留在其子网中；可使用 Charisma Swap 转移。",
 "sentTitle": "$1 已发送",
 "sentNote": "交易几分钟内就会在 Stacks 上确认。",
 "viewOnExplorer": "在区块浏览器中查看",
 "networkFee": "网络手续费",
 "feeAutomatic": "自动设置",
 "safety": "安全",
 "safetyExact": "只转出这个数量，不多不少",
 "sending": "正在发送…",
 "errorRecipient": "请输入 Stacks 地址（SP…）",
 "errorAmountLike": "请输入数量，例如 $1",
 "errorMaxDecimals_other": "最多 $1 位小数",
 "errorAmountPositive": "数量必须大于零",
 "errorYouHave": "你的余额为 $1 $2",
 "checkedAt": "检查于 $1",
 "checking": "正在检查…",
 "checkAgain": "重新检查",
 "checkingButton": "检查中",
 "stateError": "出错",
 "stateChecking": "检查中",
 "stateLive": "在线",
 "somethingWrong": "出现问题",
 "stacksNetwork": "Stacks 网络",
 "block": "区块",
 "response": "响应时间",
 "tokenListTitle": "Charisma 代币列表",
 "statusTokens": "代币数量",
 "blazeSubnets": "Blaze 子网",
 "holdingFunds": "存有你资金的子网",
 "noFundsOnSubnets_other": "$1 个子网中没有任何资金。",
 "thisWallet": "此钱包",
 "autoLockIn_other": "$1 分钟后",
 "tabCrashed": "此页面已崩溃",
 "cardSendStx": "发送 STX",
 "cardRunTransaction": "执行交易",
 "cardSignOrder": "签署订单",
 "cardSignOrders_other": "签署 $1 个订单",
 "cardSignMessage": "签署消息",
 "cardConnect": "连接",
 "approveSign": "签名",
 "approveSignAll": "全部签名",
 "approveConnect": "连接",
 "deny": "拒绝",
 "denyAndClose": "拒绝并关闭",
 "holdUnlockFirst": "请先解锁钱包",
 "holdChecking": "正在检查…",
 "lockedNote": "Blaze Wallet 已锁定。打开钱包以解锁 ›",
 "coveredNote": "有内容遮挡了此卡片。请在 Blaze Wallet 窗口中继续 ›",
 "errorNoAnswer": "Blaze Wallet 未响应",
 "riskLow": "低风险",
 "riskReview": "请仔细核对",
 "askConnect": "$1 请求连接到 Blaze Wallet",
 "askSignMessage": "$1 请求你签署这条消息",
 "askSignOrder": "$1 请求你签署一个子网订单",
 "askSignData": "$1 请求你为 $2 签署数据",
 "askSignOrders_other": "$1 请求你签署 $2 个子网订单",
 "askSendStx": "$1 请求你发送 STX",
 "askRunTransaction": "$1 请求你执行一笔交易",
 "shareAddressAs": "分享你的地址 $1",
 "shareAddress": "分享你的地址",
 "cantMoveFunds": "无法转移资金：每次签名都会先征得你的同意",
 "signsAs": "以 $1 签名",
 "signsWithActive": "以使用中的账户签名",
 "messageMovesNothing": "签署消息不会转移资金",
 "payoutOnlyYou": "只付给你",
 "payoutSubmitter": "由提交者任意指定",
 "orderAction": "操作",
 "orderToken": "代币",
 "amountSmallestUnits": "数量（最小单位）",
 "sendsTo": "发送至",
 "payout": "资金去向",
 "handledBy": "由 $1 处理",
 "orderId": "订单 ID",
 "orderData": "数据",
 "signsAsSentence": "以 $1 签名。",
 "orderRunsOnce": "任何持有此签名的人都可以执行此订单一次。",
 "signOnlyRecognized": "只签署你认得的数据。",
 "ordersCount": "订单数量",
 "canSpendTotal": "合计可花费",
 "smallestUnitsOf": "$1（$2 的最小单位）",
 "ordersRunOnce": "任何持有这些签名的人都可以将每个订单执行一次。",
 "memo": "备注",
 "contract": "合约",
 "function": "函数",
 "argument": "参数 $1",
 "allowMode": "⚠ 你的任何代币都可能被转走（允许模式）",
 "onlyTheseTransfers": "只能发生以下转账：",
 "noTokensLeave": "任何代币都无法离开你的钱包",
 "sentFrom": "从 $1 发出。",
 "feeSetAutomatically": "网络手续费会自动设置。",
 "tokenSmallestUnits": "$1 $2（最小单位）",
 "pcYouSendExactly": "你将恰好发送 $1",
 "pcTheySendExactly": "$1 将恰好发送 $2",
 "pcYouSendMoreThan": "你将发送超过 $1",
 "pcTheySendMoreThan": "$1 将发送超过 $2",
 "pcYouSendAtLeast": "你将至少发送 $1",
 "pcTheySendAtLeast": "$1 将至少发送 $2",
 "pcYouSendLessThan": "你将发送少于 $1",
 "pcTheySendLessThan": "$1 将发送少于 $2",
 "pcYouSendAtMost": "你将最多发送 $1",
 "pcTheySendAtMost": "$1 将最多发送 $2",
 "pcYouSendNft": "你将发送 $1 $2",
 "pcTheySendNft": "$1 将发送 $2 $3",
 "pcYouKeepNft": "你将保留 $1 $2",
 "pcTheyKeepNft": "$1 将保留 $2 $3",
 "pcStacking": "$1：Stacking 条件",
 "pcYou": "你",
 "errorUnexpected": "出错了：$1",
 "errorInvalidSeedPhrase": "这不是有效的助记词：请检查每个单词的拼写，并确认没有遗漏",
 "errorSeedNotFound": "未找到助记词",
 "errorNoActiveAccount": "Blaze Wallet 没有使用中的账户",
 "errorStacksUnavailable": "Stacks 网络不可用（Hiro $1）",
 "errorTokenCacheEmpty": "Charisma 代币缓存未返回任何代币",
 "errorLocked": "钱包已锁定",
 "errorLockedIdle": "钱包闲置 15 分钟后已锁定",
 "errorPasswordShort": "密码至少需要 $1 个字符",
 "errorWrongPassword": "密码错误",
 "errorNoWallet": "尚无钱包",
 "errorSeedNameTaken": "已存在名为“$1”的助记词",
 "errorAccountNotFound": "未找到账户",
 "errorBalances": "无法加载余额（$1）",
 "errorTokenListUnavailable": "Charisma 代币列表不可用，因此无法对照屏蔽列表检查代币",
 "errorRejected": "网络拒绝了这笔转账：$1",
 "errorRequestGone": "此请求已不再等待处理"
}
```

`/tmp/blaze-ext-translations/es.json` (Spanish):

```json
{
 "extensionDescription": "Haz más en Stacks. Firma una vez órdenes límite y compras programadas automáticas, liquidadas on-chain y pagadas solo a ti.",
 "back": "Atrás",
 "cancel": "Cancelar",
 "continue": "Continuar",
 "done": "Listo",
 "copy": "Copiar",
 "copied": "Copiado",
 "import": "Importar",
 "unlink": "Desvincular",
 "use": "Usar",
 "active": "Activa",
 "tryAgain": "Reintentar",
 "name": "Nombre",
 "send": "Enviar",
 "to": "Para",
 "amount": "Cantidad",
 "lock": "Bloquear",
 "review": "Revisar",
 "max": "Máx.",
 "address": "Dirección",
 "tabWallet": "Billetera",
 "tabTokens": "Tokens",
 "tabStatus": "Estado",
 "lockTheWallet": "Bloquear la billetera",
 "unlockLocked": "Bloqueada. Ingresa tu contraseña para continuar.",
 "unlockChoosePassword": "Elige una contraseña para proteger esta billetera.",
 "unlockTitle": "Desbloquear",
 "createWalletTitle": "Crear tu billetera",
 "passwordLabel": "Contraseña",
 "newPasswordLabel": "Nueva contraseña ($1 caracteres o más)",
 "passwordPlaceholder": "Tu contraseña",
 "newPasswordPlaceholder": "Una contraseña segura",
 "passwordAgainLabel": "Vuelve a escribirla",
 "passwordAgainPlaceholder": "La misma contraseña",
 "unlockButton": "Desbloquear",
 "createWalletButton": "Crear billetera",
 "passwordShow": "Mostrar",
 "passwordHide": "Ocultar",
 "errorPasswordsDontMatch": "Las contraseñas no coinciden",
 "importTitle": "Importar frase semilla",
 "seedNamePlaceholder": "Mi frase semilla",
 "importWordsLabel": "12 o 24 palabras",
 "importWordsPlaceholder": "word word word …",
 "errorSeedNotSaved": "No se guardó la frase semilla",
 "newSeedTitle": "Nueva frase semilla",
 "generateWords": "Generar 24 palabras",
 "writeDownTitle": "Anota estas palabras",
 "writeDownWarning": "Estas 24 palabras son la única forma de recuperar esta billetera. Cualquiera que las vea controla tus fondos, y Blaze Wallet no puede recuperarlas.",
 "wroteDown": "Anoté las 24 palabras, en orden",
 "confirmTitle": "Confirma tus palabras",
 "confirmNote": "Escribe estas palabras a partir de lo que anotaste.",
 "wordNumber": "Palabra #$1",
 "errorWordsDontMatch": "La palabra $1 no coincide. Revisa lo que anotaste",
 "confirmAndSave": "Confirmar y guardar",
 "newAccountTitle": "Nueva cuenta",
 "newAccountNote": "La siguiente dirección de esta frase semilla pasa a ser tu cuenta activa.",
 "createAccount": "Crear cuenta",
 "accountName": "Cuenta $1",
 "noActiveAccount": "Ninguna cuenta activa",
 "addAccountHint": "Agrega una cuenta desde una frase semilla de abajo.",
 "seedPhrasesTitle": "Frases semilla",
 "noSeedPhrases": "Aún no hay ninguna. Genera una nueva o importa la tuya.",
 "addAccount": "+ Cuenta",
 "generateNew": "Generar nueva",
 "confirmUnlinkSeed": "¿Desvincular esta frase semilla de este navegador?\n\nSus cuentas y fondos siguen seguros en la blockchain. Para volver a usarlos aquí, necesitarás las palabras de la frase semilla.",
 "vaultTitle": "Bóveda",
 "vaultKeys": "Claves",
 "vaultKeysValue": "Cifradas, solo en este dispositivo",
 "vaultAutoLock": "Bloqueo automático",
 "vaultAutoLockValue": "Tras 15 minutos de inactividad",
 "exportButton": "Exportar",
 "exportDone": "Billetera exportada",
 "exportFailed": "No se pudo exportar la billetera",
 "confirmUnlinkWallet": "¿Desvincular esta billetera de este navegador?\n\nSe eliminarán todas las frases semilla y cuentas de este dispositivo. Tus fondos siguen seguros en la blockchain; necesitarás tu frase semilla para volver a entrar.",
 "themeLabel": "Tema",
 "themeSystem": "Sistema",
 "themeSystemTitle": "Usar el tema de este dispositivo",
 "themeLight": "Claro",
 "themeLightTitle": "Claro · Bitcoin",
 "themeDark": "Oscuro",
 "themeDarkTitle": "Oscuro · RPG",
 "languageLabel": "Idioma",
 "languageAutomatic": "Automático",
 "tokensTitle": "Tokens",
 "refresh": "Actualizar",
 "refreshTitle": "Actualizar saldos",
 "totalValue": "Valor total",
 "tokenCount_one": "$1 token",
 "tokenCount_many": "$1 tokens",
 "tokenCount_other": "$1 tokens",
 "withoutPrice_one": "$1 sin precio",
 "withoutPrice_many": "$1 sin precio",
 "withoutPrice_other": "$1 sin precio",
 "loadingBalances": "Cargando saldos…",
 "pricesUnavailable": "Precios no disponibles: $1",
 "unlisted_one": "$1 no listado · no está en la lista de tokens de Charisma, puede ser una estafa",
 "unlisted_many": "$1 no listados · no están en la lista de tokens de Charisma, pueden ser estafas",
 "unlisted_other": "$1 no listados · no están en la lista de tokens de Charisma, pueden ser estafas",
 "onBlaze": "$1 en Blaze",
 "units": "$1 unidades",
 "rowUnlisted": "No está en la lista de tokens de Charisma: excluido de los envíos",
 "rowUnknown": "Token desconocido: se muestra en unidades mínimas y no se puede enviar desde aquí",
 "rowSend": "Enviar $1",
 "rowAllOnBlaze": "Todo tu saldo de $1 está en Blaze: muévelo con Charisma Swap",
 "sendTitle": "Enviar $1",
 "recipientLabel": "Destinatario",
 "blazeNote": "Los envíos usan tu saldo Estándar de $1 $2. Tu saldo de $3 en Blaze se queda en su subred; muévelo con Charisma Swap.",
 "sentTitle": "$1 enviado",
 "sentNote": "Se confirmará en Stacks en unos minutos.",
 "viewOnExplorer": "Ver en el explorador",
 "networkFee": "Comisión de red",
 "feeAutomatic": "Automática",
 "safety": "Seguridad",
 "safetyExact": "Exactamente esta cantidad, nada más",
 "sending": "Enviando…",
 "errorRecipient": "Ingresa una dirección de Stacks (SP…)",
 "errorAmountLike": "Ingresa una cantidad como $1",
 "errorMaxDecimals_one": "Como máximo $1 decimal",
 "errorMaxDecimals_many": "Como máximo $1 decimales",
 "errorMaxDecimals_other": "Como máximo $1 decimales",
 "errorAmountPositive": "La cantidad debe ser mayor que cero",
 "errorYouHave": "Tienes $1 $2",
 "checkedAt": "Verificado: $1",
 "checking": "Verificando…",
 "checkAgain": "Verificar de nuevo",
 "checkingButton": "Verificando",
 "stateError": "Error",
 "stateChecking": "Verificando",
 "stateLive": "En línea",
 "somethingWrong": "Algo no funciona",
 "stacksNetwork": "Red de Stacks",
 "block": "Bloque",
 "response": "Respuesta",
 "tokenListTitle": "Lista de tokens de Charisma",
 "statusTokens": "Tokens",
 "blazeSubnets": "Subredes de Blaze",
 "holdingFunds": "Con tus fondos",
 "noFundsOnSubnets_one": "No hay fondos en $1 subred.",
 "noFundsOnSubnets_many": "No hay fondos en ninguna de las $1 subredes.",
 "noFundsOnSubnets_other": "No hay fondos en ninguna de las $1 subredes.",
 "thisWallet": "Esta billetera",
 "autoLockIn_one": "En $1 min",
 "autoLockIn_many": "En $1 min",
 "autoLockIn_other": "En $1 min",
 "tabCrashed": "Esta pestaña dejó de funcionar",
 "cardSendStx": "Enviar STX",
 "cardRunTransaction": "Ejecutar una transacción",
 "cardSignOrder": "Firmar una orden",
 "cardSignOrders_one": "Firmar $1 orden",
 "cardSignOrders_many": "Firmar $1 órdenes",
 "cardSignOrders_other": "Firmar $1 órdenes",
 "cardSignMessage": "Firmar un mensaje",
 "cardConnect": "Conectar",
 "approveSign": "Firmar",
 "approveSignAll": "Firmar todas",
 "approveConnect": "Conectar",
 "deny": "Rechazar",
 "denyAndClose": "Rechazar y cerrar",
 "holdUnlockFirst": "Primero desbloquea la billetera",
 "holdChecking": "Verificando…",
 "lockedNote": "Blaze Wallet está bloqueada. Ábrela para desbloquearla ›",
 "coveredNote": "Algo está cubriendo esta tarjeta. Continúa en una ventana de Blaze Wallet ›",
 "errorNoAnswer": "Blaze Wallet no respondió",
 "riskLow": "Riesgo bajo",
 "riskReview": "Revisa con cuidado",
 "askConnect": "$1 quiere conectarse a Blaze Wallet",
 "askSignMessage": "$1 quiere que firmes este mensaje",
 "askSignOrder": "$1 quiere que firmes una orden de subred",
 "askSignData": "$1 quiere que firmes datos para $2",
 "askSignOrders_one": "$1 quiere que firmes $2 orden de subred",
 "askSignOrders_many": "$1 quiere que firmes $2 órdenes de subred",
 "askSignOrders_other": "$1 quiere que firmes $2 órdenes de subred",
 "askSendStx": "$1 quiere que envíes STX",
 "askRunTransaction": "$1 quiere que ejecutes una transacción",
 "shareAddressAs": "Compartir tu dirección $1",
 "shareAddress": "Compartir tu dirección",
 "cantMoveFunds": "No puede mover fondos: cada firma requiere tu aprobación",
 "signsAs": "Firmas como $1",
 "signsWithActive": "Firmas con tu cuenta activa",
 "messageMovesNothing": "Firmar un mensaje no mueve fondos",
 "payoutOnlyYou": "Solo a ti",
 "payoutSubmitter": "Adonde elija quien la ejecute",
 "orderAction": "Acción",
 "orderToken": "Token",
 "amountSmallestUnits": "Cantidad (unidades mínimas)",
 "sendsTo": "Se envía a",
 "payout": "Pago",
 "handledBy": "Administrado por $1",
 "orderId": "ID de la orden",
 "orderData": "Datos",
 "signsAsSentence": "Firmas como $1.",
 "orderRunsOnce": "Cualquiera que tenga esta firma puede ejecutar esta orden una vez.",
 "signOnlyRecognized": "Firma solo datos que reconozcas.",
 "ordersCount": "Órdenes",
 "canSpendTotal": "Pueden gastar en total",
 "smallestUnitsOf": "$1 (unidades mínimas de $2)",
 "ordersRunOnce": "Cualquiera que tenga estas firmas puede ejecutar cada orden una vez.",
 "memo": "Memo",
 "contract": "Contrato",
 "function": "Función",
 "argument": "Arg. $1",
 "allowMode": "⚠ Cualquiera de tus tokens podría moverse (modo allow)",
 "onlyTheseTransfers": "Solo pueden ocurrir estas transferencias:",
 "noTokensLeave": "Ningún token puede salir de tu billetera",
 "sentFrom": "Se enviará desde $1.",
 "feeSetAutomatically": "La comisión de red se define automáticamente.",
 "tokenSmallestUnits": "$1 $2 (unidades mínimas)",
 "pcYouSendExactly": "Envías exactamente $1",
 "pcTheySendExactly": "$1 envía exactamente $2",
 "pcYouSendMoreThan": "Envías más de $1",
 "pcTheySendMoreThan": "$1 envía más de $2",
 "pcYouSendAtLeast": "Envías al menos $1",
 "pcTheySendAtLeast": "$1 envía al menos $2",
 "pcYouSendLessThan": "Envías menos de $1",
 "pcTheySendLessThan": "$1 envía menos de $2",
 "pcYouSendAtMost": "Envías como máximo $1",
 "pcTheySendAtMost": "$1 envía como máximo $2",
 "pcYouSendNft": "Envías $1 $2",
 "pcTheySendNft": "$1 envía $2 $3",
 "pcYouKeepNft": "Conservas $1 $2",
 "pcTheyKeepNft": "$1 conserva $2 $3",
 "pcStacking": "$1: condición de stacking",
 "pcYou": "Tú",
 "errorUnexpected": "Algo salió mal: $1",
 "errorInvalidSeedPhrase": "Esa no es una frase semilla válida: revisa la ortografía de cada palabra y que no falte ninguna",
 "errorSeedNotFound": "No se encontró la frase semilla",
 "errorNoActiveAccount": "Blaze Wallet no tiene ninguna cuenta activa",
 "errorStacksUnavailable": "Red de Stacks no disponible (Hiro $1)",
 "errorTokenCacheEmpty": "La caché de tokens de Charisma no devolvió ningún token",
 "errorLocked": "La billetera está bloqueada",
 "errorLockedIdle": "La billetera se bloqueó tras 15 minutos de inactividad",
 "errorPasswordShort": "La contraseña debe tener al menos $1 caracteres",
 "errorWrongPassword": "Contraseña incorrecta",
 "errorNoWallet": "Aún no hay ninguna billetera",
 "errorSeedNameTaken": "Ya existe una frase semilla llamada “$1”",
 "errorAccountNotFound": "No se encontró la cuenta",
 "errorBalances": "No se pudieron cargar los saldos ($1)",
 "errorTokenListUnavailable": "La lista de tokens de Charisma no está disponible, así que no se puede verificar si los tokens están en la lista de bloqueo",
 "errorRejected": "La red rechazó la transferencia: $1",
 "errorRequestGone": "Esta solicitud ya no está pendiente"
}
```

`/tmp/blaze-ext-translations/fr.json` (French):

```json
{
 "extensionDescription": "Faites plus sur Stacks. Ordres limites et achats programmés : signés une fois, exécutés seuls, réglés on-chain, payés à vous seul.",
 "back": "Retour",
 "cancel": "Annuler",
 "continue": "Continuer",
 "done": "OK",
 "copy": "Copier",
 "copied": "Copié",
 "import": "Importer",
 "unlink": "Dissocier",
 "use": "Utiliser",
 "active": "Actif",
 "tryAgain": "Réessayer",
 "name": "Nom",
 "send": "Envoyer",
 "to": "À",
 "amount": "Montant",
 "lock": "Verrouiller",
 "review": "Vérifier",
 "max": "Max",
 "address": "Adresse",
 "tabWallet": "Portefeuille",
 "tabTokens": "Jetons",
 "tabStatus": "État",
 "lockTheWallet": "Verrouiller le portefeuille",
 "unlockLocked": "Verrouillé. Saisissez votre mot de passe pour continuer.",
 "unlockChoosePassword": "Choisissez un mot de passe pour protéger ce portefeuille.",
 "unlockTitle": "Déverrouiller",
 "createWalletTitle": "Créer votre portefeuille",
 "passwordLabel": "Mot de passe",
 "newPasswordLabel": "Nouveau mot de passe ($1 caractères minimum)",
 "passwordPlaceholder": "Votre mot de passe",
 "newPasswordPlaceholder": "Un mot de passe sécurisé",
 "passwordAgainLabel": "Saisissez-le à nouveau",
 "passwordAgainPlaceholder": "Le même mot de passe",
 "unlockButton": "Déverrouiller",
 "createWalletButton": "Créer le portefeuille",
 "passwordShow": "Afficher",
 "passwordHide": "Masquer",
 "errorPasswordsDontMatch": "Les mots de passe ne correspondent pas",
 "importTitle": "Importer une phrase de récupération",
 "seedNamePlaceholder": "Ma phrase de récupération",
 "importWordsLabel": "12 ou 24 mots",
 "importWordsPlaceholder": "word word word …",
 "errorSeedNotSaved": "La phrase de récupération n’a pas été enregistrée",
 "newSeedTitle": "Nouvelle phrase de récupération",
 "generateWords": "Générer 24 mots",
 "writeDownTitle": "Notez ces mots",
 "writeDownWarning": "Ces 24 mots sont le seul moyen de récupérer ce portefeuille. Toute personne qui les voit a le contrôle de vos fonds, et Blaze Wallet ne peut pas récupérer ces mots.",
 "wroteDown": "J’ai noté les 24 mots, dans l’ordre",
 "confirmTitle": "Confirmez vos mots",
 "confirmNote": "Saisissez ces mots d’après ce que vous avez noté.",
 "wordNumber": "Mot #$1",
 "errorWordsDontMatch": "Le mot $1 ne correspond pas. Vérifiez ce que vous avez noté",
 "confirmAndSave": "Confirmer et enregistrer",
 "newAccountTitle": "Nouveau compte",
 "newAccountNote": "La prochaine adresse issue de cette phrase de récupération devient votre compte actif.",
 "createAccount": "Créer le compte",
 "accountName": "Compte $1",
 "noActiveAccount": "Aucun compte actif",
 "addAccountHint": "Ajoutez un compte à partir d’une phrase de récupération ci-dessous.",
 "seedPhrasesTitle": "Phrases de récupération",
 "noSeedPhrases": "Aucune pour l’instant. Générez-en une nouvelle ou importez la vôtre.",
 "addAccount": "+ Compte",
 "generateNew": "Générer",
 "confirmUnlinkSeed": "Dissocier cette phrase de récupération de ce navigateur ?\n\nSes comptes et ses fonds restent en sécurité sur la blockchain. Pour les utiliser à nouveau ici, vous aurez besoin des mots de la phrase de récupération.",
 "vaultTitle": "Coffre-fort",
 "vaultKeys": "Clés",
 "vaultKeysValue": "Chiffrées, uniquement sur cet appareil",
 "vaultAutoLock": "Verrouillage automatique",
 "vaultAutoLockValue": "Après 15 min d’inactivité",
 "exportButton": "Exporter",
 "exportDone": "Portefeuille exporté",
 "exportFailed": "Impossible d’exporter le portefeuille",
 "confirmUnlinkWallet": "Dissocier ce portefeuille de ce navigateur ?\n\nToutes les phrases de récupération et tous les comptes seront supprimés de cet appareil. Vos fonds restent en sécurité sur la blockchain ; pour retrouver l’accès, vous aurez besoin de votre phrase de récupération.",
 "themeLabel": "Thème",
 "themeSystem": "Système",
 "themeSystemTitle": "Suivre le thème de cet appareil",
 "themeLight": "Clair",
 "themeLightTitle": "Clair · Bitcoin",
 "themeDark": "Sombre",
 "themeDarkTitle": "Sombre · RPG",
 "languageLabel": "Langue",
 "languageAutomatic": "Automatique",
 "tokensTitle": "Jetons",
 "refresh": "Actualiser",
 "refreshTitle": "Actualiser les soldes",
 "totalValue": "Valeur totale",
 "tokenCount_one": "$1 jeton",
 "tokenCount_many": "$1 jetons",
 "tokenCount_other": "$1 jetons",
 "withoutPrice_one": "$1 sans prix",
 "withoutPrice_many": "$1 sans prix",
 "withoutPrice_other": "$1 sans prix",
 "loadingBalances": "Chargement des soldes…",
 "pricesUnavailable": "Prix indisponibles : $1",
 "unlisted_one": "$1 non listé · absent de la liste de jetons de Charisma, peut-être une arnaque",
 "unlisted_many": "$1 non listés · absents de la liste de jetons de Charisma, peut-être des arnaques",
 "unlisted_other": "$1 non listés · absents de la liste de jetons de Charisma, peut-être des arnaques",
 "onBlaze": "$1 sur Blaze",
 "units": "$1 unités",
 "rowUnlisted": "Absent de la liste de jetons de Charisma : exclu des envois",
 "rowUnknown": "Jeton inconnu : affiché dans sa plus petite unité, ne peut pas être envoyé d’ici",
 "rowSend": "Envoyer $1",
 "rowAllOnBlaze": "Votre solde $1 est entièrement sur Blaze : déplacez-le avec Charisma Swap",
 "sendTitle": "Envoyer $1",
 "recipientLabel": "Destinataire",
 "blazeNote": "Les envois utilisent votre solde Standard de $1 $2. Votre solde de $3 sur Blaze reste dans son sous-réseau ; déplacez-le avec Charisma Swap.",
 "sentTitle": "$1 envoyé",
 "sentNote": "Le transfert sera confirmé sur Stacks dans quelques minutes.",
 "viewOnExplorer": "Voir dans l’explorateur",
 "networkFee": "Frais de réseau",
 "feeAutomatic": "Définis automatiquement",
 "safety": "Sécurité",
 "safetyExact": "Exactement ce montant, rien de plus",
 "sending": "Envoi…",
 "errorRecipient": "Saisissez une adresse Stacks (SP…)",
 "errorAmountLike": "Saisissez un montant, par exemple $1",
 "errorMaxDecimals_one": "Au maximum $1 décimale",
 "errorMaxDecimals_many": "Au maximum $1 décimales",
 "errorMaxDecimals_other": "Au maximum $1 décimales",
 "errorAmountPositive": "Le montant doit être supérieur à zéro",
 "errorYouHave": "Vous avez $1 $2",
 "checkedAt": "Vérifié à $1",
 "checking": "Vérification…",
 "checkAgain": "Vérifier à nouveau",
 "checkingButton": "Vérification",
 "stateError": "Erreur",
 "stateChecking": "Vérification",
 "stateLive": "En ligne",
 "somethingWrong": "Quelque chose ne fonctionne pas",
 "stacksNetwork": "Réseau Stacks",
 "block": "Bloc",
 "response": "Temps de réponse",
 "tokenListTitle": "Liste de jetons Charisma",
 "statusTokens": "Jetons",
 "blazeSubnets": "Sous-réseaux Blaze",
 "holdingFunds": "Détenant vos fonds",
 "noFundsOnSubnets_one": "Aucun fonds sur $1 sous-réseau.",
 "noFundsOnSubnets_many": "Aucun fonds sur les $1 sous-réseaux.",
 "noFundsOnSubnets_other": "Aucun fonds sur les $1 sous-réseaux.",
 "thisWallet": "Ce portefeuille",
 "autoLockIn_one": "Dans $1 min",
 "autoLockIn_many": "Dans $1 min",
 "autoLockIn_other": "Dans $1 min",
 "tabCrashed": "Cet onglet a planté",
 "cardSendStx": "Envoyer des STX",
 "cardRunTransaction": "Exécuter une transaction",
 "cardSignOrder": "Signer un ordre",
 "cardSignOrders_one": "Signer $1 ordre",
 "cardSignOrders_many": "Signer $1 ordres",
 "cardSignOrders_other": "Signer $1 ordres",
 "cardSignMessage": "Signer un message",
 "cardConnect": "Connexion",
 "approveSign": "Signer",
 "approveSignAll": "Tout signer",
 "approveConnect": "Connecter",
 "deny": "Refuser",
 "denyAndClose": "Refuser et fermer",
 "holdUnlockFirst": "Déverrouillez d’abord",
 "holdChecking": "Vérification…",
 "lockedNote": "Blaze Wallet est verrouillé. Ouvrez-le pour le déverrouiller ›",
 "coveredNote": "Quelque chose recouvre cette demande. Continuez dans une fenêtre Blaze Wallet ›",
 "errorNoAnswer": "Blaze Wallet n’a pas répondu",
 "riskLow": "Risque faible",
 "riskReview": "Vérifiez attentivement",
 "askConnect": "$1 souhaite se connecter à Blaze Wallet",
 "askSignMessage": "$1 vous demande de signer ce message",
 "askSignOrder": "$1 vous demande de signer un ordre de sous-réseau",
 "askSignData": "$1 vous demande de signer des données pour $2",
 "askSignOrders_one": "$1 vous demande de signer $2 ordre de sous-réseau",
 "askSignOrders_many": "$1 vous demande de signer $2 ordres de sous-réseau",
 "askSignOrders_other": "$1 vous demande de signer $2 ordres de sous-réseau",
 "askSendStx": "$1 vous demande d’envoyer des STX",
 "askRunTransaction": "$1 vous demande d’exécuter une transaction",
 "shareAddressAs": "Partager votre adresse $1",
 "shareAddress": "Partager votre adresse",
 "cantMoveFunds": "Cela ne permet pas de déplacer de fonds : chaque signature vous est d’abord demandée",
 "signsAs": "Vous signez en tant que $1",
 "signsWithActive": "Vous signez avec votre compte actif",
 "messageMovesNothing": "Signer un message ne déplace pas de fonds",
 "payoutOnlyYou": "Uniquement à vous",
 "payoutSubmitter": "N’importe où, au choix de qui soumet l’ordre",
 "orderAction": "Action",
 "orderToken": "Jeton",
 "amountSmallestUnits": "Montant (plus petites unités)",
 "sendsTo": "Envoie à",
 "payout": "Versement",
 "handledBy": "Géré par $1",
 "orderId": "ID de l’ordre",
 "orderData": "Données",
 "signsAsSentence": "Vous signez en tant que $1.",
 "orderRunsOnce": "Toute personne détenant cette signature peut exécuter cet ordre une fois.",
 "signOnlyRecognized": "Ne signez que des données que vous reconnaissez.",
 "ordersCount": "Ordres",
 "canSpendTotal": "Peut dépenser au total",
 "smallestUnitsOf": "$1 (plus petites unités de $2)",
 "ordersRunOnce": "Toute personne détenant ces signatures peut exécuter chaque ordre une fois.",
 "memo": "Mémo",
 "contract": "Contrat",
 "function": "Fonction",
 "argument": "Arg. $1",
 "allowMode": "⚠ N’importe lequel de vos jetons pourrait être déplacé (mode allow)",
 "onlyTheseTransfers": "Seuls ces transferts peuvent avoir lieu :",
 "noTokensLeave": "Aucun jeton ne peut quitter votre portefeuille",
 "sentFrom": "Envoi depuis $1.",
 "feeSetAutomatically": "Les frais de réseau sont définis automatiquement.",
 "tokenSmallestUnits": "$1 $2 (plus petites unités)",
 "pcYouSendExactly": "Vous envoyez exactement $1",
 "pcTheySendExactly": "$1 envoie exactement $2",
 "pcYouSendMoreThan": "Vous envoyez plus de $1",
 "pcTheySendMoreThan": "$1 envoie plus de $2",
 "pcYouSendAtLeast": "Vous envoyez au moins $1",
 "pcTheySendAtLeast": "$1 envoie au moins $2",
 "pcYouSendLessThan": "Vous envoyez moins de $1",
 "pcTheySendLessThan": "$1 envoie moins de $2",
 "pcYouSendAtMost": "Vous envoyez au maximum $1",
 "pcTheySendAtMost": "$1 envoie au maximum $2",
 "pcYouSendNft": "Vous envoyez $1 $2",
 "pcTheySendNft": "$1 envoie $2 $3",
 "pcYouKeepNft": "Vous conservez $1 $2",
 "pcTheyKeepNft": "$1 conserve $2 $3",
 "pcStacking": "$1 : condition de stacking",
 "pcYou": "Vous",
 "errorUnexpected": "Une erreur s’est produite : $1",
 "errorInvalidSeedPhrase": "Ce n’est pas une phrase de récupération valide : vérifiez l’orthographe de chaque mot et qu’il n’en manque aucun",
 "errorSeedNotFound": "Phrase de récupération introuvable",
 "errorNoActiveAccount": "Blaze Wallet n’a aucun compte actif",
 "errorStacksUnavailable": "Réseau Stacks indisponible (Hiro $1)",
 "errorTokenCacheEmpty": "Le cache de jetons de Charisma n’a renvoyé aucun jeton",
 "errorLocked": "Le portefeuille est verrouillé",
 "errorLockedIdle": "Portefeuille verrouillé après 15 minutes d’inactivité",
 "errorPasswordShort": "Le mot de passe doit comporter au moins $1 caractères",
 "errorWrongPassword": "Mot de passe incorrect",
 "errorNoWallet": "Aucun portefeuille pour l’instant",
 "errorSeedNameTaken": "Une phrase de récupération nommée « $1 » existe déjà",
 "errorAccountNotFound": "Compte introuvable",
 "errorBalances": "Impossible de charger les soldes ($1)",
 "errorTokenListUnavailable": "La liste de jetons de Charisma est indisponible, les jetons ne peuvent donc pas être comparés à la liste de blocage",
 "errorRejected": "Le réseau a refusé le transfert : $1",
 "errorRequestGone": "Cette demande n’est plus en attente"
}
```

`/tmp/blaze-ext-translations/de.json` (German):

```json
{
 "extensionDescription": "Hol mehr aus Stacks. Einmal signiert, laufen Limit-Orders und geplante Käufe von selbst, on-chain abgewickelt, nur an dich gezahlt.",
 "back": "Zurück",
 "cancel": "Abbrechen",
 "continue": "Weiter",
 "done": "Fertig",
 "copy": "Kopieren",
 "copied": "Kopiert",
 "import": "Importieren",
 "unlink": "Trennen",
 "use": "Verwenden",
 "active": "Aktiv",
 "tryAgain": "Erneut versuchen",
 "name": "Name",
 "send": "Senden",
 "to": "An",
 "amount": "Betrag",
 "lock": "Sperren",
 "review": "Prüfen",
 "max": "Max",
 "address": "Adresse",
 "tabWallet": "Wallet",
 "tabTokens": "Tokens",
 "tabStatus": "Status",
 "lockTheWallet": "Wallet sperren",
 "unlockLocked": "Gesperrt. Gib dein Passwort ein, um fortzufahren.",
 "unlockChoosePassword": "Wähle ein Passwort, um diese Wallet zu schützen.",
 "unlockTitle": "Entsperren",
 "createWalletTitle": "Deine Wallet erstellen",
 "passwordLabel": "Passwort",
 "newPasswordLabel": "Neues Passwort (mind. $1 Zeichen)",
 "passwordPlaceholder": "Dein Passwort",
 "newPasswordPlaceholder": "Ein starkes Passwort",
 "passwordAgainLabel": "Gib es erneut ein",
 "passwordAgainPlaceholder": "Dasselbe Passwort",
 "unlockButton": "Entsperren",
 "createWalletButton": "Wallet erstellen",
 "passwordShow": "Anzeigen",
 "passwordHide": "Ausblenden",
 "errorPasswordsDontMatch": "Die Passwörter stimmen nicht überein",
 "importTitle": "Seed-Phrase importieren",
 "seedNamePlaceholder": "Meine Seed-Phrase",
 "importWordsLabel": "12 oder 24 Wörter",
 "importWordsPlaceholder": "word word word …",
 "errorSeedNotSaved": "Die Seed-Phrase wurde nicht gespeichert",
 "newSeedTitle": "Neue Seed-Phrase",
 "generateWords": "24 Wörter generieren",
 "writeDownTitle": "Notiere diese Wörter",
 "writeDownWarning": "Diese 24 Wörter sind der einzige Weg, diese Wallet wiederherzustellen. Wer sie sieht, hat die Kontrolle über dein Guthaben, und Blaze Wallet kann die Wörter nicht wiederherstellen.",
 "wroteDown": "Ich habe alle 24 Wörter der Reihe nach notiert",
 "confirmTitle": "Bestätige deine Wörter",
 "confirmNote": "Gib diese Wörter so ein, wie du sie notiert hast.",
 "wordNumber": "Wort #$1",
 "errorWordsDontMatch": "Wort $1 stimmt nicht überein. Prüfe, was du notiert hast",
 "confirmAndSave": "Bestätigen und speichern",
 "newAccountTitle": "Neues Konto",
 "newAccountNote": "Die nächste Adresse aus dieser Seed-Phrase wird dein aktives Konto.",
 "createAccount": "Konto erstellen",
 "accountName": "Konto $1",
 "noActiveAccount": "Kein aktives Konto",
 "addAccountHint": "Füge unten ein Konto aus einer Seed-Phrase hinzu.",
 "seedPhrasesTitle": "Seed-Phrasen",
 "noSeedPhrases": "Noch keine. Generiere eine neue oder importiere deine.",
 "addAccount": "+ Konto",
 "generateNew": "Neue generieren",
 "confirmUnlinkSeed": "Diese Seed-Phrase von diesem Browser trennen?\n\nDie Konten und das Guthaben dieser Seed-Phrase bleiben sicher auf der Blockchain. Um sie hier wieder zu verwenden, brauchst du die Wörter der Seed-Phrase.",
 "vaultTitle": "Tresor",
 "vaultKeys": "Schlüssel",
 "vaultKeysValue": "Verschlüsselt, nur auf diesem Gerät",
 "vaultAutoLock": "Automatische Sperre",
 "vaultAutoLockValue": "Nach 15 Min. Inaktivität",
 "exportButton": "Exportieren",
 "exportDone": "Wallet exportiert",
 "exportFailed": "Die Wallet konnte nicht exportiert werden",
 "confirmUnlinkWallet": "Diese Wallet von diesem Browser trennen?\n\nAlle Seed-Phrasen und Konten werden von diesem Gerät entfernt. Dein Guthaben bleibt sicher auf der Blockchain; um wieder Zugang zu erhalten, brauchst du deine Seed-Phrase.",
 "themeLabel": "Design",
 "themeSystem": "System",
 "themeSystemTitle": "Design dieses Geräts übernehmen",
 "themeLight": "Hell",
 "themeLightTitle": "Hell · Bitcoin",
 "themeDark": "Dunkel",
 "themeDarkTitle": "Dunkel · RPG",
 "languageLabel": "Sprache",
 "languageAutomatic": "Automatisch",
 "tokensTitle": "Tokens",
 "refresh": "Aktualisieren",
 "refreshTitle": "Guthaben aktualisieren",
 "totalValue": "Gesamtwert",
 "tokenCount_one": "$1 Token",
 "tokenCount_other": "$1 Tokens",
 "withoutPrice_one": "$1 ohne Preis",
 "withoutPrice_other": "$1 ohne Preis",
 "loadingBalances": "Guthaben werden geladen …",
 "pricesUnavailable": "Preise nicht verfügbar: $1",
 "unlisted_one": "$1 nicht gelistet · nicht auf der Token-Liste von Charisma, möglicherweise Betrug",
 "unlisted_other": "$1 nicht gelistet · nicht auf der Token-Liste von Charisma, möglicherweise Betrug",
 "onBlaze": "$1 auf Blaze",
 "units": "$1 Einheiten",
 "rowUnlisted": "Nicht auf der Token-Liste von Charisma: vom Senden ausgeschlossen",
 "rowUnknown": "Unbekanntes Token: in seiner kleinsten Einheit angezeigt, kann hier nicht gesendet werden",
 "rowSend": "$1 senden",
 "rowAllOnBlaze": "Dein $1 liegt komplett auf Blaze: Verschiebe es mit Charisma Swap",
 "sendTitle": "$1 senden",
 "recipientLabel": "Empfänger",
 "blazeNote": "Beim Senden wird dein Standard-Guthaben von $1 $2 verwendet. Dein Guthaben von $3 auf Blaze bleibt in seinem Subnetz; verschiebe es mit Charisma Swap.",
 "sentTitle": "$1 gesendet",
 "sentNote": "Die Transaktion wird in wenigen Minuten auf Stacks bestätigt.",
 "viewOnExplorer": "Im Explorer ansehen",
 "networkFee": "Netzwerkgebühr",
 "feeAutomatic": "Automatisch festgelegt",
 "safety": "Sicherheit",
 "safetyExact": "Genau dieser Betrag, sonst nichts",
 "sending": "Wird gesendet …",
 "errorRecipient": "Gib eine Stacks-Adresse ein (SP…)",
 "errorAmountLike": "Gib einen Betrag wie $1 ein",
 "errorMaxDecimals_one": "Höchstens $1 Nachkommastelle",
 "errorMaxDecimals_other": "Höchstens $1 Nachkommastellen",
 "errorAmountPositive": "Der Betrag muss größer als null sein",
 "errorYouHave": "Du hast $1 $2",
 "checkedAt": "Geprüft um $1",
 "checking": "Wird geprüft …",
 "checkAgain": "Erneut prüfen",
 "checkingButton": "Wird geprüft",
 "stateError": "Fehler",
 "stateChecking": "Wird geprüft",
 "stateLive": "Online",
 "somethingWrong": "Etwas funktioniert nicht",
 "stacksNetwork": "Stacks-Netzwerk",
 "block": "Block",
 "response": "Antwortzeit",
 "tokenListTitle": "Charisma-Token-Liste",
 "statusTokens": "Tokens",
 "blazeSubnets": "Blaze-Subnetze",
 "holdingFunds": "Mit deinem Guthaben",
 "noFundsOnSubnets_one": "Kein Guthaben auf $1 Subnetz.",
 "noFundsOnSubnets_other": "Kein Guthaben auf den $1 Subnetzen.",
 "thisWallet": "Diese Wallet",
 "autoLockIn_one": "In $1 Min.",
 "autoLockIn_other": "In $1 Min.",
 "tabCrashed": "Dieser Tab ist abgestürzt",
 "cardSendStx": "STX senden",
 "cardRunTransaction": "Transaktion ausführen",
 "cardSignOrder": "Order signieren",
 "cardSignOrders_one": "$1 Order signieren",
 "cardSignOrders_other": "$1 Orders signieren",
 "cardSignMessage": "Nachricht signieren",
 "cardConnect": "Verbinden",
 "approveSign": "Signieren",
 "approveSignAll": "Alle signieren",
 "approveConnect": "Verbinden",
 "deny": "Ablehnen",
 "denyAndClose": "Ablehnen und schließen",
 "holdUnlockFirst": "Erst Wallet entsperren",
 "holdChecking": "Wird geprüft …",
 "lockedNote": "Blaze Wallet ist gesperrt. Zum Entsperren öffnen ›",
 "coveredNote": "Etwas verdeckt diese Anfrage. Weiter in einem Fenster von Blaze Wallet ›",
 "errorNoAnswer": "Blaze Wallet hat nicht geantwortet",
 "riskLow": "Geringes Risiko",
 "riskReview": "Sorgfältig prüfen",
 "askConnect": "$1 möchte sich mit Blaze Wallet verbinden",
 "askSignMessage": "$1 möchte, dass du diese Nachricht signierst",
 "askSignOrder": "$1 möchte, dass du eine Subnetz-Order signierst",
 "askSignData": "$1 möchte, dass du Daten für $2 signierst",
 "askSignOrders_one": "$1 möchte, dass du $2 Subnetz-Order signierst",
 "askSignOrders_other": "$1 möchte, dass du $2 Subnetz-Orders signierst",
 "askSendStx": "$1 möchte, dass du STX sendest",
 "askRunTransaction": "$1 möchte, dass du eine Transaktion ausführst",
 "shareAddressAs": "Deine Adresse $1 teilen",
 "shareAddress": "Deine Adresse teilen",
 "cantMoveFunds": "Damit lässt sich kein Guthaben bewegen: Vor jeder Signatur wirst du gefragt",
 "signsAs": "Du signierst als $1",
 "signsWithActive": "Du signierst mit deinem aktiven Konto",
 "messageMovesNothing": "Das Signieren einer Nachricht bewegt kein Guthaben",
 "payoutOnlyYou": "Nur an dich",
 "payoutSubmitter": "Wohin auch immer der Einreicher will",
 "orderAction": "Aktion",
 "orderToken": "Token",
 "amountSmallestUnits": "Betrag (kleinste Einheiten)",
 "sendsTo": "Sendet an",
 "payout": "Auszahlung",
 "handledBy": "Abgewickelt von $1",
 "orderId": "Order-ID",
 "orderData": "Daten",
 "signsAsSentence": "Du signierst als $1.",
 "orderRunsOnce": "Wer diese Signatur besitzt, kann diese Order einmal ausführen.",
 "signOnlyRecognized": "Signiere nur Daten, die du kennst.",
 "ordersCount": "Orders",
 "canSpendTotal": "Kann insgesamt ausgeben",
 "smallestUnitsOf": "$1 (kleinste Einheiten von $2)",
 "ordersRunOnce": "Wer diese Signaturen besitzt, kann jede Order einmal ausführen.",
 "memo": "Memo",
 "contract": "Vertrag",
 "function": "Funktion",
 "argument": "Arg. $1",
 "allowMode": "⚠ Jedes deiner Tokens könnte bewegt werden (Allow-Modus)",
 "onlyTheseTransfers": "Nur diese Übertragungen sind möglich:",
 "noTokensLeave": "Kein Token kann deine Wallet verlassen",
 "sentFrom": "Gesendet von $1.",
 "feeSetAutomatically": "Die Netzwerkgebühr wird automatisch festgelegt.",
 "tokenSmallestUnits": "$1 $2 (kleinste Einheiten)",
 "pcYouSendExactly": "Du sendest genau $1",
 "pcTheySendExactly": "$1 sendet genau $2",
 "pcYouSendMoreThan": "Du sendest mehr als $1",
 "pcTheySendMoreThan": "$1 sendet mehr als $2",
 "pcYouSendAtLeast": "Du sendest mindestens $1",
 "pcTheySendAtLeast": "$1 sendet mindestens $2",
 "pcYouSendLessThan": "Du sendest weniger als $1",
 "pcTheySendLessThan": "$1 sendet weniger als $2",
 "pcYouSendAtMost": "Du sendest höchstens $1",
 "pcTheySendAtMost": "$1 sendet höchstens $2",
 "pcYouSendNft": "Du sendest $1 $2",
 "pcTheySendNft": "$1 sendet $2 $3",
 "pcYouKeepNft": "Du behältst $1 $2",
 "pcTheyKeepNft": "$1 behält $2 $3",
 "pcStacking": "$1: Stacking-Bedingung",
 "pcYou": "Du",
 "errorUnexpected": "Etwas ist schiefgelaufen: $1",
 "errorInvalidSeedPhrase": "Das ist keine gültige Seed-Phrase: Prüfe die Schreibweise jedes Wortes und ob eines fehlt",
 "errorSeedNotFound": "Seed-Phrase nicht gefunden",
 "errorNoActiveAccount": "Blaze Wallet hat kein aktives Konto",
 "errorStacksUnavailable": "Stacks-Netzwerk nicht verfügbar (Hiro $1)",
 "errorTokenCacheEmpty": "Der Token-Cache von Charisma hat keine Tokens zurückgegeben",
 "errorLocked": "Die Wallet ist gesperrt",
 "errorLockedIdle": "Wallet nach 15 Minuten Inaktivität gesperrt",
 "errorPasswordShort": "Das Passwort muss mindestens $1 Zeichen lang sein",
 "errorWrongPassword": "Falsches Passwort",
 "errorNoWallet": "Noch keine Wallet",
 "errorSeedNameTaken": "Eine Seed-Phrase mit dem Namen „$1“ gibt es bereits",
 "errorAccountNotFound": "Konto nicht gefunden",
 "errorBalances": "Guthaben konnten nicht geladen werden ($1)",
 "errorTokenListUnavailable": "Die Token-Liste von Charisma ist nicht verfügbar, daher können Tokens nicht mit der Sperrliste abgeglichen werden",
 "errorRejected": "Das Netzwerk hat die Transaktion abgelehnt: $1",
 "errorRequestGone": "Diese Anfrage ist nicht mehr offen"
}
```

`/tmp/blaze-ext-translations/tr.json` (Turkish):

```json
{
 "extensionDescription": "Stacks ağında daha fazlası. Limit emirleri ve planlı alımlar tek imzayla otomatik çalışır, zincirde kesinleşir, sadece size ödenir.",
 "back": "Geri",
 "cancel": "İptal",
 "continue": "Devam",
 "done": "Bitti",
 "copy": "Kopyala",
 "copied": "Kopyalandı",
 "import": "İçe aktar",
 "unlink": "Bağlantıyı kaldır",
 "use": "Kullan",
 "active": "Etkin",
 "tryAgain": "Tekrar dene",
 "name": "Ad",
 "send": "Gönder",
 "to": "Alıcı",
 "amount": "Miktar",
 "lock": "Kilitle",
 "review": "İncele",
 "max": "Maks.",
 "address": "Adres",
 "tabWallet": "Cüzdan",
 "tabTokens": "Tokenlar",
 "tabStatus": "Durum",
 "lockTheWallet": "Cüzdanı kilitle",
 "unlockLocked": "Kilitli. Devam etmek için şifrenizi girin.",
 "unlockChoosePassword": "Bu cüzdanı korumak için bir şifre belirleyin.",
 "unlockTitle": "Kilidi aç",
 "createWalletTitle": "Cüzdanınızı oluşturun",
 "passwordLabel": "Şifre",
 "newPasswordLabel": "Yeni şifre (en az $1 karakter)",
 "passwordPlaceholder": "Şifreniz",
 "newPasswordPlaceholder": "Güçlü bir şifre",
 "passwordAgainLabel": "Tekrar yazın",
 "passwordAgainPlaceholder": "Aynı şifre",
 "unlockButton": "Kilidi aç",
 "createWalletButton": "Cüzdan oluştur",
 "passwordShow": "Göster",
 "passwordHide": "Gizle",
 "errorPasswordsDontMatch": "Şifreler eşleşmiyor",
 "importTitle": "Kurtarma ifadesi içe aktar",
 "seedNamePlaceholder": "Kurtarma ifadem",
 "importWordsLabel": "12 veya 24 kelime",
 "importWordsPlaceholder": "word word word …",
 "errorSeedNotSaved": "Kurtarma ifadesi kaydedilmedi",
 "newSeedTitle": "Yeni kurtarma ifadesi",
 "generateWords": "24 kelime oluştur",
 "writeDownTitle": "Bunları yazın",
 "writeDownWarning": "Bu 24 kelime, bu cüzdanı kurtarmanın tek yoludur. Onları gören herkes fonlarınızın kontrolünü ele geçirir ve Blaze Wallet onları geri getiremez.",
 "wroteDown": "24 kelimenin tamamını sırasıyla yazdım",
 "confirmTitle": "Kelimelerinizi doğrulayın",
 "confirmNote": "Bu kelimeleri yazdıklarınıza bakarak girin.",
 "wordNumber": "$1. kelime",
 "errorWordsDontMatch": "Eşleşmeyen kelime: $1. Yazdıklarınızı kontrol edin",
 "confirmAndSave": "Onayla ve kaydet",
 "newAccountTitle": "Yeni hesap",
 "newAccountNote": "Bu kurtarma ifadesinin bir sonraki adresi etkin hesabınız olur.",
 "createAccount": "Hesap oluştur",
 "accountName": "Hesap $1",
 "noActiveAccount": "Etkin hesap yok",
 "addAccountHint": "Aşağıdaki bir kurtarma ifadesinden hesap ekleyin.",
 "seedPhrasesTitle": "Kurtarma ifadeleri",
 "noSeedPhrases": "Henüz yok. Yeni bir tane oluşturun veya kendi kurtarma ifadenizi içe aktarın.",
 "addAccount": "+ Hesap",
 "generateNew": "Yeni oluştur",
 "confirmUnlinkSeed": "Bu kurtarma ifadesinin bu tarayıcı ile bağlantısı kaldırılsın mı?\n\nBu kurtarma ifadesindeki hesaplar ve fonlar blok zincirinde güvende kalır. Onları burada tekrar kullanmak için kurtarma ifadesinin kelimelerine ihtiyacınız olacak.",
 "vaultTitle": "Kasa",
 "vaultKeys": "Anahtarlar",
 "vaultKeysValue": "Şifreli, yalnızca bu cihazda",
 "vaultAutoLock": "Otomatik kilit",
 "vaultAutoLockValue": "15 dakika işlem yapılmadığında",
 "exportButton": "Dışa aktar",
 "exportDone": "Cüzdan dışa aktarıldı",
 "exportFailed": "Cüzdan dışa aktarılamadı",
 "confirmUnlinkWallet": "Bu cüzdanın bu tarayıcı ile bağlantısı kaldırılsın mı?\n\nTüm kurtarma ifadeleri ve hesaplar bu cihazdan kaldırılır. Fonlarınız blok zincirinde güvende kalır; yeniden erişmek için kurtarma ifadenize ihtiyacınız olacak.",
 "themeLabel": "Tema",
 "themeSystem": "Sistem",
 "themeSystemTitle": "Bu cihazın ayarını kullan",
 "themeLight": "Açık",
 "themeLightTitle": "Açık · Bitcoin",
 "themeDark": "Koyu",
 "themeDarkTitle": "Koyu · RPG",
 "languageLabel": "Dil",
 "languageAutomatic": "Otomatik",
 "tokensTitle": "Tokenlar",
 "refresh": "Yenile",
 "refreshTitle": "Bakiyeleri yenile",
 "totalValue": "Toplam değer",
 "tokenCount_one": "$1 token",
 "tokenCount_other": "$1 token",
 "withoutPrice_one": "$1 tanesinin fiyatı yok",
 "withoutPrice_other": "$1 tanesinin fiyatı yok",
 "loadingBalances": "Bakiyeler yükleniyor…",
 "pricesUnavailable": "Fiyatlar kullanılamıyor: $1",
 "unlisted_one": "$1 token listede yok · Charisma token listesinde değil, dolandırıcılık olabilir",
 "unlisted_other": "$1 token listede yok · Charisma token listesinde değil, dolandırıcılık olabilir",
 "onBlaze": "$1 Blaze'de",
 "units": "$1 birim",
 "rowUnlisted": "Charisma token listesinde yok: gönderime kapalı",
 "rowUnknown": "Bilinmeyen token: en küçük birimleriyle gösterilir, buradan gönderilemez",
 "rowSend": "$1 gönder",
 "rowAllOnBlaze": "$1 bakiyenizin tamamı Blaze'de: Charisma Swap ile taşıyın",
 "sendTitle": "$1 gönder",
 "recipientLabel": "Alıcı",
 "blazeNote": "Gönderirken Standart bakiyenizdeki $1 $2 kullanılır. Blaze'deki $3 kendi alt ağında kalır; Charisma Swap ile taşıyın.",
 "sentTitle": "$1 gönderildi",
 "sentNote": "Birkaç dakika içinde Stacks ağında onaylanır.",
 "viewOnExplorer": "Blok gezgininde görüntüle",
 "networkFee": "Ağ ücreti",
 "feeAutomatic": "Otomatik ayarlanır",
 "safety": "Güvenlik",
 "safetyExact": "Tam olarak bu miktar, fazlası değil",
 "sending": "Gönderiliyor…",
 "errorRecipient": "Bir Stacks adresi girin (SP…)",
 "errorAmountLike": "$1 gibi bir miktar girin",
 "errorMaxDecimals_one": "En fazla $1 ondalık basamak",
 "errorMaxDecimals_other": "En fazla $1 ondalık basamak",
 "errorAmountPositive": "Miktar sıfırdan büyük olmalı",
 "errorYouHave": "Sizde $1 $2 var",
 "checkedAt": "Son kontrol: $1",
 "checking": "Kontrol ediliyor…",
 "checkAgain": "Tekrar kontrol et",
 "checkingButton": "Kontrol ediliyor",
 "stateError": "Hata",
 "stateChecking": "Kontrol ediliyor",
 "stateLive": "Çevrimiçi",
 "somethingWrong": "Bir şeyler çalışmıyor",
 "stacksNetwork": "Stacks ağı",
 "block": "Blok",
 "response": "Yanıt süresi",
 "tokenListTitle": "Charisma token listesi",
 "statusTokens": "Token sayısı",
 "blazeSubnets": "Blaze alt ağları",
 "holdingFunds": "Fonlarınızı tutan alt ağlar",
 "noFundsOnSubnets_one": "$1 alt ağda hiç fon yok.",
 "noFundsOnSubnets_other": "$1 alt ağın hiçbirinde fon yok.",
 "thisWallet": "Bu cüzdan",
 "autoLockIn_one": "$1 dk sonra",
 "autoLockIn_other": "$1 dk sonra",
 "tabCrashed": "Bu sekme çöktü",
 "cardSendStx": "STX gönder",
 "cardRunTransaction": "İşlem gerçekleştir",
 "cardSignOrder": "Emir imzala",
 "cardSignOrders_one": "$1 emir imzala",
 "cardSignOrders_other": "$1 emir imzala",
 "cardSignMessage": "Mesaj imzala",
 "cardConnect": "Bağlan",
 "approveSign": "İmzala",
 "approveSignAll": "Tümünü imzala",
 "approveConnect": "Bağlan",
 "deny": "Reddet",
 "denyAndClose": "Reddet ve kapat",
 "holdUnlockFirst": "Önce cüzdanın kilidini açın",
 "holdChecking": "Kontrol ediliyor…",
 "lockedNote": "Blaze Wallet kilitli. Kilidi açmak için cüzdanı açın ›",
 "coveredNote": "Bir şey bu kartı kapatıyor. Bir Blaze Wallet penceresinde devam edin ›",
 "errorNoAnswer": "Blaze Wallet yanıt vermedi",
 "riskLow": "Düşük risk",
 "riskReview": "Dikkatle inceleyin",
 "askConnect": "$1, Blaze Wallet ile bağlantı kurmak istiyor",
 "askSignMessage": "$1, bu mesajı imzalamanızı istiyor",
 "askSignOrder": "$1, bir alt ağ emri imzalamanızı istiyor",
 "askSignData": "$1, $2 için veri imzalamanızı istiyor",
 "askSignOrders_one": "$1, $2 alt ağ emri imzalamanızı istiyor",
 "askSignOrders_other": "$1, $2 alt ağ emri imzalamanızı istiyor",
 "askSendStx": "$1, STX göndermenizi istiyor",
 "askRunTransaction": "$1, bir işlem gerçekleştirmenizi istiyor",
 "shareAddressAs": "$1 adresiniz paylaşılır",
 "shareAddress": "Adresiniz paylaşılır",
 "cantMoveFunds": "Fon taşıyamaz: her imza için önce size sorulur",
 "signsAs": "$1 olarak imzalar",
 "signsWithActive": "Etkin hesabınızla imzalar",
 "messageMovesNothing": "Mesaj imzalamak fon taşımaz",
 "payoutOnlyYou": "Yalnızca size",
 "payoutSubmitter": "Emri iletenin seçtiği her yere",
 "orderAction": "Eylem",
 "orderToken": "Token",
 "amountSmallestUnits": "Miktar (en küçük birim)",
 "sendsTo": "Gönderilecek adres",
 "payout": "Ödeme",
 "handledBy": "$1 tarafından işlenir",
 "orderId": "Emir kimliği",
 "orderData": "Veri",
 "signsAsSentence": "$1 olarak imzalar.",
 "orderRunsOnce": "Bu imzayı elinde bulunduran herkes bu emri bir kez gerçekleştirebilir.",
 "signOnlyRecognized": "Yalnızca tanıdığınız verileri imzalayın.",
 "ordersCount": "Emir sayısı",
 "canSpendTotal": "Toplamda harcayabilir",
 "smallestUnitsOf": "$1 ($2, en küçük birim)",
 "ordersRunOnce": "Bu imzaları elinde bulunduran herkes her emri bir kez gerçekleştirebilir.",
 "memo": "Not",
 "contract": "Sözleşme",
 "function": "Fonksiyon",
 "argument": "Argüman $1",
 "allowMode": "⚠ Tokenlarınızdan herhangi biri taşınabilir (izin modu)",
 "onlyTheseTransfers": "Yalnızca şu transferler gerçekleşebilir:",
 "noTokensLeave": "Cüzdanınızdan hiçbir token çıkamaz",
 "sentFrom": "$1 adresinden gönderilir.",
 "feeSetAutomatically": "Ağ ücreti otomatik olarak ayarlanır.",
 "tokenSmallestUnits": "$1 $2 (en küçük birim)",
 "pcYouSendExactly": "Tam olarak $1 gönderirsiniz",
 "pcTheySendExactly": "$1 tam olarak $2 gönderir",
 "pcYouSendMoreThan": "$1 miktarından fazla gönderirsiniz",
 "pcTheySendMoreThan": "$1, $2 miktarından fazla gönderir",
 "pcYouSendAtLeast": "En az $1 gönderirsiniz",
 "pcTheySendAtLeast": "$1 en az $2 gönderir",
 "pcYouSendLessThan": "$1 miktarından az gönderirsiniz",
 "pcTheySendLessThan": "$1, $2 miktarından az gönderir",
 "pcYouSendAtMost": "En fazla $1 gönderirsiniz",
 "pcTheySendAtMost": "$1 en fazla $2 gönderir",
 "pcYouSendNft": "$1 $2 öğesini gönderirsiniz",
 "pcTheySendNft": "$1, $2 $3 öğesini gönderir",
 "pcYouKeepNft": "$1 $2 öğesi sizde kalır",
 "pcTheyKeepNft": "$1, $2 $3 öğesini elinde tutar",
 "pcStacking": "$1: stacking koşulu",
 "pcYou": "Siz",
 "errorUnexpected": "Bir sorun oluştu: $1",
 "errorInvalidSeedPhrase": "Bu geçerli bir kurtarma ifadesi değil: her kelimenin yazımını ve eksik kelime olmadığını kontrol edin",
 "errorSeedNotFound": "Kurtarma ifadesi bulunamadı",
 "errorNoActiveAccount": "Blaze Wallet içinde etkin hesap yok",
 "errorStacksUnavailable": "Stacks ağı kullanılamıyor (Hiro $1)",
 "errorTokenCacheEmpty": "Charisma token önbelleği hiç token döndürmedi",
 "errorLocked": "Cüzdan kilitli",
 "errorLockedIdle": "Cüzdan 15 dakika işlem yapılmadığı için kilitlendi",
 "errorPasswordShort": "Şifre en az $1 karakter olmalı",
 "errorWrongPassword": "Yanlış şifre",
 "errorNoWallet": "Henüz cüzdan yok",
 "errorSeedNameTaken": "“$1” adlı bir kurtarma ifadesi zaten var",
 "errorAccountNotFound": "Hesap bulunamadı",
 "errorBalances": "Bakiyeler yüklenemedi ($1)",
 "errorTokenListUnavailable": "Charisma token listesi kullanılamıyor, bu yüzden tokenlar engelleme listesine göre kontrol edilemiyor",
 "errorRejected": "Ağ, transferi reddetti: $1",
 "errorRequestGone": "Bu istek artık beklemede değil"
}
```

`/tmp/blaze-ext-translations/ja.json` (Japanese):

```json
{
 "extensionDescription": "Stacks でもっと多くのことができます。指値注文や日時指定の購入は一度署名するだけで自動で実行され、オンチェーンで決済されて、あなたにのみ支払われます。",
 "back": "戻る",
 "cancel": "キャンセル",
 "continue": "続行",
 "done": "完了",
 "copy": "コピー",
 "copied": "コピーしました",
 "import": "インポート",
 "unlink": "リンク解除",
 "use": "使用",
 "active": "使用中",
 "tryAgain": "再試行",
 "name": "名前",
 "send": "送金",
 "to": "宛先",
 "amount": "数量",
 "lock": "ロック",
 "review": "確認",
 "max": "最大",
 "address": "アドレス",
 "tabWallet": "ウォレット",
 "tabTokens": "トークン",
 "tabStatus": "ステータス",
 "lockTheWallet": "ウォレットをロック",
 "unlockLocked": "ロックされています。続行するにはパスワードを入力してください。",
 "unlockChoosePassword": "このウォレットを保護するパスワードを設定してください。",
 "unlockTitle": "ロック解除",
 "createWalletTitle": "ウォレットを作成",
 "passwordLabel": "パスワード",
 "newPasswordLabel": "新しいパスワード（$1 文字以上）",
 "passwordPlaceholder": "パスワードを入力",
 "newPasswordPlaceholder": "安全なパスワード",
 "passwordAgainLabel": "もう一度入力",
 "passwordAgainPlaceholder": "同じパスワード",
 "unlockButton": "ロック解除",
 "createWalletButton": "ウォレットを作成",
 "passwordShow": "表示",
 "passwordHide": "非表示",
 "errorPasswordsDontMatch": "パスワードが一致しません",
 "importTitle": "シードフレーズをインポート",
 "seedNamePlaceholder": "私のシードフレーズ",
 "importWordsLabel": "12 単語または 24 単語",
 "importWordsPlaceholder": "word word word …",
 "errorSeedNotSaved": "シードフレーズは保存されませんでした",
 "newSeedTitle": "新しいシードフレーズ",
 "generateWords": "24 単語を生成",
 "writeDownTitle": "単語を書き留めてください",
 "writeDownWarning": "この 24 単語は、このウォレットを復元する唯一の手段です。これらの単語を見た人は誰でも、あなたの資金を自由に動かせます。また、Blaze Wallet はこれらの単語を復元できません。",
 "wroteDown": "24 単語すべてを順番どおりに書き留めました",
 "confirmTitle": "単語の確認",
 "confirmNote": "書き留めた内容を見て、次の単語を入力してください。",
 "wordNumber": "単語 #$1",
 "errorWordsDontMatch": "単語 $1 が一致しません。書き留めた内容を確認してください",
 "confirmAndSave": "確認して保存",
 "newAccountTitle": "新しいアカウント",
 "newAccountNote": "このシードフレーズの次のアドレスが、使用中のアカウントになります。",
 "createAccount": "アカウントを作成",
 "accountName": "アカウント $1",
 "noActiveAccount": "使用中のアカウントなし",
 "addAccountHint": "下のシードフレーズからアカウントを追加してください。",
 "seedPhrasesTitle": "シードフレーズ",
 "noSeedPhrases": "まだありません。新しく生成するか、お持ちのシードフレーズをインポートしてください。",
 "addAccount": "+ アカウント",
 "generateNew": "新規作成",
 "confirmUnlinkSeed": "このブラウザからこのシードフレーズのリンクを解除しますか？\n\nこのシードフレーズのアカウントと資金は、ブロックチェーン上に安全に残ります。ここで再び使うには、シードフレーズの単語が必要です。",
 "vaultTitle": "保管庫",
 "vaultKeys": "秘密鍵",
 "vaultKeysValue": "暗号化済み、このデバイスのみ",
 "vaultAutoLock": "自動ロック",
 "vaultAutoLockValue": "15 分間操作がないとき",
 "exportButton": "エクスポート",
 "exportDone": "ウォレットをエクスポートしました",
 "exportFailed": "ウォレットをエクスポートできませんでした",
 "confirmUnlinkWallet": "このブラウザからこのウォレットのリンクを解除しますか？\n\nすべてのシードフレーズとアカウントがこのデバイスから削除されます。資金はブロックチェーン上に安全に残りますが、再びアクセスするにはシードフレーズが必要です。",
 "themeLabel": "テーマ",
 "themeSystem": "システム",
 "themeSystemTitle": "このデバイスの設定に従う",
 "themeLight": "ライト",
 "themeLightTitle": "ライト · Bitcoin",
 "themeDark": "ダーク",
 "themeDarkTitle": "ダーク · RPG",
 "languageLabel": "言語",
 "languageAutomatic": "自動",
 "tokensTitle": "トークン",
 "refresh": "更新",
 "refreshTitle": "残高を更新",
 "totalValue": "総額",
 "tokenCount_other": "トークン $1 種類",
 "withoutPrice_other": "価格情報なし $1 種類",
 "loadingBalances": "残高を読み込み中…",
 "pricesUnavailable": "価格情報を利用できません：$1",
 "unlisted_other": "未掲載 $1 種類 · Charisma のトークンリストに掲載されておらず、詐欺の可能性があります",
 "onBlaze": "Blaze 上の $1",
 "units": "$1 単位",
 "rowUnlisted": "Charisma のトークンリストに掲載されていないため、ここからは送金できません",
 "rowUnknown": "不明なトークンです。最小単位で表示され、ここからは送金できません",
 "rowSend": "$1 を送金",
 "rowAllOnBlaze": "$1 はすべて Blaze 上にあります。Charisma Swap で移動してください",
 "sendTitle": "$1 を送金",
 "recipientLabel": "受取人",
 "blazeNote": "送金にはスタンダードの $1 $2 が使われます。Blaze 上の $3 はそのサブネットに残ります。Charisma Swap で移動してください。",
 "sentTitle": "$1 を送金しました",
 "sentNote": "Stacks での確定には数分かかります。",
 "viewOnExplorer": "エクスプローラーで表示",
 "networkFee": "ネットワーク手数料",
 "feeAutomatic": "自動設定",
 "safety": "安全",
 "safetyExact": "この数量だけ、それ以上は送られません",
 "sending": "送金中…",
 "errorRecipient": "Stacks アドレス（SP…）を入力してください",
 "errorAmountLike": "数量は $1 のように入力してください",
 "errorMaxDecimals_other": "小数点以下は $1 桁までです",
 "errorAmountPositive": "数量は 0 より大きくしてください",
 "errorYouHave": "残高は $1 $2 です",
 "checkedAt": "$1 に確認済み",
 "checking": "確認中…",
 "checkAgain": "再確認",
 "checkingButton": "確認中",
 "stateError": "エラー",
 "stateChecking": "確認中",
 "stateLive": "正常",
 "somethingWrong": "問題が発生しています",
 "stacksNetwork": "Stacks ネットワーク",
 "block": "ブロック",
 "response": "応答時間",
 "tokenListTitle": "Charisma トークンリスト",
 "statusTokens": "トークン数",
 "blazeSubnets": "Blaze サブネット",
 "holdingFunds": "資金を保有中",
 "noFundsOnSubnets_other": "$1 個のサブネットのいずれにも資金がありません。",
 "thisWallet": "このウォレット",
 "autoLockIn_other": "$1 分後",
 "tabCrashed": "このタブでエラーが発生しました",
 "cardSendStx": "STX を送金",
 "cardRunTransaction": "トランザクションを実行",
 "cardSignOrder": "注文に署名",
 "cardSignOrders_other": "$1 件の注文に署名",
 "cardSignMessage": "メッセージに署名",
 "cardConnect": "接続",
 "approveSign": "署名",
 "approveSignAll": "すべてに署名",
 "approveConnect": "接続",
 "deny": "拒否",
 "denyAndClose": "拒否して閉じる",
 "holdUnlockFirst": "先にロックを解除",
 "holdChecking": "確認中…",
 "lockedNote": "Blaze Wallet はロックされています。開いてロックを解除してください ›",
 "coveredNote": "何かがこのカードを覆っています。Blaze Wallet のウィンドウで続行してください ›",
 "errorNoAnswer": "Blaze Wallet から応答がありませんでした",
 "riskLow": "低リスク",
 "riskReview": "慎重に確認",
 "askConnect": "$1 が Blaze Wallet への接続を求めています",
 "askSignMessage": "$1 がこのメッセージへの署名を求めています",
 "askSignOrder": "$1 がサブネット注文への署名を求めています",
 "askSignData": "$1 が $2 向けのデータへの署名を求めています",
 "askSignOrders_other": "$1 が $2 件のサブネット注文への署名を求めています",
 "askSendStx": "$1 が STX の送金を求めています",
 "askRunTransaction": "$1 がトランザクションの実行を求めています",
 "shareAddressAs": "アドレス $1 を共有します",
 "shareAddress": "アドレスを共有します",
 "cantMoveFunds": "接続しても資金は動かせません。署名のたびに必ず確認を求めます",
 "signsAs": "$1 として署名します",
 "signsWithActive": "使用中のアカウントで署名します",
 "messageMovesNothing": "メッセージに署名しても資金は動きません",
 "payoutOnlyYou": "あなたにのみ",
 "payoutSubmitter": "提出者が選ぶ宛先ならどこへでも",
 "orderAction": "操作",
 "orderToken": "トークン",
 "amountSmallestUnits": "数量（最小単位）",
 "sendsTo": "送金先",
 "payout": "支払先",
 "handledBy": "$1 が処理",
 "orderId": "注文 ID",
 "orderData": "データ",
 "signsAsSentence": "$1 として署名します。",
 "orderRunsOnce": "この署名を持つ人は誰でも、この注文を一度実行できます。",
 "signOnlyRecognized": "内容に心当たりのあるデータにのみ署名してください。",
 "ordersCount": "注文数",
 "canSpendTotal": "支出できる合計",
 "smallestUnitsOf": "$1（$2 の最小単位）",
 "ordersRunOnce": "これらの署名を持つ人は誰でも、各注文を一度ずつ実行できます。",
 "memo": "メモ",
 "contract": "コントラクト",
 "function": "関数",
 "argument": "引数 $1",
 "allowMode": "⚠ あなたのトークンはどれでも動く可能性があります（許可モード）",
 "onlyTheseTransfers": "次の送金のみ可能です：",
 "noTokensLeave": "トークンがウォレットから出ることはありません",
 "sentFrom": "$1 から送信されます。",
 "feeSetAutomatically": "ネットワーク手数料は自動で設定されます。",
 "tokenSmallestUnits": "$1 $2（最小単位）",
 "pcYouSendExactly": "あなたがちょうど $1 を送金します",
 "pcTheySendExactly": "$1 がちょうど $2 を送金します",
 "pcYouSendMoreThan": "あなたが $1 より多くを送金します",
 "pcTheySendMoreThan": "$1 が $2 より多くを送金します",
 "pcYouSendAtLeast": "あなたが $1 以上を送金します",
 "pcTheySendAtLeast": "$1 が $2 以上を送金します",
 "pcYouSendLessThan": "あなたが $1 未満を送金します",
 "pcTheySendLessThan": "$1 が $2 未満を送金します",
 "pcYouSendAtMost": "あなたが $1 以下を送金します",
 "pcTheySendAtMost": "$1 が $2 以下を送金します",
 "pcYouSendNft": "あなたが $1 $2 を送ります",
 "pcTheySendNft": "$1 が $2 $3 を送ります",
 "pcYouKeepNft": "あなたは $1 $2 を保持します",
 "pcTheyKeepNft": "$1 は $2 $3 を保持します",
 "pcStacking": "$1：スタッキング条件",
 "pcYou": "あなた",
 "errorUnexpected": "問題が発生しました：$1",
 "errorInvalidSeedPhrase": "有効なシードフレーズではありません。各単語のつづりと、抜けている単語がないかを確認してください",
 "errorSeedNotFound": "シードフレーズが見つかりません",
 "errorNoActiveAccount": "Blaze Wallet に使用中のアカウントがありません",
 "errorStacksUnavailable": "Stacks ネットワークを利用できません（Hiro $1）",
 "errorTokenCacheEmpty": "Charisma のトークンキャッシュからトークンが返されませんでした",
 "errorLocked": "ウォレットはロックされています",
 "errorLockedIdle": "15 分間操作がなかったため、ウォレットがロックされました",
 "errorPasswordShort": "パスワードは $1 文字以上にしてください",
 "errorWrongPassword": "パスワードが正しくありません",
 "errorNoWallet": "ウォレットがまだありません",
 "errorSeedNameTaken": "「$1」という名前のシードフレーズはすでに存在します",
 "errorAccountNotFound": "アカウントが見つかりません",
 "errorBalances": "残高を読み込めませんでした（$1）",
 "errorTokenListUnavailable": "Charisma のトークンリストを利用できないため、トークンをブロックリストと照合できません",
 "errorRejected": "ネットワークが送金を拒否しました：$1",
 "errorRequestGone": "このリクエストはもう待機中ではありません"
}
```

`/tmp/blaze-ext-translations/pt_BR.json` (Brazilian Portuguese):

```json
{
 "extensionDescription": "Faça mais na rede Stacks. Assine uma vez ordens limitadas e compras programadas automáticas, liquidadas on-chain e pagas só a você.",
 "back": "Voltar",
 "cancel": "Cancelar",
 "continue": "Continuar",
 "done": "Concluído",
 "copy": "Copiar",
 "copied": "Copiado",
 "import": "Importar",
 "unlink": "Desvincular",
 "use": "Usar",
 "active": "Ativa",
 "tryAgain": "Tentar novamente",
 "name": "Nome",
 "send": "Enviar",
 "to": "Para",
 "amount": "Quantidade",
 "lock": "Bloquear",
 "review": "Revisar",
 "max": "Máx.",
 "address": "Endereço",
 "tabWallet": "Carteira",
 "tabTokens": "Tokens",
 "tabStatus": "Status",
 "lockTheWallet": "Bloquear a carteira",
 "unlockLocked": "Bloqueada. Digite sua senha para continuar.",
 "unlockChoosePassword": "Escolha uma senha para proteger esta carteira.",
 "unlockTitle": "Desbloquear",
 "createWalletTitle": "Criar sua carteira",
 "passwordLabel": "Senha",
 "newPasswordLabel": "Nova senha ($1 caracteres ou mais)",
 "passwordPlaceholder": "Sua senha",
 "newPasswordPlaceholder": "Uma senha forte",
 "passwordAgainLabel": "Digite novamente",
 "passwordAgainPlaceholder": "A mesma senha",
 "unlockButton": "Desbloquear",
 "createWalletButton": "Criar carteira",
 "passwordShow": "Mostrar",
 "passwordHide": "Ocultar",
 "errorPasswordsDontMatch": "As senhas não coincidem",
 "importTitle": "Importar frase de recuperação",
 "seedNamePlaceholder": "Minha frase de recuperação",
 "importWordsLabel": "12 ou 24 palavras",
 "importWordsPlaceholder": "word word word …",
 "errorSeedNotSaved": "A frase de recuperação não foi salva",
 "newSeedTitle": "Nova frase de recuperação",
 "generateWords": "Gerar 24 palavras",
 "writeDownTitle": "Anote estas palavras",
 "writeDownWarning": "Estas 24 palavras são a única forma de recuperar esta carteira. Qualquer pessoa que as veja controla seus fundos, e a Blaze Wallet não pode recuperá-las.",
 "wroteDown": "Anotei as 24 palavras, em ordem",
 "confirmTitle": "Confirme suas palavras",
 "confirmNote": "Digite estas palavras a partir do que você anotou.",
 "wordNumber": "Palavra #$1",
 "errorWordsDontMatch": "A palavra $1 não corresponde. Confira o que você anotou",
 "confirmAndSave": "Confirmar e salvar",
 "newAccountTitle": "Nova conta",
 "newAccountNote": "O próximo endereço desta frase de recuperação passa a ser sua conta ativa.",
 "createAccount": "Criar conta",
 "accountName": "Conta $1",
 "noActiveAccount": "Nenhuma conta ativa",
 "addAccountHint": "Adicione uma conta a partir de uma frase de recuperação abaixo.",
 "seedPhrasesTitle": "Frases de recuperação",
 "noSeedPhrases": "Nenhuma ainda. Gere uma nova ou importe a sua.",
 "addAccount": "+ Conta",
 "generateNew": "Gerar nova",
 "confirmUnlinkSeed": "Desvincular esta frase de recuperação deste navegador?\n\nAs contas e os fundos dela continuam seguros na blockchain. Para usá-los aqui de novo, você vai precisar das palavras da frase de recuperação.",
 "vaultTitle": "Cofre",
 "vaultKeys": "Chaves",
 "vaultKeysValue": "Criptografadas, só neste dispositivo",
 "vaultAutoLock": "Bloqueio automático",
 "vaultAutoLockValue": "Após 15 minutos de inatividade",
 "exportButton": "Exportar",
 "exportDone": "Carteira exportada",
 "exportFailed": "Não foi possível exportar a carteira",
 "confirmUnlinkWallet": "Desvincular esta carteira deste navegador?\n\nTodas as frases de recuperação e contas serão removidas deste dispositivo. Seus fundos continuam seguros na blockchain; você vai precisar da sua frase de recuperação para entrar de novo.",
 "themeLabel": "Tema",
 "themeSystem": "Sistema",
 "themeSystemTitle": "Usar o tema deste dispositivo",
 "themeLight": "Claro",
 "themeLightTitle": "Claro · Bitcoin",
 "themeDark": "Escuro",
 "themeDarkTitle": "Escuro · RPG",
 "languageLabel": "Idioma",
 "languageAutomatic": "Automático",
 "tokensTitle": "Tokens",
 "refresh": "Atualizar",
 "refreshTitle": "Atualizar saldos",
 "totalValue": "Valor total",
 "tokenCount_one": "$1 token",
 "tokenCount_many": "$1 tokens",
 "tokenCount_other": "$1 tokens",
 "withoutPrice_one": "$1 sem preço",
 "withoutPrice_many": "$1 sem preço",
 "withoutPrice_other": "$1 sem preço",
 "loadingBalances": "Carregando saldos…",
 "pricesUnavailable": "Preços indisponíveis: $1",
 "unlisted_one": "$1 não listado · não está na lista de tokens da Charisma, pode ser um golpe",
 "unlisted_many": "$1 não listados · não estão na lista de tokens da Charisma, podem ser golpes",
 "unlisted_other": "$1 não listados · não estão na lista de tokens da Charisma, podem ser golpes",
 "onBlaze": "$1 no Blaze",
 "units": "$1 unidades",
 "rowUnlisted": "Não está na lista de tokens da Charisma: excluído dos envios",
 "rowUnknown": "Token desconhecido: aparece em unidades mínimas e não pode ser enviado daqui",
 "rowSend": "Enviar $1",
 "rowAllOnBlaze": "Todo o seu saldo de $1 está no Blaze: mova-o com Charisma Swap",
 "sendTitle": "Enviar $1",
 "recipientLabel": "Destinatário",
 "blazeNote": "Os envios usam seu saldo Padrão de $1 $2. Seu saldo de $3 no Blaze fica na própria sub-rede; mova-o com Charisma Swap.",
 "sentTitle": "$1 enviado",
 "sentNote": "A confirmação na rede Stacks leva alguns minutos.",
 "viewOnExplorer": "Ver no explorador",
 "networkFee": "Taxa de rede",
 "feeAutomatic": "Automática",
 "safety": "Segurança",
 "safetyExact": "Exatamente esta quantidade, nada mais",
 "sending": "Enviando…",
 "errorRecipient": "Insira um endereço Stacks (SP…)",
 "errorAmountLike": "Insira uma quantidade como $1",
 "errorMaxDecimals_one": "No máximo $1 casa decimal",
 "errorMaxDecimals_many": "No máximo $1 casas decimais",
 "errorMaxDecimals_other": "No máximo $1 casas decimais",
 "errorAmountPositive": "A quantidade deve ser maior que zero",
 "errorYouHave": "Você tem $1 $2",
 "checkedAt": "Verificado: $1",
 "checking": "Verificando…",
 "checkAgain": "Verificar novamente",
 "checkingButton": "Verificando",
 "stateError": "Erro",
 "stateChecking": "Verificando",
 "stateLive": "Online",
 "somethingWrong": "Algo não está funcionando",
 "stacksNetwork": "Rede Stacks",
 "block": "Bloco",
 "response": "Resposta",
 "tokenListTitle": "Lista de tokens da Charisma",
 "statusTokens": "Tokens",
 "blazeSubnets": "Sub-redes do Blaze",
 "holdingFunds": "Com seus fundos",
 "noFundsOnSubnets_one": "Sem fundos em $1 sub-rede.",
 "noFundsOnSubnets_many": "Sem fundos em nenhuma das $1 sub-redes.",
 "noFundsOnSubnets_other": "Sem fundos em nenhuma das $1 sub-redes.",
 "thisWallet": "Esta carteira",
 "autoLockIn_one": "Em $1 min",
 "autoLockIn_many": "Em $1 min",
 "autoLockIn_other": "Em $1 min",
 "tabCrashed": "Esta guia parou de funcionar",
 "cardSendStx": "Enviar STX",
 "cardRunTransaction": "Executar uma transação",
 "cardSignOrder": "Assinar uma ordem",
 "cardSignOrders_one": "Assinar $1 ordem",
 "cardSignOrders_many": "Assinar $1 ordens",
 "cardSignOrders_other": "Assinar $1 ordens",
 "cardSignMessage": "Assinar uma mensagem",
 "cardConnect": "Conectar",
 "approveSign": "Assinar",
 "approveSignAll": "Assinar todas",
 "approveConnect": "Conectar",
 "deny": "Recusar",
 "denyAndClose": "Recusar e fechar",
 "holdUnlockFirst": "Desbloqueie a carteira primeiro",
 "holdChecking": "Verificando…",
 "lockedNote": "A Blaze Wallet está bloqueada. Abra para desbloquear ›",
 "coveredNote": "Algo está cobrindo este cartão. Continue em uma janela da Blaze Wallet ›",
 "errorNoAnswer": "A Blaze Wallet não respondeu",
 "riskLow": "Risco baixo",
 "riskReview": "Revise com cuidado",
 "askConnect": "$1 quer se conectar à Blaze Wallet",
 "askSignMessage": "$1 quer que você assine esta mensagem",
 "askSignOrder": "$1 quer que você assine uma ordem de sub-rede",
 "askSignData": "$1 quer que você assine dados para $2",
 "askSignOrders_one": "$1 quer que você assine $2 ordem de sub-rede",
 "askSignOrders_many": "$1 quer que você assine $2 ordens de sub-rede",
 "askSignOrders_other": "$1 quer que você assine $2 ordens de sub-rede",
 "askSendStx": "$1 quer que você envie STX",
 "askRunTransaction": "$1 quer que você execute uma transação",
 "shareAddressAs": "Compartilhar seu endereço $1",
 "shareAddress": "Compartilhar seu endereço",
 "cantMoveFunds": "Não pode movimentar fundos: cada assinatura exige sua aprovação",
 "signsAs": "Você assina como $1",
 "signsWithActive": "Você assina com sua conta ativa",
 "messageMovesNothing": "Assinar uma mensagem não movimenta fundos",
 "payoutOnlyYou": "Apenas para você",
 "payoutSubmitter": "Para onde quem a executar escolher",
 "orderAction": "Ação",
 "orderToken": "Token",
 "amountSmallestUnits": "Quantidade (unidades mínimas)",
 "sendsTo": "Envia para",
 "payout": "Pagamento",
 "handledBy": "Gerenciado por $1",
 "orderId": "ID da ordem",
 "orderData": "Dados",
 "signsAsSentence": "Você assina como $1.",
 "orderRunsOnce": "Qualquer pessoa que tenha esta assinatura pode executar esta ordem uma vez.",
 "signOnlyRecognized": "Assine apenas dados que você reconheça.",
 "ordersCount": "Ordens",
 "canSpendTotal": "Podem gastar no total",
 "smallestUnitsOf": "$1 (unidades mínimas de $2)",
 "ordersRunOnce": "Qualquer pessoa que tenha estas assinaturas pode executar cada ordem uma vez.",
 "memo": "Memo",
 "contract": "Contrato",
 "function": "Função",
 "argument": "Arg. $1",
 "allowMode": "⚠ Qualquer um dos seus tokens pode ser movimentado (modo allow)",
 "onlyTheseTransfers": "Apenas estas transferências podem acontecer:",
 "noTokensLeave": "Nenhum token pode sair da sua carteira",
 "sentFrom": "Será enviada de $1.",
 "feeSetAutomatically": "A taxa de rede é definida automaticamente.",
 "tokenSmallestUnits": "$1 $2 (unidades mínimas)",
 "pcYouSendExactly": "Você envia exatamente $1",
 "pcTheySendExactly": "$1 envia exatamente $2",
 "pcYouSendMoreThan": "Você envia mais de $1",
 "pcTheySendMoreThan": "$1 envia mais de $2",
 "pcYouSendAtLeast": "Você envia pelo menos $1",
 "pcTheySendAtLeast": "$1 envia pelo menos $2",
 "pcYouSendLessThan": "Você envia menos de $1",
 "pcTheySendLessThan": "$1 envia menos de $2",
 "pcYouSendAtMost": "Você envia no máximo $1",
 "pcTheySendAtMost": "$1 envia no máximo $2",
 "pcYouSendNft": "Você envia $1 $2",
 "pcTheySendNft": "$1 envia $2 $3",
 "pcYouKeepNft": "Você mantém $1 $2",
 "pcTheyKeepNft": "$1 mantém $2 $3",
 "pcStacking": "$1: condição de stacking",
 "pcYou": "Você",
 "errorUnexpected": "Algo deu errado: $1",
 "errorInvalidSeedPhrase": "Essa frase de recuperação não é válida: confira a grafia de cada palavra e se não falta nenhuma",
 "errorSeedNotFound": "Frase de recuperação não encontrada",
 "errorNoActiveAccount": "A Blaze Wallet não tem nenhuma conta ativa",
 "errorStacksUnavailable": "Rede Stacks indisponível (Hiro $1)",
 "errorTokenCacheEmpty": "O cache de tokens da Charisma não retornou nenhum token",
 "errorLocked": "A carteira está bloqueada",
 "errorLockedIdle": "A carteira foi bloqueada após 15 minutos de inatividade",
 "errorPasswordShort": "A senha deve ter pelo menos $1 caracteres",
 "errorWrongPassword": "Senha incorreta",
 "errorNoWallet": "Ainda não há nenhuma carteira",
 "errorSeedNameTaken": "Já existe uma frase de recuperação chamada “$1”",
 "errorAccountNotFound": "Conta não encontrada",
 "errorBalances": "Não foi possível carregar os saldos ($1)",
 "errorTokenListUnavailable": "A lista de tokens da Charisma está indisponível, então não é possível verificar se os tokens estão na lista de bloqueio",
 "errorRejected": "A rede rejeitou a transferência: $1",
 "errorRequestGone": "Esta solicitação não está mais pendente"
}
```

`/tmp/blaze-ext-translations/expand.mjs`:

```js
/**
 * Writes apps/signet/locales/{folder}/messages.json from a compact { key: message } file per language, each
 * description copied from English (a plural form English lacks, such as _many, takes the _other form's description).
 *   node expand.mjs apps/signet/locales ko.json zh_CN.json …
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"

const [locales, ...files] = process.argv.slice(2)
const english = JSON.parse(readFileSync(join(locales, "en/messages.json"), "utf8"))
const FORMS = ["zero", "one", "two", "few", "many", "other"]
const base = key => (FORMS.some(form => key.endsWith(`_${form}`)) ? key.slice(0, key.lastIndexOf("_")) : key)

for (const file of files) {
  const folder = basename(file, ".json")
  const messages = JSON.parse(readFileSync(file, "utf8"))
  const full = Object.fromEntries(Object.entries(messages).map(([key, message]) =>
    [key, { message, description: (english[key] ?? english[`${base(key)}_other`]).description }]))
  mkdirSync(join(locales, folder), { recursive: true })
  writeFileSync(join(locales, folder, "messages.json"), `${JSON.stringify(full, null, 2)}\n`)
  console.log(`${folder}: ${Object.keys(full).length} messages`)
}
```

Run: `node /tmp/blaze-ext-translations/expand.mjs apps/signet/locales /tmp/blaze-ext-translations/*.json`
Expected, one line per language: `de: 232 messages`, `es: 240 messages`, `fr: 240 messages`, `ja: 224 messages`, `ko: 224 messages`, `pt_BR: 240 messages`, `tr: 232 messages`, `zh_CN: 224 messages`. Korean, Chinese and Japanese have one plural form per counted phrase; Spanish, French and Brazilian Portuguese have three.

- [ ] **Write the check**

`apps/signet/scripts/check-locales.mjs`:

```js
/**
 * Fails when the extension's translations aren't complete and safe to ship (translations spec, "Check"):
 *   - every language has exactly English's keys (plural keys compared by base name), none empty
 *   - plural keys have every form the language's Intl.PluralRules needs
 *   - every message fills the same $1…$9 slots as English
 *   - no $word$ pattern anywhere: Chrome reads one as an undefined placeholder and won't load the extension
 *   - extensionDescription is 132 characters or fewer (Chrome's limit, in every language)
 *   - every key the code uses (t, plural, pluralKey, WalletError, and keys in quotes in label tables) exists in English
 * Run: pnpm --filter signet-signer check:locales (package:store runs it before building)
 */
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const FOLDERS = ["en", "ko", "zh_CN", "es", "fr", "de", "tr", "ja", "pt_BR"]
const LOCALES = { en: "en", ko: "ko", zh_CN: "zh-CN", es: "es", fr: "fr", de: "de", tr: "tr", ja: "ja", pt_BR: "pt-BR" }
const FORMS = ["zero", "one", "two", "few", "many", "other"]
const problems = []

const read = folder => JSON.parse(readFileSync(join(root, "locales", folder, "messages.json"), "utf8"))
const slots = message => [...new Set(message.match(/\$[1-9]/g) ?? [])].sort().join(" ")
/** "tokenCount_one" → "tokenCount"; other keys stay as they are */
const base = key => (FORMS.some(form => key.endsWith(`_${form}`)) ? key.slice(0, key.lastIndexOf("_")) : key)

const english = read("en")
const pluralBases = new Set(Object.keys(english).filter(key => base(key) !== key).map(base))

for (const folder of FOLDERS) {
  const messages = read(folder)
  const needed = new Intl.PluralRules(LOCALES[folder]).resolvedOptions().pluralCategories
  for (const [key, { message }] of Object.entries(messages)) {
    const where = `${folder}: "${key}"`
    if (!message?.trim()) problems.push(`${where} is empty`)
    if (/\$[A-Za-z0-9_@]+\$/.test(message ?? "")) problems.push(`${where} has a $word$ pattern Chrome would refuse to load`)
    if (!(key in english) && !pluralBases.has(base(key))) problems.push(`${where} isn't an English key`)
    const englishKey = key in english ? key : `${base(key)}_other`
    if (english[englishKey] && slots(message ?? "") !== slots(english[englishKey].message)) {
      problems.push(`${where} fills ${slots(message ?? "") || "no slots"}, English fills ${slots(english[englishKey].message) || "none"}`)
    }
  }
  for (const key of Object.keys(english).filter(key => base(key) === key && !pluralBases.has(key))) {
    if (!(key in messages)) problems.push(`${folder}: missing "${key}"`)
  }
  for (const key of pluralBases) {
    for (const form of needed) if (!messages[`${key}_${form}`]) problems.push(`${folder}: "${key}" has no "${form}" form`)
  }
  const description = messages.extensionDescription?.message ?? ""
  if ([...description].length > 132) problems.push(`${folder}: extensionDescription is ${[...description].length} characters (Chrome allows 132)`)
}

// Keys the code asks for
function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (/\.(ts|tsx)$/.test(entry.name)) yield path
  }
}
const used = new Set()
for (const file of files(join(root, "src"))) {
  const code = readFileSync(file, "utf8")
  for (const [, key] of code.matchAll(/\b(?:t|plural|pluralKey)\(\s*["'`]([A-Za-z0-9_]+)["'`]/g)) used.add(key)
  for (const [, key] of code.matchAll(/new WalletError\(\s*["'`]([A-Za-z0-9_]+)["'`]/g)) used.add(key)
  for (const [, key] of code.matchAll(/\b(?:ask|label|title|text)[=:]\s*\{?\s*["'`]([a-z][A-Za-z0-9_]+)["'`]/g)) used.add(key)
}
for (const key of used) {
  if (!(key in english) && !pluralBases.has(key)) problems.push(`code uses "${key}", which isn't in locales/en`)
}

if (problems.length) {
  console.error(`${problems.join("\n")}\n\n${problems.length} problem${problems.length === 1 ? "" : "s"}`)
  // exitCode, not exit(): exit() can cut off output still being written to a pipe
  process.exitCode = 1
} else {
  console.log(`Locales check out: ${FOLDERS.length} languages, ${Object.keys(english).length} English messages, ${used.size} keys used in the code`)
}
```

- [ ] **Translate the manifest, set the version, and run the check before packaging.** Save this patch as `/tmp/plan4-task1.patch`, then run `git apply --check /tmp/plan4-task1.patch && git apply /tmp/plan4-task1.patch`.

```diff
diff --git a/apps/signet/package.json b/apps/signet/package.json
index ea8484f..add431e 100644
--- a/apps/signet/package.json
+++ b/apps/signet/package.json
@@ -1,8 +1,8 @@
 {
   "name": "signet-signer",
   "displayName": "Blaze Wallet",
-  "version": "0.4.1",
-  "description": "Do more on Stacks. Sign once for limit orders and scheduled buys that run on their own, settled on-chain and paid only to you.",
+  "version": "0.5.0",
+  "description": "__MSG_extensionDescription__",
   "author": "Charisma Labs",
   "scripts": {
     "build": "plasmo build",
@@ -14,7 +14,8 @@
     "package": "plasmo package",
     "package:firefox": "plasmo package --target=firefox-mv2",
     "start:firefox": "web-ext run --source-dir ./build/firefox-mv2-dev",
-    "package:store": "plasmo build && node scripts/store-zip.mjs"
+    "check:locales": "node scripts/check-locales.mjs",
+    "package:store": "node scripts/check-locales.mjs && plasmo build && node scripts/store-zip.mjs"
   },
   "dependencies": {
     "@plasmohq/messaging": "^0.7.1",
@@ -43,7 +44,8 @@
   },
   "manifest": {
     "name": "Blaze Wallet",
-    "description": "Do more on Stacks. Sign once for limit orders and scheduled buys that run on their own, settled on-chain and paid only to you.",
+    "description": "__MSG_extensionDescription__",
+    "default_locale": "en",
     "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnSZTHNAdsOJq1A3Ii/DOZ+Y7xb9KI2Qz1JxNRQty6cLIXA4sm+OwD/tiPgvHJI5zdGXcR+hz9ChnWJLfCp3ju+lRFEJ0Y1cqbVRVN/m7rhp9x/IAFf37uIF2nnb5W3aBeYJzW0r3Kf8SUWvnUvfqYc5mbO1UXi6znHxFmiwekDoXlozDKzT/MSKxTHd1D9yBV0Ht5BCUSNmBPvrZRlbWkotC8rnlbpcWCpYUc7kTmllI9oNnNdgdLbZW3tXnB9KHZubyjK+FM+Ub6IWk0ewlZPHif3PwjSI9KZJWOgtRNSQJ6+JuMJOEGuqGVBQ1xd4Ljv34fC/EYcMeKVghD/5pZwIDAQAB",
     "permissions": [
       "storage",
```

- [ ] **Run the check**

Run: `node apps/signet/scripts/check-locales.mjs`
Expected: `Locales check out: 9 languages, 232 English messages, 0 keys used in the code` (no code uses them yet).

- [ ] **Commit**

```bash
git add apps/signet/locales apps/signet/scripts/check-locales.mjs apps/signet/package.json
git commit -m "feat(signet): Blaze Wallet's words in nine languages, and the check that guards them" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The extension speaks them

Every screen's text, every error and every number goes through the helper. The background words its errors in English only (for websites' JSON-RPC errors), and sends the wallet's pages a key to word themselves.

**Files:**
- Create: `apps/signet/src/shared/i18n-core.ts`, `apps/signet/src/shared/i18n.ts`, `apps/signet/src/shared/seed-words.ts`, `apps/signet/src/shared/errors.ts`, `apps/signet/src/background/lib/wallet-error.ts`
- Replace: `apps/signet/src/shared/ui.tsx`, `apps/signet/src/shared/wallet/WalletTab.tsx`, `apps/signet/src/shared/tabs/TransferTab.tsx`, `apps/signet/src/sidepanel/StatusTab.tsx`, `apps/signet/src/sidepanel/ErrorBoundary.tsx`, `apps/signet/src/sidepanel/components/diagnostics-context.tsx`, `apps/signet/src/tabs/approve.tsx`, `apps/signet/src/shared/approvals/parts/UIComponents.tsx`, `apps/signet/src/shared/approvals/ConnectContent.tsx`, `apps/signet/src/shared/approvals/SignMessageContent.tsx`, `apps/signet/src/shared/approvals/SignOrderContent.tsx`, `apps/signet/src/shared/approvals/SignOrdersContent.tsx`, `apps/signet/src/shared/approvals/TransactionContent.tsx` (whole files below)
- Modify: `apps/signet/src/background/lib/diagnostics.ts`, `apps/signet/src/background/lib/provider.ts`, `apps/signet/src/background/lib/tokens.ts`, `apps/signet/src/background/lib/wallet/index.ts`, `apps/signet/src/background/lib/wallet/seed.ts`, `apps/signet/src/background/lib/wallet/storage.ts`, `apps/signet/src/background/messages/handler.ts`, `apps/signet/src/shared/context/types.ts`, `apps/signet/src/shared/context/utils.ts`, `apps/signet/src/shared/notifications/NotificationPanel.tsx`, `apps/signet/src/shared/wallet/PasswordField.tsx`, `apps/signet/src/sidepanel/index.tsx` (one patch below)

- [ ] **Write the helper, seed words and errors**

`apps/signet/src/shared/i18n-core.ts`:

```ts
/**
 * Blaze Wallet's words in nine languages (translations spec). Looks up locales/{folder}/messages.json (Chrome's
 * format), fills in $1…$9 ($$ is a dollar sign) and picks plural forms. No DOM and no storage, so the background
 * service worker imports it too, in English only, to word WalletError.message. Pages use ./i18n.
 */
import de from "../../locales/de/messages.json"
import en from "../../locales/en/messages.json"
import es from "../../locales/es/messages.json"
import fr from "../../locales/fr/messages.json"
import ja from "../../locales/ja/messages.json"
import ko from "../../locales/ko/messages.json"
import pt_BR from "../../locales/pt_BR/messages.json"
import tr from "../../locales/tr/messages.json"
import zh_CN from "../../locales/zh_CN/messages.json"

/** Every language, in the picker's order, each named in its own language */
export const LANGUAGES = [
  { folder: "en", name: "English", locale: "en" },
  { folder: "ko", name: "한국어", locale: "ko" },
  { folder: "zh_CN", name: "简体中文", locale: "zh-CN" },
  { folder: "es", name: "Español", locale: "es" },
  { folder: "fr", name: "Français", locale: "fr" },
  { folder: "de", name: "Deutsch", locale: "de" },
  { folder: "tr", name: "Türkçe", locale: "tr" },
  { folder: "ja", name: "日本語", locale: "ja" },
  { folder: "pt_BR", name: "Português (Brasil)", locale: "pt-BR" },
] as const

export type Folder = (typeof LANGUAGES)[number]["folder"]
export type Fill = string | number

type Messages = Record<string, { message: string }>
const MESSAGES: Record<Folder, Messages> = { en, ko, zh_CN, es, fr, de, tr, ja, pt_BR }

/** The BCP 47 tag for Intl formatting */
export const localeOf = (folder: Folder) => LANGUAGES.find(language => language.folder === folder)!.locale

/**
 * The folder for a browser language, in Chrome's own order: the exact language (zh-CN → zh_CN), then its base
 * language when there's a folder for it (es-419 → es), otherwise English. So zh-TW and pt-PT start in English.
 */
export function match(uiLanguage: string): Folder {
  const tag = uiLanguage.replace(/-/g, "_").toLowerCase()
  const exact = LANGUAGES.find(language => language.folder.toLowerCase() === tag)
  if (exact) return exact.folder
  return LANGUAGES.find(language => language.folder === tag.split("_")[0])?.folder ?? "en"
}

/** A message with its $1…$9 filled in. A key a language doesn't have is a bug: check-locales stops it shipping. */
export function format(folder: Folder, key: string, fills: Fill[] = []): string {
  const entry = MESSAGES[folder][key]
  if (!entry) throw new Error(`Blaze Wallet has no ${folder} message "${key}"`)
  return entry.message.replace(/\$(\$|[1-9])/g, (_, slot: string) => {
    if (slot === "$") return "$"
    const fill = fills[Number(slot) - 1]
    if (fill === undefined) throw new Error(`Message "${key}" needs $${slot}`)
    return String(fill)
  })
}

/** The key of a counted phrase's form: `key_one`, `key_many`… as `count` needs in this language, else `key_other` */
export function pluralKey(folder: Folder, key: string, count: number): string {
  const form = new Intl.PluralRules(localeOf(folder)).select(count)
  return MESSAGES[folder][`${key}_${form}`] ? `${key}_${form}` : `${key}_other`
}

/** A counted phrase in its right form, filled in */
export const plural = (folder: Folder, key: string, count: number, fills: Fill[] = []) => format(folder, pluralKey(folder, key, count), fills)
```
`apps/signet/src/shared/i18n.ts`:

```ts
/**
 * Words for the wallet's own pages (side panel, approval window), in the language the person picked in the Vault
 * card, or Chrome's language when they left it on Automatic. The pick is saved in localStorage, like the theme:
 * every wallet page shares one origin, so one pick covers them all. Changing it reloads the page.
 */
import { LANGUAGES, format, localeOf, match, plural as pluralIn, pluralKey as pluralKeyIn, type Fill, type Folder } from "./i18n-core"

export { LANGUAGES, type Folder }

const STORAGE_KEY = "blaze-language"

export type LanguageChoice = "auto" | Folder

/** The saved pick; Automatic when there's none (or storage is blocked, as the theme does) */
export function readLanguage(): LanguageChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES.some(language => language.folder === saved)) return saved as Folder
  } catch {
    // Storage blocked: Automatic
  }
  return "auto"
}

/** Saves a pick and reloads, so every word and number on the page changes together */
export function pickLanguage(choice: LanguageChoice) {
  try {
    if (choice === "auto") localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, choice)
  } finally {
    location.reload()
  }
}

const choice = readLanguage()
export const folder: Folder = choice === "auto" ? match(chrome.i18n.getUILanguage()) : choice
/** For every Intl formatter on the page */
export const locale = localeOf(folder)
// Chinese and Japanese draw some shared characters differently: the page says which language it's in
document.documentElement.lang = locale

/** A message in the page's language, with $1…$9 filled in */
export const t = (key: string, ...fills: Fill[]) => format(folder, key, fills)

/** A counted phrase in the page's language; `count` picks the plural form, `fills` fill it (count included) */
export const plural = (key: string, count: number, ...fills: Fill[]) => pluralIn(folder, key, count, fills)

/** The key of a counted phrase's right form, for components that take a key (RequestHeader) */
export const pluralKey = (key: string, count: number) => pluralKeyIn(folder, key, count)

/** A whole number in the page's language */
export const count = (value: number) => value.toLocaleString(locale)
```
`apps/signet/src/shared/seed-words.ts`:

```ts
/**
 * Typed or pasted seed words, spelled the way the English BIP39 list spells them (translations spec, "Seed word
 * entry"): full-width letters and spaces become normal ones (NFKC, from Japanese, Chinese and Korean keyboards),
 * Turkish İ and ı become i, then lowercase without a locale (a Turkish locale turns I into ı) and single spaces.
 */
export const normalizeSeedWords = (text: string) =>
  text.normalize("NFKC").replace(/[İı]/g, "i").toLowerCase().trim().split(/\s+/).join(" ")
```
`apps/signet/src/shared/errors.ts`:

```ts
/**
 * Errors as the wallet's pages hold and show them. Pages keep the Error itself (not its message), so ErrorText can
 * tell the background's worded errors from unexpected ones, which get the "Something went wrong:" lead-in.
 */
import type { WireError } from "~background/lib/wallet-error"
import { t } from "./i18n"

/** Text from a library or a server, shown as-is after a translated lead-in */
export class UnexpectedError extends Error {
  readonly unexpected = true
}

/** A background error, worded in the page's language */
export const fromWire = (error: WireError | undefined): Error =>
  !error ? new UnexpectedError(t("errorNoAnswer")) : "key" in error ? new Error(t(error.key, ...error.fills)) : new UnexpectedError(error.message)

/** Anything caught, as an Error */
export const asError = (error: unknown): Error =>
  error instanceof Error ? error : new UnexpectedError(String(error))

/** An error as one line: unexpected ones lead in with "Something went wrong:" */
export const describeError = (error: Error) => (error instanceof UnexpectedError ? t("errorUnexpected", error.message) : error.message)
```
`apps/signet/src/background/lib/wallet-error.ts`:

```ts
/**
 * A failure the wallet's own pages show to the person: a message key and its fill-ins, so each page words it in
 * its own language. `message` is the English text, for everything else that reads it (logs, and the JSON-RPC
 * errors websites get, which stay English for developers).
 */
import { format, type Fill } from "~shared/i18n-core"

export class WalletError extends Error {
  constructor(readonly key: string, readonly fills: Fill[] = []) {
    super(format("en", key, fills))
    this.name = "WalletError"
  }
}

/** What crosses from the background to a page: a key to word, or a message from a library or a server */
export type WireError = { key: string; fills: Fill[] } | { message: string }

export const toWire = (error: unknown): WireError =>
  error instanceof WalletError ? { key: error.key, fills: error.fills } : { message: error instanceof Error ? error.message : String(error) }
```

- [ ] **Replace the side panel's and the approval window's screens** (whole files)

`apps/signet/src/shared/ui.tsx`:

```tsx
/**
 * Small pieces of Charisma's app look (@repo/brand's cx- widgets, as in Swap) shared by the wallet's screens, and
 * amounts in the page's language.
 */
import type { ReactNode } from "react"
import flameIcon from "data-base64:~assets/blaze-flame.svg"
import { describeError } from "~shared/errors"
import { locale } from "~shared/i18n"

/** A card with an optional title row */
export function Card({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="cx-card">
      {(title || right) && (
        <div className="w-card-head">
          {title && <h2>{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

/** The official Blaze Wallet flame: the same art as the toolbar icon */
export function BlazeFlame({ size }: { size: number }) {
  return <img src={flameIcon} width={size} height={size} alt="" style={{ display: "block", flex: "none" }} />
}

/** One label and value line; values read as numbers (mono) unless `text` */
export function Kv({ label, children, tone, text }: { label: string; children: ReactNode; tone?: "success" | "warning" | "danger"; text?: boolean }) {
  return (
    <div className={text ? "cx-kv w-kv-text" : "cx-kv"}>
      <span>{label}</span>
      <span style={tone ? { color: `var(--${tone})` } : undefined}>{children}</span>
    </div>
  )
}

/** An error, worded; unexpected ones (from a library or a server) lead in with "Something went wrong:" */
export function ErrorText({ error }: { error: Error | null }) {
  return error ? <p className="w-error" role="alert">{describeError(error)}</p> : null
}

/** This language's decimal mark: "." in English, "," in German */
export const decimalMark = new Intl.NumberFormat(locale).formatToParts(1.5).find(part => part.type === "decimal")!.value

/**
 * Smallest units as whole tokens in the page's language, exactly: 1500000 with 6 decimals is "1.5" in English and
 * "1,5" in German. `maxDecimals` cuts (never rounds) the fraction: the token list shows at most 6.
 */
export function formatUnits(raw: bigint, decimals: number, maxDecimals = decimals): string {
  // Instant balances go below zero when signed orders promise more than the wallet holds
  if (raw < 0n) return `-${formatUnits(-raw, decimals, maxDecimals)}`
  const text = raw.toString().padStart(decimals + 1, "0")
  const whole = text.slice(0, text.length - decimals)
  const fraction = text.slice(text.length - decimals).slice(0, maxDecimals).replace(/0+$/, "")
  return `${BigInt(whole).toLocaleString(locale)}${fraction ? `${decimalMark}${fraction}` : ""}`
}

/** The exact amount with this language's decimal mark and no grouping, so parseUnits reads it back (Max) */
export function editableUnits(raw: bigint, decimals: number): string {
  const text = raw.toString().padStart(decimals + 1, "0")
  const fraction = text.slice(text.length - decimals).replace(/0+$/, "")
  return `${text.slice(0, text.length - decimals)}${fraction ? `${decimalMark}${fraction}` : ""}`
}

/** "SP2ZNG…55KS" */
export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
```
`apps/signet/src/shared/wallet/WalletTab.tsx`:

```tsx
/**
 * WalletTab - lock and unlock, seed phrases, accounts, and the vault's settings.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { useSignetContext } from '~shared/context/SignetContext';
import { saveEncryptedWalletBackup, sendMessage } from '~shared/context/utils';
import { asError } from '~shared/errors';
import { LANGUAGES, pickLanguage, readLanguage, t, type LanguageChoice } from '~shared/i18n';
import { normalizeSeedWords } from '~shared/seed-words';
import { applyTheme, readTheme, type ThemeChoice } from '~shared/styles/theme';
import { BlazeFlame, Card, ErrorText, Kv, short } from '~shared/ui';
import { PasswordField } from './PasswordField';

type View = 'accounts' | 'newSeed' | 'importSeed' | 'newAccount';

/** The password's minimum length, as the vault checks it (background/lib/wallet/storage.ts) */
const MIN_PASSWORD_LENGTH = 8;

/** Unlock the wallet, or create it (password typed twice) when this browser has none yet */
function UnlockView() {
  const { hasWallet, initializeWallet, refreshWalletState } = useSignetContext();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<Error | null>(null);

  const submit = async () => {
    if (!password) return;
    if (!hasWallet && password !== confirm) return setError(new Error(t('errorPasswordsDontMatch')));
    setError(null);
    try {
      await initializeWallet(password);
      setPassword('');
      setConfirm('');
      refreshWalletState();
    } catch (err) {
      setError(asError(err));
    }
  };

  return (
    <div className="w-lock">
      <div className="w-brand">
        <BlazeFlame size={72} />
        <h1>Blaze Wallet</h1>
        <p>{hasWallet ? t('unlockLocked') : t('unlockChoosePassword')}</p>
      </div>
      <Card title={hasWallet ? t('unlockTitle') : t('createWalletTitle')}>
        <div className="w-stack">
          <PasswordField
            id="password"
            label={hasWallet ? t('passwordLabel') : t('newPasswordLabel', MIN_PASSWORD_LENGTH)}
            value={password}
            onChange={setPassword}
            onEnter={submit}
            placeholder={hasWallet ? t('passwordPlaceholder') : t('newPasswordPlaceholder')}
          />
          {!hasWallet && (
            <PasswordField id="password-again" label={t('passwordAgainLabel')} value={confirm} onChange={setConfirm} onEnter={submit} placeholder={t('passwordAgainPlaceholder')} />
          )}
          <ErrorText error={error} />
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit} disabled={!password}>
            {hasWallet ? t('unlockButton') : t('createWalletButton')}
          </button>
        </div>
      </Card>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="cx-btn cx-btn-quiet w-btn-sm" onClick={onClick}>
      <ArrowLeft size={14} aria-hidden /> {t('back')}
    </button>
  );
}

/** Import an existing seed phrase */
function ImportSeed({ onDone, onBack }: { onDone: (seedPhraseId: string) => void; onBack: () => void }) {
  const { importSeedPhrase } = useSignetContext();
  const [name, setName] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<Error | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const saved = await importSeedPhrase(name, phrase.trim());
      if (!saved) throw new Error(t('errorSeedNotSaved'));
      onDone(saved.id);
    } catch (err) {
      setError(asError(err));
    }
  };

  return (
    <Card title={t('importTitle')} right={<BackButton onClick={onBack} />}>
      <div className="w-stack">
        <label className="w-field" htmlFor="import-name">
          <span>{t('name')}</span>
          <input id="import-name" className="w-input" placeholder={t('seedNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="w-field" htmlFor="import-words">
          <span>{t('importWordsLabel')}</span>
          <textarea id="import-words" className="w-input w-mono" rows={4} placeholder={t('importWordsPlaceholder')} value={phrase} onChange={e => setPhrase(e.target.value)} spellCheck={false} />
        </label>
        <ErrorText error={error} />
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit} disabled={!name || !phrase.trim()}>{t('import')}</button>
      </div>
    </Card>
  );
}

/** Three random word positions (1-based) to confirm */
const pickChecks = (count: number) => {
  const picks = new Set<number>();
  const random = new Uint32Array(8);
  while (picks.size < 3) {
    crypto.getRandomValues(random);
    random.forEach(n => picks.size < 3 && picks.add((n % count) + 1));
  }
  return [...picks].sort((a, b) => a - b);
};

/**
 * A new seed phrase: name it, write the words down, confirm three of them. Nothing is saved until confirmed,
 * so no wallet ever exists with words nobody wrote down.
 */
function NewSeed({ onDone, onBack }: { onDone: (seedPhraseId: string) => void; onBack: () => void }) {
  const { importSeedPhrase } = useSignetContext();
  const [step, setStep] = useState<'name' | 'words' | 'confirm'>('name');
  const [name, setName] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [wroteDown, setWroteDown] = useState(false);
  const [checks, setChecks] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<Error | null>(null);

  const generate = async () => {
    setError(null);
    try {
      const phrase = await sendMessage<string>('generateSeedWords');
      const list = phrase.split(' ');
      setWords(list);
      setChecks(pickChecks(list.length));
      setStep('words');
    } catch (err) {
      setError(asError(err));
    }
  };

  const confirmAndSave = async () => {
    setError(null);
    // The same cleanup as importing: a Turkish İ or full-width letters still match
    const wrong = checks.filter(position => normalizeSeedWords(answers[position] ?? '') !== words[position - 1]);
    if (wrong.length) return setError(new Error(t('errorWordsDontMatch', wrong.map(position => `#${position}`).join(', '))));
    try {
      const saved = await importSeedPhrase(name, words.join(' '));
      if (!saved) throw new Error(t('errorSeedNotSaved'));
      onDone(saved.id);
    } catch (err) {
      setError(asError(err));
    }
  };

  if (step === 'name') {
    return (
      <Card title={t('newSeedTitle')} right={<BackButton onClick={onBack} />}>
        <div className="w-stack">
          <label className="w-field" htmlFor="seed-name">
            <span>{t('name')}</span>
            <input id="seed-name" className="w-input" placeholder={t('seedNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
          </label>
          <ErrorText error={error} />
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={generate} disabled={!name}>{t('generateWords')}</button>
        </div>
      </Card>
    );
  }

  if (step === 'words') {
    return (
      <Card title={t('writeDownTitle')} right={<BackButton onClick={onBack} />}>
        <div className="w-stack">
          <p className="w-warning">{t('writeDownWarning')}</p>
          <div className="w-words">
            {words.map((word, i) => (
              <div key={i} className="w-word"><i>{i + 1}</i><span>{word}</span></div>
            ))}
          </div>
          <label className="w-check">
            <input type="checkbox" checked={wroteDown} onChange={e => setWroteDown(e.target.checked)} />
            {t('wroteDown')}
          </label>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={() => setStep('confirm')} disabled={!wroteDown}>{t('continue')}</button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('confirmTitle')} right={<BackButton onClick={() => setStep('words')} />}>
      <div className="w-stack">
        <p className="w-note">{t('confirmNote')}</p>
        {checks.map(position => (
          <label key={position} className="w-field" htmlFor={`word-${position}`}>
            <span>{t('wordNumber', position)}</span>
            <input
              id={`word-${position}`}
              className="w-input w-mono"
              value={answers[position] ?? ''}
              onChange={e => setAnswers(current => ({ ...current, [position]: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ))}
        <ErrorText error={error} />
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={confirmAndSave} disabled={checks.some(position => !answers[position]?.trim())}>
          {t('confirmAndSave')}
        </button>
      </div>
    </Card>
  );
}

/** Derive the next account from a seed phrase */
function NewAccount({ seedPhraseId, onDone, onBack }: { seedPhraseId: string; onDone: () => void; onBack: () => void }) {
  const { createAccount, refreshWalletState } = useSignetContext();
  const [error, setError] = useState<Error | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await createAccount(seedPhraseId, true);
      await refreshWalletState();
      onDone();
    } catch (err) {
      setError(asError(err));
    }
  };

  return (
    <Card title={t('newAccountTitle')} right={<BackButton onClick={onBack} />}>
      <div className="w-stack">
        <p className="w-note">{t('newAccountNote')}</p>
        <ErrorText error={error} />
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit}>{t('createAccount')}</button>
      </div>
    </Card>
  );
}

const THEMES: { choice: ThemeChoice; label: string; title: string }[] = [
  { choice: 'system', label: 'themeSystem', title: 'themeSystemTitle' },
  { choice: 'light', label: 'themeLight', title: 'themeLightTitle' },
  { choice: 'dark', label: 'themeDark', title: 'themeDarkTitle' },
];

/** The theme for every wallet page and approval card: follow the device, Light · Bitcoin or Dark · RPG */
function ThemePicker() {
  const [current, setCurrent] = useState<ThemeChoice>(readTheme);
  const pick = (choice: ThemeChoice) => { applyTheme(choice); setCurrent(choice); };
  return (
    <div className="cx-kv w-kv-text">
      <span>{t('themeLabel')}</span>
      <div className="cx-segment" role="group" aria-label={t('themeLabel')}>
        {THEMES.map(({ choice, label, title }) => (
          <button key={choice} type="button" aria-pressed={current === choice} title={t(title)} onClick={() => pick(choice)}>{t(label)}</button>
        ))}
      </div>
    </div>
  );
}

/** The language for every wallet page and approval card: Chrome's (Automatic), or one picked here. Reloads. */
function LanguagePicker() {
  return (
    <label className="cx-kv w-kv-text" htmlFor="language">
      <span>{t('languageLabel')}</span>
      <select id="language" className="w-input" value={readLanguage()} onChange={e => pickLanguage(e.target.value as LanguageChoice)}>
        <option value="auto">{t('languageAutomatic')}</option>
        {LANGUAGES.map(({ folder, name }) => <option key={folder} value={folder} lang={folder.replace('_', '-')}>{name}</option>)}
      </select>
    </label>
  );
}

/** Copy the address, and say so for a moment */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
  return (
    <button type="button" className="cx-btn w-btn-sm" onClick={copy}>
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? t('copied') : t('copy')}
    </button>
  );
}

export function WalletTab() {
  const {
    isWalletInitialized,
    currentAccount,
    accounts,
    seedPhrases,
    activateAccount,
    deleteSeedPhrase,
    resetWallet,
    refreshWalletState,
    endSession,
  } = useSignetContext();
  const [view, setView] = useState<View>('accounts');
  const [seedPhraseId, setSeedPhraseId] = useState('');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (isWalletInitialized) refreshWalletState();
  }, [isWalletInitialized]);

  /** Run a wallet action, showing its error instead of losing it */
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(asError(err));
    }
  };

  const newAccountFor = (id: string) => { setSeedPhraseId(id); setView('newAccount'); };

  if (!isWalletInitialized) return <UnlockView />;

  const back = () => setView('accounts');

  if (view === 'newSeed') return <div className="w-page"><NewSeed onDone={newAccountFor} onBack={back} /></div>;
  if (view === 'importSeed') return <div className="w-page"><ImportSeed onDone={newAccountFor} onBack={back} /></div>;
  if (view === 'newAccount') return <div className="w-page"><NewAccount seedPhraseId={seedPhraseId} onDone={back} onBack={back} /></div>;

  return (
    <div className="w-page">
      {currentAccount ? (
        <Card title={t('accountName', currentAccount.index + 1)} right={<span className="cx-pill cx-pill-success">{t('active')}</span>}>
          <div className="w-row" style={{ paddingTop: 0 }}>
            <span className="w-address" style={{ flex: 1 }}>{currentAccount.stxAddress}</span>
            <CopyButton text={currentAccount.stxAddress} />
          </div>
        </Card>
      ) : (
        <Card title={t('noActiveAccount')}>
          <p className="w-warning">{t('addAccountHint')}</p>
        </Card>
      )}

      <Card title={t('seedPhrasesTitle')} right={<span className="cx-pill cx-pill-plain">{seedPhrases.length}</span>}>
        <div className="w-stack">
          {seedPhrases.length === 0 && <p className="w-note">{t('noSeedPhrases')}</p>}
          {seedPhrases.map(phrase => {
            const phraseAccounts = accounts.filter(account => account.seedPhraseId === phrase.id);
            return (
              <div key={phrase.id} className="cx-pane">
                <div className="w-card-head">
                  <h2>{phrase.name}</h2>
                  <span className="w-actions" style={{ flex: 'none' }}>
                    <button type="button" className="cx-btn w-btn-sm" onClick={() => newAccountFor(phrase.id)}>{t('addAccount')}</button>
                    <button
                      type="button"
                      className="cx-btn w-btn-sm w-btn-danger"
                      onClick={() => confirm(t('confirmUnlinkSeed'))
                        && run(async () => { await deleteSeedPhrase(phrase.id); await refreshWalletState(); })}
                    >
                      {t('unlink')}
                    </button>
                  </span>
                </div>
                {phraseAccounts.map(account => (
                  <div key={account.id} className="w-row">
                    <div className="w-row-main">
                      <strong>{t('accountName', account.index + 1)}</strong>
                      <span className="w-mono">{short(account.stxAddress)}</span>
                    </div>
                    {account.isActive
                      ? <span className="cx-pill cx-pill-success">{t('active')}</span>
                      : <button type="button" className="cx-btn w-btn-sm" onClick={() => run(async () => { await activateAccount(account.id); await refreshWalletState(); })}>{t('use')}</button>}
                  </div>
                ))}
              </div>
            );
          })}
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => setView('newSeed')}>{t('generateNew')}</button>
            <button type="button" className="cx-btn" onClick={() => setView('importSeed')}>{t('import')}</button>
          </div>
        </div>
      </Card>

      <Card title={t('vaultTitle')}>
        <Kv label={t('vaultKeys')} text>{t('vaultKeysValue')}</Kv>
        <Kv label={t('vaultAutoLock')} text>{t('vaultAutoLockValue')}</Kv>
        <ThemePicker />
        <LanguagePicker />
        <div className="w-stack" style={{ marginTop: '12px' }}>
          <ErrorText error={error} />
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => run(saveEncryptedWalletBackup)}>{t('exportButton')}</button>
            <button type="button" className="cx-btn" onClick={() => run(endSession)}>{t('lock')}</button>
            <button
              type="button"
              className="cx-btn w-btn-danger"
              onClick={() => confirm(t('confirmUnlinkWallet'))
                && run(async () => { await resetWallet(); await refreshWalletState(); })}
            >
              {t('unlink')}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
```
`apps/signet/src/shared/tabs/TransferTab.tsx`:

```tsx
/**
 * TransferTab (Tokens) - the active account's tokens (STX and every SIP-10 it holds), and sending them.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Flame, RefreshCw } from 'lucide-react';
import { useSignetContext } from '~shared/context/SignetContext';
import { sendMessage } from '~shared/context/utils';
import { asError } from '~shared/errors';
import { count, locale, plural, t } from '~shared/i18n';
import { Card, ErrorText, Kv, decimalMark, editableUnits, formatUnits } from '~shared/ui';
import type { TokenBalance } from '~background/lib/tokens';
import { BALANCE_SERVICE } from '~shared/balance-service';
import { AnimatedAmount } from '~shared/AnimatedAmount';
import type { BalanceSheet } from 'blaze-sdk';

/** The token list shows at most this many decimals, cut (not rounded) */
const LIST_DECIMALS = 6;

/** What someone typed, as raw smallest units, exactly (no floating point): only this language's decimal mark */
function parseUnits(text: string, decimals: number) {
  const parts = text.trim().split(decimalMark);
  if (parts.length > 2 || !parts.every(part => /^\d*$/.test(part)) || !parts.some(Boolean)) throw new Error(t('errorAmountLike', `1${decimalMark}5`));
  const [whole, frac = ''] = parts;
  if (frac.length > decimals) throw new Error(plural('errorMaxDecimals', decimals, count(decimals)));
  return (BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0')).toString();
}

const usd = (value: number) =>
  value.toLocaleString(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 2 });

/** Stacks and Blaze together, smallest units: the token's one balance */
const totalOf = (token: TokenBalance) => (BigInt(token.balance) + BigInt(token.blaze)).toString();

/** Whole-token amount of the whole balance (for pricing; display uses formatUnits) */
const units = (token: TokenBalance) => Number(totalOf(token)) / 10 ** token.meta!.decimals;

const label = (token: TokenBalance) => token.meta?.symbol ?? token.contractId.split('.')[1];

/** The token list's amount: at most 6 decimals */
const listAmount = (raw: string, decimals: number) => formatUnits(BigInt(raw), decimals, LIST_DECIMALS);

function TokenIcon({ token }: { token: TokenBalance }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="cx-token">
      {token.meta?.image && !broken
        ? <img src={token.meta.image} alt="" onError={() => setBroken(true)} />
        : label(token).charAt(0).toUpperCase()}
    </span>
  );
}

/** Placeholder rows shaped like token rows, while balances load */
function TokenSkeletons() {
  return (
    <div className="cx-list" aria-label={t('loadingBalances')}>
      {[48, 36, 42].map((nameWidth, i) => (
        <div key={i} className="cx-token-row" style={{ cursor: 'default' }}>
          <span className="cx-skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          <div className="cx-token-row-name" style={{ gap: 6 }}>
            <span className="cx-skeleton" style={{ width: nameWidth, height: 12 }} />
            <span className="cx-skeleton" style={{ width: nameWidth * 1.8, height: 10 }} />
          </div>
          <span className="cx-skeleton" style={{ width: 64, height: 12 }} />
        </div>
      ))}
    </div>
  );
}

function SendForm({ token, onDone, onCancel }: { token: TokenBalance; onDone: () => void; onCancel: () => void }) {
  const decimals = token.meta!.decimals;
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const toReview = () => {
    setError(null);
    try {
      if (!/^S[PM][0-9A-Z]{38,40}(\.[a-zA-Z][\w-]*)?$/.test(recipient.trim())) throw new Error(t('errorRecipient'));
      const raw = parseUnits(amount, decimals);
      if (BigInt(raw) <= 0n) throw new Error(t('errorAmountPositive'));
      if (BigInt(raw) > BigInt(token.balance)) throw new Error(t('errorYouHave', formatUnits(BigInt(token.balance), decimals), label(token)));
      setReview(raw);
    } catch (err) {
      setError(asError(err));
    }
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await sendMessage<{ txid: string }>('sendToken', { contractId: token.contractId, asset: token.asset, recipient: recipient.trim(), amount: review });
      setTxid(result.txid);
    } catch (err) {
      setError(asError(err));
    } finally {
      setBusy(false);
    }
  };

  if (txid) {
    const id = txid.startsWith('0x') ? txid : `0x${txid}`;
    return (
      <Card title={t('sentTitle', label(token))}>
        <div className="w-stack">
          <p className="w-note">{t('sentNote')}</p>
          <a className="cx-btn" href={`https://explorer.hiro.so/txid/${id}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
            {t('viewOnExplorer')} <ExternalLink size={14} aria-hidden />
          </a>
          <button type="button" className="cx-btn cx-btn-primary" onClick={onDone}>{t('done')}</button>
        </div>
      </Card>
    );
  }

  if (review) {
    return (
      <Card title={t('sendTitle', label(token))}>
        {/* The review shows the exact amount, every decimal: what leaves is never hidden by rounding */}
        <Kv label={t('send')}>{formatUnits(BigInt(review), decimals)} {label(token)}</Kv>
        <Kv label={t('to')}><span className="w-address">{recipient.trim()}</span></Kv>
        <Kv label={t('networkFee')}>{t('feeAutomatic')}</Kv>
        {token.contractId !== '.stx' && <Kv label={t('safety')} tone="success">{t('safetyExact')}</Kv>}
        <div className="w-stack" style={{ marginTop: '12px' }}>
          <ErrorText error={error} />
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => setReview(null)} disabled={busy}>{t('back')}</button>
            <button type="button" className="cx-btn cx-btn-primary" onClick={send} disabled={busy}>
              {busy && <span className="cx-spinner" aria-hidden />} {busy ? t('sending') : t('send')}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('sendTitle', label(token))}>
      <div className="w-stack">
        <label className="w-field" htmlFor="send-to">
          <span>{t('recipientLabel')}</span>
          <input id="send-to" className="w-input w-mono" placeholder="SP…" value={recipient} onChange={e => setRecipient(e.target.value)} spellCheck={false} />
        </label>
        <label className="w-field" htmlFor="send-amount">
          <span>{t('amount')}</span>
          <div className="w-input-wrap">
            <input id="send-amount" className="w-input w-mono" placeholder={`0${decimalMark}0 ${label(token)}`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
            {/* Max is the exact balance, every decimal, with this language's decimal mark and no grouping */}
            <button type="button" className="cx-chip" onClick={() => setAmount(editableUnits(BigInt(token.balance), decimals))}>{t('max')}</button>
          </div>
        </label>
        {token.blaze !== '0' && (
          <p className="w-note">{t('blazeNote', listAmount(token.balance, decimals), label(token), listAmount(token.blaze, decimals))}</p>
        )}
        <ErrorText error={error} />
        <div className="w-actions">
          <button type="button" className="cx-btn" onClick={onCancel}>{t('cancel')}</button>
          <button type="button" className="cx-btn cx-btn-primary" onClick={toReview}>{t('review')}</button>
        </div>
      </div>
    </Card>
  );
}

export function TransferTab() {
  const { currentAccount } = useSignetContext();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [showUnlisted, setShowUnlisted] = useState(false);
  const [priceError, setPriceError] = useState<Error | null>(null);

  const load = () => {
    setError(null);
    setBalances(null);
    setPriceError(null);
    sendMessage<TokenBalance[]>('getWalletBalances')
      .then(setBalances)
      .catch(err => setError(asError(err)));
    // Prices are separate: balances still show if the price feed is down
    sendMessage<Record<string, number>>('getUsdPrices')
      .then(setPrices)
      .catch(err => setPriceError(asError(err)));
  };

  /** USD value of a balance, or null when the feed has no price for it */
  const valueOf = (token: TokenBalance) => {
    const price = prices?.[token.contractId];
    return token.meta && price !== undefined ? units(token) * price : null;
  };
  const listed = balances?.filter(token => token.listed) ?? [];
  const unlisted = balances?.filter(token => !token.listed) ?? [];
  const priced = listed.map(valueOf).filter((value): value is number => value !== null);
  const total = priced.reduce((sum, value) => sum + value, 0);

  useEffect(load, [currentAccount?.stxAddress]);

  // While the tab is open, balances are pushed the moment anything changes (no polling); the browser reconnects itself
  useEffect(() => {
    const address = currentAccount?.stxAddress;
    if (!address) return;
    const stream = new EventSource(`${BALANCE_SERVICE}/api/v1/balances/${address}/stream`);
    stream.addEventListener('sheet', event => {
      const sheet = JSON.parse((event as MessageEvent<string>).data) as BalanceSheet;
      sendMessage<TokenBalance[]>('getWalletBalances', { sheet }).then(setBalances).catch(err => setError(asError(err)));
    });
    return () => stream.close();
  }, [currentAccount?.stxAddress]);

  /** One token row; unlisted and unknown tokens can't be opened for sending */
  const row = (token: TokenBalance) => {
    const key = `${token.contractId}::${token.asset}`;
    const open = selected === key;
    // Sends spend the Standard balance; a token held only on Blaze has nothing here to send
    const sendable = !!token.meta && token.listed && token.balance !== '0';
    const value = valueOf(token);
    return (
      <div key={key} className="w-stack" style={{ gap: '8px' }}>
        <div
          className="cx-token-row"
          role={sendable ? 'button' : undefined}
          tabIndex={sendable ? 0 : undefined}
          aria-selected={open}
          style={sendable ? undefined : { cursor: 'default' }}
          onClick={() => sendable && setSelected(open ? null : key)}
          onKeyDown={e => { if (sendable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelected(open ? null : key); } }}
          title={!token.listed ? t('rowUnlisted') : !token.meta ? t('rowUnknown') : sendable ? t('rowSend', label(token)) : t('rowAllOnBlaze', label(token))}
        >
          <TokenIcon token={token} />
          <div className="cx-token-row-name">
            <strong>{label(token)}</strong>
            {token.blaze !== '0' && token.meta ? (
              <span className="w-blaze-line"><Flame size={11} aria-hidden /> {t('onBlaze', listAmount(token.blaze, token.meta.decimals))}</span>
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.meta?.name ?? token.contractId}</span>
            )}
          </div>
          <div className="cx-token-row-bal">
            {token.meta
              // Rolls through approximate values, then rests on the exact amount
              ? <AnimatedAmount key={key} value={Number(totalOf(token))} format={n => listAmount(n === Number(totalOf(token)) ? totalOf(token) : String(Math.round(n)), token.meta!.decimals)} />
              : t('units', totalOf(token))}
            <span>{prices ? (value === null ? '—' : usd(value)) : ''}</span>
          </div>
        </div>
        {open && token.meta && <SendForm token={token} onCancel={() => setSelected(null)} onDone={() => { setSelected(null); load(); }} />}
      </div>
    );
  };

  return (
    <div className="w-page">
      <Card
        right={
          <button type="button" className="cx-btn w-btn-sm" onClick={load} title={t('refreshTitle')}>
            <RefreshCw size={14} aria-hidden /> {t('refresh')}
          </button>
        }
        title={t('tokensTitle')}
      >
        <div className="cx-label">{t('totalValue')}</div>
        <div className="w-total">{balances && prices ? usd(total) : '…'}</div>
        <p className="w-note">
          {balances ? plural('tokenCount', listed.length, count(listed.length)) : t('loadingBalances')}
          {balances && prices && priced.length < listed.length ? ` · ${plural('withoutPrice', listed.length - priced.length, count(listed.length - priced.length))}` : ''}
        </p>
      </Card>

      <ErrorText error={error} />
      {/* Its own lead-in, so the raw message: never "Prices unavailable: Something went wrong: …" */}
      {priceError && <p className="w-warning" role="alert">{t('pricesUnavailable', priceError.message)}</p>}
      {!balances && !error && <TokenSkeletons />}
      {balances && (
        <div className="cx-list">
          {listed.map(row)}
          {unlisted.length > 0 && (
            <button type="button" className="cx-btn cx-btn-quiet" style={{ justifyContent: 'flex-start', height: 'auto', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setShowUnlisted(open => !open)} aria-expanded={showUnlisted}>
              {showUnlisted ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
              <span>{plural('unlisted', unlisted.length, count(unlisted.length))}</span>
            </button>
          )}
          {showUnlisted && unlisted.map(row)}
        </div>
      )}
    </div>
  );
}
```
`apps/signet/src/sidepanel/StatusTab.tsx`:

```tsx
/**
 * Status: is everything working? The Stacks network, Charisma's token list, every Blaze subnet with this
 * account's balance on it, and the auto-lock timer, from real checks in the background (diagnostics).
 */
import { RefreshCw } from "lucide-react"
import { useDiagnostics } from "./components/diagnostics-context"
import { count, locale, plural, t } from "~shared/i18n"
import { Card, ErrorText, Kv, short } from "~shared/ui"

/** Smallest units → short readable amount, rounded to 4 decimals (Status's precision) */
const formatUnits = (raw: string, decimals: number) =>
  (Number(raw) / 10 ** decimals).toLocaleString(locale, { maximumFractionDigits: 4 })

/** Instant is full, 2 seconds or slower is empty */
const healthOf = (ms: number) => Math.max(4, Math.min(100, 100 - ms / 20))
const speedTone = (ms: number) => (ms < 600 ? "success" : ms < 1500 ? "warning" : "danger")

function Speed({ ms }: { ms: number }) {
  return (
    <>
      <Kv label={t("response")} tone={speedTone(ms)}>{count(ms)} ms</Kv>
      <div className="cx-progress"><span style={{ width: `${healthOf(ms)}%`, background: `var(--${speedTone(ms)})` }} /></div>
    </>
  )
}

export function StatusTab() {
  const { diag, loading, error, refresh } = useDiagnostics()
  const held = diag?.subnets.filter(subnet => subnet.balance && subnet.balance !== "0") ?? []
  const lockMinutes = diag?.account.lockExpiresAt ? Math.max(0, Math.ceil((diag.account.lockExpiresAt - Date.now()) / 60000)) : null
  const state = error ? { text: t("stateError"), tone: "danger" } : !diag ? { text: t("stateChecking"), tone: "warning" } : { text: t("stateLive"), tone: "success" }

  return (
    <div className="w-page">
      <div className="w-card-head" style={{ margin: 0 }}>
        <p className="w-note">
          {diag ? t("checkedAt", new Date(diag.checkedAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })) : t("checking")}
        </p>
        <button type="button" className="cx-btn w-btn-sm" onClick={refresh} disabled={loading}>
          {loading ? <span className="cx-spinner" aria-hidden /> : <RefreshCw size={14} aria-hidden />} {loading ? t("checkingButton") : t("checkAgain")}
        </button>
      </div>

      {error && (
        <Card title={t("somethingWrong")}>
          <ErrorText error={error} />
        </Card>
      )}

      <Card title={t("stacksNetwork")} right={<span className={`cx-pill cx-pill-${state.tone}`}>{state.text}</span>}>
        <Kv label={t("block")}>{diag ? count(diag.network.blockHeight) : "—"}</Kv>
        {diag && <Speed ms={diag.network.latencyMs} />}
      </Card>

      <Card title={t("tokenListTitle")}>
        <Kv label={t("statusTokens")}>{diag ? count(diag.tokenCache.tokens) : "—"}</Kv>
        {diag && <Speed ms={diag.tokenCache.latencyMs} />}
      </Card>

      <Card title={t("blazeSubnets")} right={diag && <span className="cx-pill cx-pill-plain">{count(diag.subnets.length)}</span>}>
        <Kv label={t("holdingFunds")}>{diag ? count(held.length) : "—"}</Kv>
        {diag && (
          held.length > 0 ? (
            <div style={{ marginTop: "8px" }}>
              {held.map(subnet => (
                <div key={subnet.contractId} className="w-row">
                  <div className="w-row-main">
                    <strong>{subnet.symbol}</strong>
                    <span>{subnet.contractId.split(".")[1]}</span>
                  </div>
                  <span className="w-mono">{formatUnits(subnet.balance!, subnet.decimals)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="w-note" style={{ marginTop: "8px" }}>{plural("noFundsOnSubnets", diag.subnets.length, count(diag.subnets.length))}</p>
          )
        )}
      </Card>

      <Card title={t("thisWallet")}>
        <Kv label={t("address")}>{diag ? short(diag.account.address) : "—"}</Kv>
        <Kv label={t("vaultAutoLock")}>{lockMinutes === null ? "—" : plural("autoLockIn", lockMinutes, count(lockMinutes))}</Kv>
        {lockMinutes !== null && <div className="cx-progress"><span style={{ width: `${(lockMinutes / 15) * 100}%` }} /></div>}
      </Card>
    </div>
  )
}
```
`apps/signet/src/sidepanel/ErrorBoundary.tsx`:

```tsx
/**
 * Shows a tab's crash (message and where it happened) instead of a blank panel.
 */
import { Component, type ReactNode } from "react"
import { t } from "~shared/i18n"
import { Card } from "~shared/ui"

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="w-page">
        <Card title={t("tabCrashed")}>
          <div className="w-stack">
            <p className="w-error">{error.message}</p>
            <pre className="w-mono" style={{ whiteSpace: "pre-wrap", fontSize: "11px", lineHeight: "16px", color: "var(--ink-muted)", margin: 0, maxHeight: "240px", overflow: "auto" }}>{error.stack}</pre>
            <button type="button" className="cx-btn" onClick={() => this.setState({ error: null })}>{t("tryAgain")}</button>
          </div>
        </Card>
      </div>
    )
  }
}
```
`apps/signet/src/sidepanel/components/diagnostics-context.tsx`:

```tsx
/**
 * Real status checks for the Status tab, loaded from the background. Each check is about
 * 20 Hiro reads, so it refreshes every 5 minutes and only while the side panel is visible (Hiro rate-limits).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { sendMessage } from "~shared/context/utils"
import { asError } from "~shared/errors"
import type { Diagnostics } from "~background/lib/diagnostics"

const REFRESH_MS = 5 * 60_000

interface DiagnosticsState {
  diag: Diagnostics | null
  error: Error | null
  loading: boolean
  refresh: () => void
}

const DiagnosticsContext = createContext<DiagnosticsState | null>(null)

export function DiagnosticsProvider({ children }: { children: ReactNode }) {
  const [diag, setDiag] = useState<Diagnostics | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = () => {
    setLoading(true)
    sendMessage<Diagnostics>("getDiagnostics")
      .then(next => { setDiag(next); setError(null) })
      .catch(err => setError(asError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  return <DiagnosticsContext.Provider value={{ diag, error, loading, refresh }}>{children}</DiagnosticsContext.Provider>
}

export function useDiagnostics() {
  const context = useContext(DiagnosticsContext)
  if (!context) throw new Error("useDiagnostics must be used within a DiagnosticsProvider")
  return context
}
```
`apps/signet/src/tabs/approve.tsx`:

```tsx
/**
 * The sealed approval: a Blaze Wallet page shown in a frame over the site (or in its own window).
 *
 * The site can't read or click inside it. Approve is held until Chrome's visibility check
 * (IntersectionObserver v2) has seen the whole card, fully on screen, uncovered and unfaded for a full
 * second, so a site can't trick you by laying something over it or sliding most of it away. Every click
 * while it's held starts that second again, so rapid clicking can't land on Approve the moment it opens.
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import NotificationPanel from "~shared/notifications/NotificationPanel"
import { ConnectContent } from "~shared/approvals/ConnectContent"
import { SignMessageContent } from "~shared/approvals/SignMessageContent"
import type { ApprovalRequest } from "~background/lib/provider"
import { SignOrderContent } from "~shared/approvals/SignOrderContent"
import { SignOrdersContent } from "~shared/approvals/SignOrdersContent"
import { TransactionContent } from "~shared/approvals/TransactionContent"
import "@repo/brand/tokens.css"
import "@repo/brand/fonts.css"
import "@repo/brand/components.css"
import { applySavedTheme } from "~shared/styles/theme"
import { fromWire } from "~shared/errors"
import { count, plural, t } from "~shared/i18n"
import { ErrorText } from "~shared/ui"
import "~shared/styles/style.css"

applySavedTheme()

const [requestId, mode] = location.hash.slice(1).split("&")
// Signet's own window, never a frame: a site that frames this page with "&window" still gets the visibility check
const inWindow = mode === "window" && window.top === window
const SEEN_FOR_MS = 1000
const FALLBACK_AFTER_MS = 4000

interface Details extends ApprovalRequest {
  unlocked: boolean
  address: string | null
}

/** The card for each kind of request: title, approve label, and what's being asked */
function cardFor(details: Details) {
  if (details.method === "stx_transferStx" || details.method === "stx_callContract") {
    return {
      title: details.method === "stx_transferStx" ? t("cardSendStx") : t("cardRunTransaction"),
      approve: t("send"),
      content: <TransactionContent origin={details.origin} address={details.address} method={details.method} params={details.params as Record<string, any>} />
    }
  }
  if (details.method === "stx_signStructuredMessage") {
    const { message, domain } = details.params as { message: string; domain: string }
    return {
      title: t("cardSignOrder"),
      approve: t("approveSign"),
      content: <SignOrderContent origin={details.origin} address={details.address} message={message} domain={domain} />
    }
  }
  if (details.method === "blaze_signStructuredMessages") {
    const { messages } = details.params as { messages: string[] }
    return {
      title: plural("cardSignOrders", messages.length, count(messages.length)),
      approve: t("approveSignAll"),
      content: <SignOrdersContent origin={details.origin} address={details.address} messages={messages} />
    }
  }
  if (details.method === "stx_signMessage") {
    const { message } = details.params as { message: string }
    return {
      title: t("cardSignMessage"),
      approve: t("approveSign"),
      content: <SignMessageContent origin={details.origin} address={details.address} message={message} />
    }
  }
  return {
    title: t("cardConnect"),
    approve: t("approveConnect"),
    content: <ConnectContent origin={details.origin} address={details.address} />
  }
}

async function ask<T>(action: string, extra: object = {}): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type: "signet-approval", action, requestId, ...extra })
  // The background's own errors arrive as keys and are worded here, in this page's language
  if (!response || response.error) throw fromWire(response?.error)
  return response.result
}

/**
 * True once `target` has been entirely on screen and uncovered for SEEN_FOR_MS, counted from when `ready`
 * (the card is drawn). `restart` starts the count again. In Signet's own window there's nothing to cover it.
 */
function useProvenVisible(target: React.RefObject<HTMLElement>, ready: boolean) {
  const [proven, setProven] = useState(inWindow)
  const [restarts, setRestarts] = useState(0)
  useEffect(() => {
    if (inWindow || !ready || !target.current) return
    let timer: ReturnType<typeof setTimeout>
    setProven(false)
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer)
      setProven(false)
      const visible = (entry as IntersectionObserverEntry & { isVisible?: boolean }).isVisible
      if (visible && entry.intersectionRatio >= 1) timer = setTimeout(() => setProven(true), SEEN_FOR_MS)
    }, { threshold: [1], trackVisibility: true, delay: 100 } as IntersectionObserverInit)
    observer.observe(target.current)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [ready, restarts])
  return { proven, restart: () => setRestarts(n => n + 1) }
}

export default function Approve() {
  const frame = useRef<HTMLDivElement>(null)
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [stuck, setStuck] = useState(false)
  const [windowId, setWindowId] = useState<number>()
  const { proven: visible, restart } = useProvenVisible(frame, !!details)

  // Load the request; while the wallet is locked, check again every second
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const load = () => ask<Details>("get")
      .then(next => {
        setDetails(next)
        if (!next.unlocked) timer = setTimeout(load, 1000)
      })
      .catch(setError)
    load()
    chrome.windows.getCurrent().then(w => setWindowId(w.id))
    return () => clearTimeout(timer)
  }, [])

  // Covered for too long: offer Signet's own window
  useEffect(() => {
    if (visible) return setStuck(false)
    const timer = setTimeout(() => setStuck(true), FALLBACK_AFTER_MS)
    return () => clearTimeout(timer)
  }, [visible])

  const decide = (approved: boolean) =>
    ask("decide", { approved })
      .then(() => { if (inWindow) window.close() })
      .catch(setError)

  const card = details && cardFor(details)
  const hold = !details?.unlocked ? t("holdUnlockFirst") : !visible ? t("holdChecking") : undefined

  return (
    <div ref={frame} onPointerDownCapture={() => { if (!visible) restart() }} style={{ position: "fixed", inset: 0, fontFamily: "var(--font-sans)" }}>
      {/* Over the site: transparent, in the color scheme the frame was given (a mismatch would paint it opaque) */}
      <style>{inWindow ? "html, body { margin: 0; background: var(--bg); }" : "html { color-scheme: normal !important; } html, body { margin: 0; background: transparent; }"}</style>
      {!details && error && (
        <div className="w-card" style={{ margin: "20px auto" }}>
          <ErrorText error={error} />
        </div>
      )}
      {details && card && (
        <NotificationPanel
          title={card.title}
          approveLabel={card.approve}
          approveHold={hold}
          onReject={() => decide(false)}
          onApprove={() => decide(true)}
        >
          {card.content}
          {!details.unlocked && (
            <Note onClick={() => windowId !== undefined && chrome.sidePanel.open({ windowId })}>
              {t("lockedNote")}
            </Note>
          )}
          {stuck && !inWindow && (
            <Note onClick={() => ask("window").catch(setError)}>
              {t("coveredNote")}
            </Note>
          )}
          <ErrorText error={error} />
        </NotificationPanel>
      )}
    </div>
  )
}

function Note({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="cx-btn cx-btn-quiet" onClick={onClick} style={{ justifyContent: "flex-start", height: "auto", padding: "8px 10px", whiteSpace: "normal", textAlign: "left", color: "var(--accent-text)" }}>
      {children}
    </button>
  )
}
```
`apps/signet/src/shared/approvals/parts/UIComponents.tsx`:

```tsx
/**
 * The pieces every approval card shares: the risk pill, the line saying which site asks, and a feature line.
 */
import type { ReactNode } from 'react';
import { t } from '~shared/i18n';
import { PermissionLevel } from './types';

const RISK: Record<PermissionLevel, { pill: string; text: string }> = {
  [PermissionLevel.INFO]: { pill: 'cx-pill-success', text: 'riskLow' },
  [PermissionLevel.SENSITIVE]: { pill: 'cx-pill-warning', text: 'riskReview' },
  // Sends a transaction: often routine (a swap through x-multihop-v2), so no alarm; the card says what can move
  [PermissionLevel.CRITICAL]: { pill: 'cx-pill-warning', text: 'riskReview' },
};

/** Stands in for the site in a translated sentence, so the site can be bolded wherever the language puts it */
const SITE = '\u0000';

/**
 * The risk pill and which site is asking for what: `ask` is the sentence's message key, its $1 the site (shown in
 * bold), and `fills` its other fill-ins ($2…)
 */
export function RequestHeader({ level, origin, ask, fills = [] }: { level: PermissionLevel; origin: string; ask: string; fills?: (string | number)[] }) {
  const [before, after] = t(ask, SITE, ...fills).split(SITE);
  return (
    <>
      <span className={`cx-pill ${RISK[level].pill}`} style={{ alignSelf: 'flex-start' }}>{t(RISK[level].text)}</span>
      <div className="w-origin">{before}<strong>{origin}</strong>{after}</div>
    </>
  );
}

/** An icon and a plain sentence about what approving does */
export function FeatureExplanation({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="w-feature">{icon}<span>{text}</span></div>;
}
```
`apps/signet/src/shared/approvals/ConnectContent.tsx`:

```tsx
/**
 * Connect (standard wallet request): share the active address with a site
 */
import { ShieldCheck, UserRound } from 'lucide-react';
import { PermissionLevel } from './parts/types';
import { FeatureExplanation, RequestHeader } from './parts/UIComponents';
import { t } from '~shared/i18n';
import { short } from '~shared/ui';

export function ConnectContent({ origin, address }: { origin: string; address: string | null }) {
  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.INFO} origin={origin} ask="askConnect" />
      <FeatureExplanation
        icon={<UserRound size={18} color="var(--success)" aria-hidden />}
        text={address ? t('shareAddressAs', short(address)) : t('shareAddress')}
      />
      <FeatureExplanation icon={<ShieldCheck size={18} color="var(--success)" aria-hidden />} text={t('cantMoveFunds')} />
    </div>
  );
}
```
`apps/signet/src/shared/approvals/SignMessageContent.tsx`:

```tsx
/**
 * Sign message (standard wallet request): prove who you are by signing text
 */
import { PenLine, ShieldCheck } from 'lucide-react';
import { PermissionLevel } from './parts/types';
import { FeatureExplanation, RequestHeader } from './parts/UIComponents';
import { t } from '~shared/i18n';
import { short } from '~shared/ui';

export function SignMessageContent({ origin, address, message }: { origin: string; address: string | null; message: string }) {
  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} ask="askSignMessage" />
      <div className="cx-pane w-mono" style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '13px', lineHeight: '19px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {message}
      </div>
      <FeatureExplanation
        icon={<PenLine size={18} color="var(--warning)" aria-hidden />}
        text={address ? t('signsAs', short(address)) : t('signsWithActive')}
      />
      <FeatureExplanation icon={<ShieldCheck size={18} color="var(--warning)" aria-hidden />} text={t('messageMovesNothing')} />
    </div>
  );
}
```
`apps/signet/src/shared/approvals/SignOrderContent.tsx`:

```tsx
/**
 * Sign structured data (SIP-018): what the order does, in plain words.
 * Blaze orders (Charisma subnets) get a readable summary, including who the funds can be paid out to.
 */
import { useEffect, useState } from "react"
import { Cl, type ClarityValue, type TupleCV } from "@stacks/transactions"
import { getTokenMetadataStrict } from "@repo/tokens"
import { RequestHeader } from "./parts/UIComponents"
import { PermissionLevel } from "./parts/types"
import { BLAZE_V1_DOMAIN, LEGACY_MULTIHOP_CONTRACT_ID, MULTIHOP_CONTRACT_ID, MULTIHOP_V1_CONTRACT_ID } from "blaze-sdk"
import { t } from "~shared/i18n"
import { formatUnits, Kv, short } from "~shared/ui"

/** Routers and what they allow once they hold a signed order */
const ROUTERS: Record<string, { text: string; tone: "success" | "danger" }> = {
  [MULTIHOP_CONTRACT_ID]: { text: "payoutOnlyYou", tone: "success" },
  [MULTIHOP_V1_CONTRACT_ID]: { text: "payoutOnlyYou", tone: "success" },
  [LEGACY_MULTIHOP_CONTRACT_ID]: { text: "payoutSubmitter", tone: "danger" },
}

const BLAZE_NAME = Cl.prettyPrint(BLAZE_V1_DOMAIN.value.name).replace(/"/g, "")

const shortName = (principal: string) => principal.split(".").pop() ?? principal

/** The value inside an optional, or null for none */
function optional(value: ClarityValue | undefined): ClarityValue | null {
  if (!value || value.type === "none") return null
  return value.type === "some" ? value.value : value
}


function BlazeOrder({ fields }: { fields: Record<string, ClarityValue> }) {
  const contract = Cl.prettyPrint(fields.contract).replace(/^'/, "")
  const amount = optional(fields.amount)
  // Symbol and decimals from Charisma's token list; an unknown token stays in smallest units, never guessed
  const [token, setToken] = useState<{ symbol: string; decimals: number } | null | undefined>(undefined)
  useEffect(() => {
    getTokenMetadataStrict(contract)
      .then(data => setToken({ symbol: data.symbol, decimals: data.decimals }))
      .catch(() => setToken(null))
  }, [contract])
  const target = optional(fields.target)
  const targetId = target ? Cl.prettyPrint(target).replace(/^'/, "") : null
  const router = targetId ? ROUTERS[targetId] : null
  // A plain address, not a router contract: the funds go straight to it
  const sendsTo = target?.type === "address"
  return (
    <>
      <Kv label={t("orderAction")}>{Cl.prettyPrint(fields.intent).replace(/"/g, "")}</Kv>
      <Kv label={t("orderToken")}>{token ? t("onBlaze", token.symbol) : shortName(contract)}</Kv>
      {amount?.type === "uint" && (
        <Kv label={token === null ? t("amountSmallestUnits") : t("amount")}>
          {token ? `${formatUnits(BigInt(amount.value), token.decimals)} ${token.symbol}` : token === undefined ? "…" : amount.value.toString()}
        </Kv>
      )}
      {targetId && sendsTo && <Kv label={t("sendsTo")} tone="danger">{targetId}</Kv>}
      {targetId && !sendsTo && (
        <Kv label={t("payout")} tone={router?.tone ?? "warning"}>
          {router ? `${t(router.text)} (${shortName(targetId)})` : t("handledBy", shortName(targetId))}
        </Kv>
      )}
      <Kv label={t("orderId")}>{Cl.prettyPrint(fields.uuid).replace(/"/g, "")}</Kv>
    </>
  )
}

export function SignOrderContent({ origin, address, message, domain }: {
  origin: string
  address: string | null
  message: string
  domain: string
}) {
  const data = Cl.deserialize(message)
  const domainFields = (Cl.deserialize(domain) as TupleCV).value
  const appName = Cl.prettyPrint(domainFields.name).replace(/"/g, "")
  const isBlaze = appName === BLAZE_NAME && data.type === "tuple"

  return (
    <div className="w-approval">
      {isBlaze
        ? <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} ask="askSignOrder" />
        : <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} ask="askSignData" fills={[appName]} />}

      <div className="cx-pane">
        {isBlaze
          ? <BlazeOrder fields={(data as TupleCV).value} />
          : data.type === "tuple"
            ? Object.entries((data as TupleCV).value).map(([key, value]) => <Kv key={key} label={key}>{Cl.prettyPrint(value)}</Kv>)
            : <Kv label={t("orderData")}>{Cl.prettyPrint(data)}</Kv>}
      </div>

      <p className="w-note">
        {address ? `${t("signsAsSentence", short(address))} ` : ""}
        {isBlaze ? t("orderRunsOnce") : t("signOnlyRecognized")}
      </p>
    </div>
  )
}
```
`apps/signet/src/shared/approvals/SignOrdersContent.tsx`:

```tsx
/**
 * Sign many Blaze orders at once (blaze_signStructuredMessages): one card with the count, how much of
 * each token they can spend in total, and where the funds can be paid out.
 */
import { useEffect, useState } from "react"
import { Cl, type ClarityValue, type TupleCV } from "@stacks/transactions"
import { getTokenMetadataStrict } from "@repo/tokens"
import { LEGACY_MULTIHOP_CONTRACT_ID, MULTIHOP_CONTRACT_ID, MULTIHOP_V1_CONTRACT_ID } from "blaze-sdk"
import { RequestHeader } from "./parts/UIComponents"
import { PermissionLevel } from "./parts/types"
import { count, pluralKey, t } from "~shared/i18n"
import { formatUnits, Kv, short } from "~shared/ui"

/** Routers and what they allow once they hold a signed order */
const ROUTERS: Record<string, { text: string; tone: "success" | "danger" }> = {
  [MULTIHOP_CONTRACT_ID]: { text: "payoutOnlyYou", tone: "success" },
  [MULTIHOP_V1_CONTRACT_ID]: { text: "payoutOnlyYou", tone: "success" },
  [LEGACY_MULTIHOP_CONTRACT_ID]: { text: "payoutSubmitter", tone: "danger" },
}

const shortName = (principal: string) => principal.split(".").pop() ?? principal
const principalOf = (value: ClarityValue) => Cl.prettyPrint(value).replace(/^'/, "")

/** The value inside an optional, or null for none */
function optional(value: ClarityValue | undefined): ClarityValue | null {
  if (!value || value.type === "none") return null
  return value.type === "some" ? value.value : value
}



export function SignOrdersContent({ origin, address, messages }: { origin: string; address: string | null; messages: string[] }) {
  const orders = messages.map(m => (Cl.deserialize(m) as TupleCV).value)

  // What they can spend in total, per token, and every payout router named
  const totals = new Map<string, bigint>()
  const routers = new Set<string>()
  for (const fields of orders) {
    const contract = principalOf(fields.contract)
    const amount = optional(fields.amount)
    totals.set(contract, (totals.get(contract) ?? 0n) + (amount?.type === "uint" ? BigInt(amount.value) : 0n))
    const target = optional(fields.target)
    if (target) routers.add(principalOf(target))
  }

  // Names and decimals from Charisma's token cache; unknown tokens stay in smallest units, never guessed
  const [meta, setMeta] = useState<Record<string, { symbol: string; decimals: number } | null>>({})
  useEffect(() => {
    for (const contract of totals.keys()) {
      getTokenMetadataStrict(contract)
        .then(data => setMeta(m => ({ ...m, [contract]: { symbol: data.symbol, decimals: data.decimals } })))
        .catch(() => setMeta(m => ({ ...m, [contract]: null })))
    }
  }, [])

  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} ask={pluralKey("askSignOrders", orders.length)} fills={[count(orders.length)]} />

      <div className="cx-pane">
        <Kv label={t("ordersCount")}>{count(orders.length)}</Kv>
        {[...totals].map(([contract, total]) => {
          const token = meta[contract]
          return (
            <Kv key={contract} label={t("canSpendTotal")}>
              {token ? `${formatUnits(total, token.decimals)} ${token.symbol}` : t("smallestUnitsOf", total.toString(), shortName(contract))}
            </Kv>
          )
        })}
        {[...routers].map(id => {
          const router = ROUTERS[id]
          return (
            <Kv key={id} label={t("payout")} tone={router?.tone ?? "warning"}>
              {router ? `${t(router.text)} (${shortName(id)})` : t("handledBy", shortName(id))}
            </Kv>
          )
        })}
      </div>

      <p className="w-note">
        {address ? `${t("signsAsSentence", short(address))} ` : ""}
        {t("ordersRunOnce")}
      </p>
    </div>
  )
}
```
`apps/signet/src/shared/approvals/TransactionContent.tsx`:

```tsx
/**
 * Send a transaction (stx_transferStx, stx_callContract): what it does and exactly what can leave the wallet.
 */
import {
  Cl,
  FungibleConditionCode,
  NonFungibleConditionCode,
  PostConditionPrincipalId,
  PostConditionType,
  addressToString,
  deserializePostConditionWire,
  type PostConditionPrincipalWire,
  type PostConditionWire
} from "@stacks/transactions"
import { RequestHeader } from "./parts/UIComponents"
import { PermissionLevel } from "./parts/types"
import { t } from "~shared/i18n"
import { Kv, formatUnits } from "~shared/ui"

const short = (text: string) => (text.length > 16 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text)
/** Micro-STX as STX, exactly: an approval never hides part of an amount */
const stx = (micro: bigint | string | number) => `${formatUnits(BigInt(micro), 6)} STX`

/** Each condition code's sentence, for "you" and for someone else (whole sentences, so word order can change) */
const FUNGIBLE: Record<FungibleConditionCode, { you: string; they: string }> = {
  [FungibleConditionCode.Equal]: { you: "pcYouSendExactly", they: "pcTheySendExactly" },
  [FungibleConditionCode.Greater]: { you: "pcYouSendMoreThan", they: "pcTheySendMoreThan" },
  [FungibleConditionCode.GreaterEqual]: { you: "pcYouSendAtLeast", they: "pcTheySendAtLeast" },
  [FungibleConditionCode.Less]: { you: "pcYouSendLessThan", they: "pcTheySendLessThan" },
  [FungibleConditionCode.LessEqual]: { you: "pcYouSendAtMost", they: "pcTheySendAtMost" },
}

/** Who a condition is about: null for the signer ("you"), otherwise an address or contract name */
function who(principal: PostConditionPrincipalWire, signer: string | null): string | null {
  if (principal.prefix === PostConditionPrincipalId.Origin) return null
  const address = addressToString(principal.address)
  if (principal.prefix === PostConditionPrincipalId.Contract) return principal.contractName.content
  return address === signer ? null : short(address)
}

/** One post condition as a sentence, e.g. "You send at most 10 STX" */
function describe(pc: PostConditionWire, signer: string | null) {
  const sender = who(pc.principal, signer)
  const you = sender === null
  const fills = (...rest: string[]) => (you ? rest : [sender, ...rest])
  if (pc.conditionType === PostConditionType.STX || pc.conditionType === PostConditionType.Fungible) {
    const amount = pc.conditionType === PostConditionType.STX
      ? stx(pc.amount)
      : t("tokenSmallestUnits", pc.amount.toString(), pc.asset.assetName.content)
    const keys = FUNGIBLE[pc.conditionCode]
    return t(you ? keys.you : keys.they, ...fills(amount))
  }
  if (pc.conditionType !== PostConditionType.NonFungible) return t("pcStacking", you ? t("pcYou") : sender)
  const sends = pc.conditionCode === NonFungibleConditionCode.Sends
  const key = sends ? (you ? "pcYouSendNft" : "pcTheySendNft") : (you ? "pcYouKeepNft" : "pcTheyKeepNft")
  return t(key, ...fills(pc.asset.assetName.content, Cl.prettyPrint(pc.assetName)))
}

export function TransactionContent({ origin, address, method, params }: {
  origin: string
  address: string | null
  method: string
  params: Record<string, any>
}) {
  const isTransfer = method === "stx_transferStx"
  const postConditions = ((params.postConditions ?? []) as string[]).map(pc => deserializePostConditionWire(pc))
  const allowMode = !isTransfer && params.postConditionMode === "allow"

  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.CRITICAL} origin={origin} ask={isTransfer ? "askSendStx" : "askRunTransaction"} />

      <div className="cx-pane">
        {isTransfer ? (
          <>
            <Kv label={t("send")}>{stx(params.amount)}</Kv>
            <Kv label={t("to")}>{params.recipient}</Kv>
            {params.memo && <Kv label={t("memo")}>{params.memo}</Kv>}
          </>
        ) : (
          <>
            <Kv label={t("contract")}>{params.contract.split(".")[1]} ({short(params.contract.split(".")[0])})</Kv>
            <Kv label={t("function")}>{params.functionName}</Kv>
            <div style={{ maxHeight: "90px", overflowY: "auto" }}>
              {((params.functionArgs ?? []) as string[]).map((arg, i) => (
                <Kv key={i} label={t("argument", i + 1)}>{Cl.prettyPrint(Cl.deserialize(arg))}</Kv>
              ))}
            </div>
          </>
        )}
      </div>

      {!isTransfer && (
        <div className="cx-pane" style={{ background: `var(--${allowMode ? "danger" : "success"}-soft)`, borderColor: "transparent" }}>
          <div style={{ fontWeight: 700, color: `var(--${allowMode ? "danger" : "success"})`, marginBottom: postConditions.length ? "4px" : 0 }}>
            {allowMode ? t("allowMode") : postConditions.length ? t("onlyTheseTransfers") : t("noTokensLeave")}
          </div>
          {postConditions.map((pc, i) => (
            <div key={i} style={{ padding: "2px 0", color: "var(--ink-body)" }}>• {describe(pc, address)}</div>
          ))}
        </div>
      )}

      <p className="w-note">
        {address ? `${t("sentFrom", short(address))} ` : ""}{t("feeSetAutomatically")}
      </p>
    </div>
  )
}
```

- [ ] **Patch the background, the message plumbing and the smaller screens.** Save this patch as `/tmp/plan4-task2.patch`, then run `git apply --check /tmp/plan4-task2.patch && git apply /tmp/plan4-task2.patch`.

```diff
diff --git a/apps/signet/src/background/lib/diagnostics.ts b/apps/signet/src/background/lib/diagnostics.ts
index 7a2098a..bfca89c 100644
--- a/apps/signet/src/background/lib/diagnostics.ts
+++ b/apps/signet/src/background/lib/diagnostics.ts
@@ -6,6 +6,7 @@ import { listTokens } from "@repo/tokens"
 import * as wallet from "./wallet"
 import { hiroFetch } from "./hiro"
 import { subnetBalances, type SubnetBalance } from "./subnets"
+import { WalletError } from "./wallet-error"
 
 const HIRO = "https://api.hiro.so"
 
@@ -27,18 +28,18 @@ async function timed<T>(work: () => Promise<T>): Promise<{ value: T; latencyMs:
 
 export async function getDiagnostics(): Promise<Diagnostics> {
   const account = await wallet.getCurrentAccount()
-  if (!account) throw new Error("Blaze Wallet has no active account")
+  if (!account) throw new WalletError("errorNoActiveAccount")
 
   const [network, cache] = await Promise.all([
     timed(async () => {
       const res = await hiroFetch(`${HIRO}/v2/info`)
-      if (!res.ok) throw new Error(`Stacks network unavailable (Hiro ${res.status})`)
+      if (!res.ok) throw new WalletError("errorStacksUnavailable", [res.status])
       return (await res.json()) as { stacks_tip_height: number }
     }),
     timed(listTokens)
   ])
   // listTokens returns [] when the cache fails; there is always at least STX-paired tokens when it works
-  if (cache.value.length === 0) throw new Error("Charisma's token cache returned no tokens")
+  if (cache.value.length === 0) throw new WalletError("errorTokenCacheEmpty")
 
   const subnets = await subnetBalances(account.stxAddress, cache.value)
 
diff --git a/apps/signet/src/background/lib/provider.ts b/apps/signet/src/background/lib/provider.ts
index 59d52e3..7f8705b 100644
--- a/apps/signet/src/background/lib/provider.ts
+++ b/apps/signet/src/background/lib/provider.ts
@@ -18,6 +18,7 @@ import {
 } from "@stacks/transactions"
 import * as wallet from "./wallet"
 import { hiroClient } from "./hiro"
+import { WalletError, toWire } from "./wallet-error"
 
 /** JSON-RPC error codes used by @stacks/connect */
 const MethodNotFound = -32601
@@ -260,7 +261,7 @@ const isSignetPage = (sender: chrome.runtime.MessageSender) => sender.origin ===
 
 async function handleApproval(message: { action: string; requestId: string; approved?: boolean }) {
   const request = pending.get(message.requestId)
-  if (!request) throw new Error("This request is no longer waiting")
+  if (!request) throw new WalletError("errorRequestGone")
 
   switch (message.action) {
     case "get": {
@@ -293,7 +294,8 @@ export function listenForProviderRequests() {
       return true
     }
     if (message?.type === "signet-approval" && isSignetPage(sender)) {
-      handleApproval(message).then(result => sendResponse({ result }), error => sendResponse({ error: error.message }))
+      // Keys for the approval window to word; error.message (English) stays what websites get from handleRpc
+      handleApproval(message).then(result => sendResponse({ result }), error => sendResponse({ error: toWire(error) }))
       return true
     }
   })
diff --git a/apps/signet/src/background/lib/tokens.ts b/apps/signet/src/background/lib/tokens.ts
index a1e9ca7..3c1afde 100644
--- a/apps/signet/src/background/lib/tokens.ts
+++ b/apps/signet/src/background/lib/tokens.ts
@@ -11,6 +11,7 @@ import * as wallet from "./wallet"
 import { hiroClient } from "./hiro"
 
 import { BALANCE_SERVICE } from "~shared/balance-service"
+import { WalletError } from "./wallet-error"
 
 export const STX_ID = ".stx"
 
@@ -32,7 +33,7 @@ export interface TokenBalance {
 
 async function activeAccount() {
   const account = await wallet.getCurrentAccount()
-  if (!account) throw new Error("Blaze Wallet has no active account")
+  if (!account) throw new WalletError("errorNoActiveAccount")
   return account
 }
 
@@ -49,7 +50,7 @@ async function tokenMeta(contractId: string): Promise<TokenBalance["meta"]> {
 
 async function readSheet(address: string): Promise<BalanceSheet> {
   const res = await fetch(`${BALANCE_SERVICE}/api/v1/balances/${address}/sheet`, { cache: "no-store" })
-  if (!res.ok) throw new Error(`Couldn't load balances (${res.status})`)
+  if (!res.ok) throw new WalletError("errorBalances", [res.status])
   return res.json() as Promise<BalanceSheet>
 }
 
@@ -62,7 +63,7 @@ export async function getWalletBalances(pushed?: BalanceSheet): Promise<TokenBal
   const sheet = pushed?.address === stxAddress ? pushed : await readSheet(stxAddress)
   // Charisma's token list: blocking a token (scripts/blocklist.mjs in token-cache) takes it off this list
   const list = await listTokens()
-  if (list.length === 0) throw new Error("Charisma's token list is unavailable, so tokens can't be checked against the block list")
+  if (list.length === 0) throw new WalletError("errorTokenListUnavailable")
   const listed = new Set(list.map(token => token.contractId))
   const assetOf = (contractId: string) => list.find(token => token.contractId === contractId)?.identifier ?? ""
 
@@ -97,7 +98,7 @@ export async function getUsdPrices(): Promise<Record<string, number>> {
 export async function sendToken(request: { contractId: string; asset: string; recipient: string; amount: string; memo?: string }) {
   const account = await activeAccount()
   const amount = BigInt(request.amount)
-  if (amount <= 0n) throw new Error("Amount must be more than zero")
+  if (amount <= 0n) throw new WalletError("errorAmountPositive")
 
   const common = { senderKey: account.privateKey, network: "mainnet" as const, client: hiroClient }
   const transaction = request.contractId === STX_ID
@@ -118,6 +119,6 @@ export async function sendToken(request: { contractId: string; asset: string; re
       })
 
   const result = await broadcastTransaction({ transaction, network: "mainnet", client: hiroClient })
-  if ("error" in result) throw new Error(`The network rejected the transfer: ${result.reason ?? result.error}`)
+  if ("error" in result) throw new WalletError("errorRejected", [result.reason ?? result.error])
   return { txid: result.txid }
 }
diff --git a/apps/signet/src/background/lib/wallet/index.ts b/apps/signet/src/background/lib/wallet/index.ts
index f1c565b..d78937e 100644
--- a/apps/signet/src/background/lib/wallet/index.ts
+++ b/apps/signet/src/background/lib/wallet/index.ts
@@ -29,6 +29,9 @@ import {
   createAccountFromSeed
 } from './seed';
 
+import { normalizeSeedWords } from '~shared/seed-words';
+import { WalletError } from '../wallet-error';
+
 import type {
   SeedPhrase,
   Account,
@@ -70,11 +73,8 @@ export function generateSeedWords(): string {
  * Import an existing seed phrase
  */
 export async function importSeedPhrase(name: string, phrase: string): Promise<SeedPhrase | null> {
-  if (!validateSeedPhrase(phrase)) {
-    throw new Error("That isn't a valid seed phrase: check each word's spelling and that none are missing");
-  }
-
-  return await addSeedPhrase(name, phrase.trim().toLowerCase().split(/\s+/).join(' '));
+  if (!validateSeedPhrase(phrase)) throw new WalletError("errorInvalidSeedPhrase");
+  return await addSeedPhrase(name, normalizeSeedWords(phrase));
 }
 
 /**
@@ -84,7 +84,7 @@ export async function createAccount(options: CreateAccountOptions): Promise<Acco
   // Get the seed phrase
   const seedPhrase = await getSeedPhrase(options.seedPhraseId);
   if (!seedPhrase) {
-    throw new Error("Seed phrase not found");
+    throw new WalletError("errorSeedNotFound");
   }
 
   // Find the next available index if not specified
diff --git a/apps/signet/src/background/lib/wallet/seed.ts b/apps/signet/src/background/lib/wallet/seed.ts
index 033b9bf..7f3b755 100644
--- a/apps/signet/src/background/lib/wallet/seed.ts
+++ b/apps/signet/src/background/lib/wallet/seed.ts
@@ -7,6 +7,7 @@ import { STACKS_MAINNET } from '@stacks/network';
 import { getAddressFromPublicKey, privateKeyToPublic } from '@stacks/transactions';
 import { validateMnemonic } from '@scure/bip39';
 import { wordlist } from '@scure/bip39/wordlists/english';
+import { normalizeSeedWords } from '~shared/seed-words';
 
 
 /**
@@ -17,10 +18,11 @@ export function generateSeedPhrase(): string {
 }
 
 /**
- * Whether a phrase is a real BIP39 seed phrase: English words from the list, a valid length, and a matching checksum
+ * Whether a phrase is a real BIP39 seed phrase: English words from the list, a valid length, and a matching checksum,
+ * after the cleanup typed and pasted words need (shared/seed-words)
  */
 export function validateSeedPhrase(phrase: string): boolean {
-  return validateMnemonic(phrase.trim().toLowerCase().split(/\s+/).join(' '), wordlist);
+  return validateMnemonic(normalizeSeedWords(phrase), wordlist);
 }
 
 /**
diff --git a/apps/signet/src/background/lib/wallet/storage.ts b/apps/signet/src/background/lib/wallet/storage.ts
index 99b38f0..e8b8f11 100644
--- a/apps/signet/src/background/lib/wallet/storage.ts
+++ b/apps/signet/src/background/lib/wallet/storage.ts
@@ -6,6 +6,7 @@
  * 15 idle minutes. A wrong password fails AES-GCM authentication and is rejected.
  */
 import type { SeedPhrase, Account, WalletState } from './types';
+import { WalletError } from '../wallet-error';
 
 const VAULT_KEY = 'vault';
 const UNLOCKED_KEY = 'unlocked';
@@ -69,10 +70,10 @@ async function startSession(key: CryptoKey): Promise<void> {
  */
 async function sessionKey(active = false): Promise<CryptoKey> {
   const { [UNLOCKED_KEY]: unlocked } = (await chrome.storage.session.get(UNLOCKED_KEY)) as { [UNLOCKED_KEY]?: Unlocked };
-  if (!unlocked) throw new Error('Wallet is locked');
+  if (!unlocked) throw new WalletError('errorLocked');
   if (Date.now() > unlocked.expiresAt) {
     await lock();
-    throw new Error('Wallet locked after 15 minutes of inactivity');
+    throw new WalletError('errorLockedIdle');
   }
   if (active) await chrome.storage.session.set({ [UNLOCKED_KEY]: { ...unlocked, expiresAt: Date.now() + LOCK_AFTER_MS } });
   return crypto.subtle.importKey('raw', fromBase64(unlocked.key), 'AES-GCM', true, ['encrypt', 'decrypt']);
@@ -101,7 +102,7 @@ export async function unlockOrCreate(password: string): Promise<void> {
   const vault = await readVault();
 
   if (!vault) {
-    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
+    if (password.length < MIN_PASSWORD_LENGTH) throw new WalletError('errorPasswordShort', [MIN_PASSWORD_LENGTH]);
     const salt = crypto.getRandomValues(new Uint8Array(16));
     const key = await deriveKey(password, salt);
     await encrypt(key, toBase64(salt), { seedPhrases: [], accounts: [], activeAccountId: null, isInitialized: true });
@@ -113,7 +114,7 @@ export async function unlockOrCreate(password: string): Promise<void> {
   try {
     await decrypt(key, vault);
   } catch {
-    throw new Error('Wrong password');
+    throw new WalletError('errorWrongPassword');
   }
   await startSession(key);
 }
@@ -136,20 +137,20 @@ export async function lock(): Promise<void> {
 
 export async function getWalletState(): Promise<WalletState> {
   const vault = await readVault();
-  if (!vault) throw new Error('No wallet yet');
+  if (!vault) throw new WalletError('errorNoWallet');
   return decrypt(await sessionKey(), vault);
 }
 
 async function saveWalletState(state: WalletState): Promise<void> {
   const vault = await readVault();
-  if (!vault) throw new Error('No wallet yet');
+  if (!vault) throw new WalletError('errorNoWallet');
   await encrypt(await sessionKey(true), vault.salt, state);
 }
 
 /** The encrypted vault as stored, for backup: it opens only with the password. */
 export async function exportVault(): Promise<Vault> {
   const vault = await readVault();
-  if (!vault) throw new Error('No wallet yet');
+  if (!vault) throw new WalletError('errorNoWallet');
   await sessionKey();
   return vault;
 }
@@ -160,7 +161,7 @@ export async function exportVault(): Promise<Vault> {
 export async function addSeedPhrase(name: string, phrase: string): Promise<SeedPhrase> {
   const state = await getWalletState();
   if (state.seedPhrases.some(sp => sp.name === name)) {
-    throw new Error(`A seed phrase with name "${name}" already exists`);
+    throw new WalletError('errorSeedNameTaken', [name]);
   }
 
   const seedPhrase: SeedPhrase = { id: `seed_${crypto.randomUUID()}`, name, phrase, createdAt: Date.now() };
@@ -227,7 +228,7 @@ export async function getAccountsForSeedPhrase(seedPhraseId: string): Promise<Ac
 
 export async function setActiveAccount(id: string): Promise<boolean> {
   const state = await getWalletState();
-  if (!state.accounts.some(acc => acc.id === id)) throw new Error('Account not found');
+  if (!state.accounts.some(acc => acc.id === id)) throw new WalletError('errorAccountNotFound');
 
   state.accounts.forEach(acc => { acc.isActive = acc.id === id; });
   state.activeAccountId = id;
diff --git a/apps/signet/src/background/messages/handler.ts b/apps/signet/src/background/messages/handler.ts
index b864580..f18c258 100644
--- a/apps/signet/src/background/messages/handler.ts
+++ b/apps/signet/src/background/messages/handler.ts
@@ -4,6 +4,7 @@ import * as tokens from "../lib/tokens"
 import { getDiagnostics } from "../lib/diagnostics"
 import type { SeedPhrase, Account, CreateAccountOptions } from "../lib/wallet/types"
 import type { MessageAction } from "~shared/context/types"
+import { toWire } from "../lib/wallet-error"
 
 interface MessageRequest {
   action: MessageAction;
@@ -151,7 +152,8 @@ const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
     res.send({ success: true, data: response });
   } catch (error) {
     console.error("Error in message handler:", error);
-    res.send({ success: false, error: error.message || "Unknown error" });
+    // A WalletError crosses as its key, so the page words it in its own language
+    res.send({ success: false, error: toWire(error) });
   }
 }
 
diff --git a/apps/signet/src/shared/context/types.ts b/apps/signet/src/shared/context/types.ts
index 64fe1a5..dc1174a 100644
--- a/apps/signet/src/shared/context/types.ts
+++ b/apps/signet/src/shared/context/types.ts
@@ -1,3 +1,5 @@
+import type { WireError } from "~background/lib/wallet-error"
+
 // Define types for operations
 export type MessageAction =
   // Lock
@@ -49,5 +51,5 @@ export interface Account {
 export interface HandlerResponse<T> {
   success: boolean;
   data?: T;
-  error?: string;
+  error?: WireError;
 }
diff --git a/apps/signet/src/shared/context/utils.ts b/apps/signet/src/shared/context/utils.ts
index 764bd2b..a0bd833 100644
--- a/apps/signet/src/shared/context/utils.ts
+++ b/apps/signet/src/shared/context/utils.ts
@@ -1,4 +1,6 @@
 import { sendToBackground } from '@plasmohq/messaging'
+import { fromWire } from '~shared/errors'
+import { t } from '~shared/i18n'
 import type { HandlerResponse, MessageAction } from './types'
 
 // Helper function to send messages to the background service
@@ -9,9 +11,8 @@ export async function sendMessage<T>(action: MessageAction, data?: any): Promise
       body: { action, data }
     });
 
-    if (!response.success) {
-      throw new Error(response.error || "Unknown error occurred");
-    }
+    // The background's own errors arrive as keys and are worded here, in this page's language
+    if (!response.success) throw fromWire(response.error);
 
     return response.data as T;
   } catch (error) {
@@ -80,12 +81,12 @@ export async function saveEncryptedWalletBackup(): Promise<boolean> {
     URL.revokeObjectURL(downloadUrl);
     
     // Show success notification
-    showNotification('Wallet exported successfully!', true);
+    showNotification(t('exportDone'), true);
     
     return true;
   } catch (error) {
     console.error("Error saving wallet backup:", error);
-    showNotification('Failed to export wallet data', false);
+    showNotification(t('exportFailed'), false);
     return false;
   }
 }
\ No newline at end of file
diff --git a/apps/signet/src/shared/notifications/NotificationPanel.tsx b/apps/signet/src/shared/notifications/NotificationPanel.tsx
index 60b28fa..42256d6 100644
--- a/apps/signet/src/shared/notifications/NotificationPanel.tsx
+++ b/apps/signet/src/shared/notifications/NotificationPanel.tsx
@@ -9,6 +9,7 @@
 import { useState, type MouseEvent, type ReactNode } from 'react'
 import { animated, to, useSpring } from '@react-spring/web'
 import { X } from 'lucide-react'
+import { t } from '~shared/i18n'
 import { BlazeFlame } from '~shared/ui'
 
 interface NotificationPanelProps {
@@ -69,7 +70,7 @@ export default function NotificationPanel({ title, children, approveLabel, onApp
           <div className="w-card-title">
             <BlazeFlame size={30} />
             <h1>{title}</h1>
-            <button type="button" className="cx-btn cx-btn-quiet w-btn-sm" onClick={onReject} aria-label="Deny and close" style={{ width: '32px', padding: 0 }}>
+            <button type="button" className="cx-btn cx-btn-quiet w-btn-sm" onClick={onReject} aria-label={t("denyAndClose")} style={{ width: '32px', padding: 0 }}>
               <X size={16} aria-hidden />
             </button>
           </div>
@@ -77,7 +78,7 @@ export default function NotificationPanel({ title, children, approveLabel, onApp
           {children}
 
           <div className="w-actions">
-            <button type="button" className="cx-btn" onClick={onReject}>Deny</button>
+            <button type="button" className="cx-btn" onClick={onReject}>{t('deny')}</button>
             <button
               type="button"
               className="cx-btn cx-btn-primary"
diff --git a/apps/signet/src/shared/wallet/PasswordField.tsx b/apps/signet/src/shared/wallet/PasswordField.tsx
index 2fe6a4c..ddc0b8a 100644
--- a/apps/signet/src/shared/wallet/PasswordField.tsx
+++ b/apps/signet/src/shared/wallet/PasswordField.tsx
@@ -2,6 +2,7 @@
  * A password box with a Show / Hide switch.
  */
 import { useState } from 'react';
+import { t } from '~shared/i18n';
 
 export function PasswordField({ id, value, onChange, onEnter, placeholder, label }: {
   id: string;
@@ -27,7 +28,7 @@ export function PasswordField({ id, value, onChange, onEnter, placeholder, label
           onKeyDown={e => { if (e.key === 'Enter' && value) onEnter(); }}
         />
         <button type="button" className="cx-chip" onClick={() => setShown(s => !s)} aria-pressed={shown}>
-          {shown ? 'Hide' : 'Show'}
+          {shown ? t('passwordHide') : t('passwordShow')}
         </button>
       </div>
     </label>
diff --git a/apps/signet/src/sidepanel/index.tsx b/apps/signet/src/sidepanel/index.tsx
index c131a26..db788c1 100644
--- a/apps/signet/src/sidepanel/index.tsx
+++ b/apps/signet/src/sidepanel/index.tsx
@@ -10,6 +10,7 @@ import { applySavedTheme } from "../shared/styles/theme"
 import "../shared/styles/style.css"
 
 import { SignetProvider, useSignetContext } from "~shared/context/SignetContext"
+import { t } from "~shared/i18n"
 import { WalletTab } from "~shared/wallet/WalletTab"
 import { TransferTab } from "~shared/tabs/TransferTab"
 import { StatusTab } from "./StatusTab"
@@ -27,9 +28,9 @@ const SidePanelWithProvider = () => (
 export default SidePanelWithProvider
 
 const TABS = {
-  wallet: { label: "Wallet", icon: Wallet, Page: WalletTab },
-  tokens: { label: "Tokens", icon: Coins, Page: TransferTab },
-  status: { label: "Status", icon: Activity, Page: StatusTab },
+  wallet: { label: "tabWallet", icon: Wallet, Page: WalletTab },
+  tokens: { label: "tabTokens", icon: Coins, Page: TransferTab },
+  status: { label: "tabStatus", icon: Activity, Page: StatusTab },
 } satisfies Record<string, { label: string; icon: LucideIcon; Page: () => JSX.Element }>
 type Tab = keyof typeof TABS
 
@@ -48,11 +49,11 @@ function SidePanel() {
             const { label, icon: Icon } = TABS[name]
             return (
               <button key={name} type="button" className="w-tab" aria-current={tab === name ? "page" : undefined} onClick={() => setTab(name)}>
-                <Icon size={16} aria-hidden /> {label}
+                <Icon size={16} aria-hidden /> {t(label)}
               </button>
             )
           })}
-          <button type="button" className="w-chrome-btn" onClick={() => endSession()} title="Lock the wallet" aria-label="Lock the wallet">
+          <button type="button" className="w-chrome-btn" onClick={() => endSession()} title={t("lockTheWallet")} aria-label={t("lockTheWallet")}>
             <Lock size={16} aria-hidden />
           </button>
         </nav>
```

- [ ] **Run the check**

Run: `node apps/signet/scripts/check-locales.mjs`
Expected: `Locales check out: 9 languages, 232 English messages, 207 keys used in the code`

- [ ] **Commit**

```bash
git add apps/signet/src
git commit -m "feat(signet): Every screen, error and number in the person's language, with a Language picker in the Vault card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The store listing, and buttons that wrap

**Files:**
- Create: `apps/signet/store-assets/listing/{ko,zh_CN,es,fr,de,tr,ja,pt_BR}.md`
- Modify: `apps/signet/store-assets/LISTING.md`, `apps/signet/src/shared/styles/style.css` (patch below)

- [ ] **Write each language's store description**

`apps/signet/store-assets/listing/ko.md`:

```markdown
Blaze Wallet은 Stacks 사용 경험을 한 단계 끌어올립니다. Stacks 지갑이 하는 모든 일을 하면서 Blaze까지 더했습니다. 주문에 한 번만 서명하면 때가 되었을 때 알아서 실행되고, 온체인에서 정산되며, 본인에게만 지급됩니다. Charisma가 만들었으며, Chrome 측면 패널에서 작동합니다.

■ 한 번 서명하면 알아서 실행
지정가 주문과 예약 매수는 미리 서명해 두면 정한 가격이나 시간이 되었을 때 실행됩니다. 한 달 치 매수 같은 계획 전체도 카드 한 장으로 승인할 수 있습니다. 이 카드에는 주문이 몇 개인지, 지출할 수 있는 총액이 얼마인지, 그리고 본인에게만 지급될 수 있다는 점이 표시됩니다.

■ 빠를 수 있는 곳은 빠르게, 중요한 곳은 온체인으로
Blaze 서브넷은 서명된 메시지로 토큰을 옮기고, 모든 거래를 Stacks 블록체인에서 정산합니다. 상태 탭은 네트워크, Charisma 토큰 목록, 그리고 모든 Blaze 서브넷과 각 서브넷의 잔액을 체인에서 직접 읽어 보여 줍니다.

■ 어떤 Stacks 앱과도 호환
Blaze Wallet은 표준 Stacks 지갑 규격을 따르므로 어떤 앱의 ‘지갑 연결’ 목록에도 나타납니다. 연결, 메시지 서명, STX와 토큰 보내기, 컨트랙트 호출 실행을 모두 할 수 있습니다.

■ 모든 토큰을 한눈에
잔액은 변화가 생기는 즉시 로고, 달러 가치와 함께 갱신됩니다. 각 토큰은 일반 잔액과 Blaze 잔액을 합친 하나의 합계로 표시됩니다. 보내기는 선택한 수량만 정확히 허용합니다. 사기 에어드롭처럼 Charisma 토큰 목록에 없는 토큰은 따로 숨겨져 있어 실수로 보낼 수 없습니다.

■ 무엇에 서명하는지 정확히
주문은 작업, 토큰, 수량, 누구에게 지급될 수 있는지를 알기 쉬운 말로 보여 줍니다. 트랜잭션은 지갑에서 어떤 토큰이 나갈 수 있는지 정확히 나열하고, 사이트가 그 이상을 요구하면 눈에 띄게 경고합니다. 모든 요청은 웹사이트가 읽거나 가리거나 클릭할 수 없는 봉인된 카드로 열립니다.

■ 내 키는 나만의 것
시드 문구와 키는 비밀번호로 브라우저 안에서 암호화되며, 어디로도 전송되지 않습니다. 15분 동안 사용하지 않으면 지갑이 자동으로 잠깁니다. 새 시드 문구는 적어 두고 확인을 마쳐야 저장됩니다.

■ 라이트 또는 다크
Charisma의 라이트 · Bitcoin, 다크 · RPG 디자인을 제공합니다. Blaze Wallet은 기기 설정을 따르며, 보관함에서 직접 고를 수도 있습니다.

Blaze Wallet에는 회원 가입도, 분석도, 추적도 없습니다.
```
`apps/signet/store-assets/listing/zh_CN.md`:

```markdown
Blaze Wallet 升级你使用 Stacks 的方式。Stacks 钱包能做的，它都能做，还多了 Blaze：订单只需签名一次，时机一到便会自动执行，在链上结算，且只付给你。它由 Charisma 打造，常驻在 Chrome 侧边栏中。

【签名一次，自动执行】
限价单和定时买入会提前签名，在价格或时间到来时执行。批准一整套计划（例如一个月的买入）只需一张卡片：它会显示有多少笔订单、这些订单合计可花费多少，并表明它们只能付给你。

【能快则快，关键之处在链上】
Blaze 子网以签名消息的形式转移代币，并在 Stacks 区块链上结算每一笔交易。“状态”选项卡会显示网络、Charisma 代币列表，以及每个 Blaze 子网和你在各子网上的余额，全部直接从链上读取。

【兼容任何 Stacks 应用】
Blaze Wallet 支持标准的 Stacks 钱包协议，因此会出现在任何应用的“连接钱包”列表中。你可以用它连接应用、签署消息、发送 STX 和代币，以及执行合约调用。

【所有代币，一目了然】
一有变动，余额即时更新，并附有图标和美元价值。每个代币只显示一个总额：标准余额与 Blaze 余额合计。发送时只会转出你选定的确切数量。不在 Charisma 代币列表中的代币（例如诈骗空投）会被收起来，也无法被误发。

【清楚知道你签署的是什么】
订单以通俗易懂的文字展示：操作、代币、数量，以及可以付给谁。交易会准确列出哪些代币可能离开你的钱包；网站索取更多时，会发出醒目的警告。每个请求都会打开一张密封卡片，网站无法读取、遮挡或点击。

【你的密钥只属于你】
你的助记词和密钥会在浏览器中用你的密码加密，绝不会被发送到任何地方。钱包闲置 15 分钟后会自动锁定。新的助记词必须先抄下并确认，然后才会被保存。

【浅色或深色】
Charisma 的浅色 · Bitcoin 与深色 · RPG 两种外观。Blaze Wallet 会跟随你的设备，你也可以在“保险库”中选择其中一种。

Blaze Wallet 无需注册账户，没有数据分析，也没有任何追踪。
```
`apps/signet/store-assets/listing/es.md`:

```markdown
Blaze Wallet mejora tu forma de usar Stacks. Hace todo lo que hace una billetera de Stacks y además suma Blaze: firma una orden una vez y se ejecuta sola cuando llegue su momento, liquidada on-chain y pagada solo a ti. Creada por Charisma, vive en el panel lateral de Chrome.

FIRMA UNA VEZ Y SE EJECUTA SOLA
Las órdenes límite y las compras programadas se firman por adelantado y se ejecutan cuando llega su precio o su hora. Aprueba un plan completo, como un mes de compras, con una sola tarjeta que muestra cuántas órdenes hay, el total que pueden gastar y que solo pueden pagarte a ti.

RÁPIDO DONDE SE PUEDE, ON-CHAIN DONDE IMPORTA
Las subredes de Blaze mueven tokens como mensajes firmados y liquidan cada operación en la blockchain de Stacks. La pestaña Estado muestra la red, la lista de tokens de Charisma y cada subred de Blaze con tu saldo en cada una, todo leído directamente de la blockchain.

FUNCIONA CON CUALQUIER APP DE STACKS
Blaze Wallet habla el lenguaje estándar de las billeteras de Stacks, así que aparece en la lista "Conectar billetera" de cualquier app. Conéctate, firma mensajes, envía STX y tokens, y ejecuta llamadas a contratos.

TODOS TUS TOKENS EN UNA SOLA VISTA
Los saldos se actualizan en cuanto algo cambia, con logos y valores en dólares. Cada token muestra un solo total, Estándar y Blaze juntos. Los envíos permiten mover exactamente la cantidad que elijas. Los tokens que no están en la lista de tokens de Charisma, como los airdrops fraudulentos, quedan apartados y no se pueden enviar por error.

SABRÁS EXACTAMENTE QUÉ FIRMAS
Las órdenes se muestran en palabras simples: la acción, el token, la cantidad y a quién se le puede pagar. Las transacciones indican exactamente qué tokens pueden salir de tu billetera, y te advierten de forma bien visible cuando un sitio pide más. Cada solicitud se abre en una tarjeta sellada: el sitio web no puede leerla, taparla ni hacer clic en ella.

TUS CLAVES SIGUEN SIENDO TUYAS
Tu frase semilla y tus claves se cifran en tu navegador con tu contraseña y nunca se envían a ninguna parte. La billetera se bloquea sola tras 15 minutos de inactividad. Las nuevas frases semilla deben anotarse y confirmarse antes de guardarse.

CLARO U OSCURO
Los temas Claro · Bitcoin y Oscuro · RPG de Charisma. Blaze Wallet sigue el tema de tu dispositivo, o puedes elegir uno en la Bóveda.

Blaze Wallet no requiere registro y no tiene analíticas ni rastreo.
```
`apps/signet/store-assets/listing/fr.md`:

```markdown
Blaze Wallet améliore votre façon d’utiliser Stacks. Il fait tout ce que fait un portefeuille Stacks, et y ajoute Blaze : signez un ordre une fois, et il s’exécute tout seul le moment venu, réglé sur la blockchain et payé à vous seul. Conçu par Charisma, il s’ouvre dans le panneau latéral de Chrome.

SIGNEZ UNE FOIS, IL S’EXÉCUTE TOUT SEUL
Les ordres limites et les achats programmés sont signés à l’avance et s’exécutent quand leur prix est atteint ou que leur heure arrive. Approuvez tout un plan, comme un mois d’achats, dans une seule fenêtre qui indique combien d’ordres il contient, le total qu’ils peuvent dépenser, et qu’ils ne peuvent payer que vous.

RAPIDE LÀ OÙ C’EST POSSIBLE, SUR LA BLOCKCHAIN LÀ OÙ ÇA COMPTE
Les sous-réseaux Blaze déplacent les jetons sous forme de messages signés et règlent chaque échange sur la blockchain Stacks. L’onglet État affiche le réseau, la liste de jetons de Charisma et chaque sous-réseau Blaze avec votre solde sur chacun, lus directement sur la blockchain.

FONCTIONNE AVEC TOUTES LES APPLIS STACKS
Blaze Wallet parle le langage standard des portefeuilles Stacks : il apparaît donc dans la liste « Connecter un portefeuille » de n’importe quelle appli. Connectez-vous, signez des messages, envoyez des STX et des jetons, et exécutez des appels de contrat.

TOUS VOS JETONS, UNE SEULE VUE
Les soldes changent dès que quelque chose bouge, avec logos et valeurs en dollars. Chaque jeton affiche un seul total, Standard et Blaze réunis. Les envois autorisent exactement le montant que vous choisissez. Les jetons absents de la liste de jetons de Charisma, comme les airdrops frauduleux, sont mis à l’écart et ne peuvent pas être envoyés par erreur.

SACHEZ EXACTEMENT CE QUE VOUS SIGNEZ
Les ordres sont présentés en termes simples : l’action, le jeton, le montant, et qui peut être payé. Les transactions indiquent exactement quels jetons peuvent quitter votre portefeuille, et vous avertissent haut et fort quand un site en demande plus. Chaque demande s’ouvre dans une fenêtre scellée que le site ne peut ni lire, ni recouvrir, ni cliquer.

VOS CLÉS RESTENT LES VÔTRES
Votre phrase de récupération et vos clés sont chiffrées dans votre navigateur avec votre mot de passe et ne sont jamais envoyées nulle part. Le portefeuille se verrouille tout seul après 15 minutes d’inactivité. Les nouvelles phrases de récupération doivent être notées et confirmées avant d’être enregistrées.

CLAIR OU SOMBRE
Les thèmes Clair · Bitcoin et Sombre · RPG de Charisma. Blaze Wallet suit le réglage de votre appareil, ou choisissez-en un dans le Coffre-fort.

Blaze Wallet : aucun compte à créer, aucune statistique d’utilisation, aucun traçage.
```
`apps/signet/store-assets/listing/de.md`:

```markdown
Blaze Wallet bringt deine Nutzung von Stacks aufs nächste Level. Blaze Wallet kann alles, was eine Stacks-Wallet kann, und bietet zusätzlich Blaze: Signiere eine Order einmal, und sie läuft im richtigen Moment von selbst, on-chain abgewickelt und nur an dich ausgezahlt. Entwickelt von Charisma, öffnet sich Blaze Wallet in der Seitenleiste von Chrome.

EINMAL SIGNIEREN, LÄUFT VON SELBST
Limit-Orders und geplante Käufe werden im Voraus signiert und laufen, sobald ihr Preis oder ihr Zeitpunkt erreicht ist. Genehmige einen ganzen Plan, etwa einen Monat voller Käufe, in einem einzigen Fenster: Es zeigt, wie viele Orders es sind, wie viel sie insgesamt ausgeben können und dass sie nur an dich zahlen können.

SCHNELL, WO ES GEHT, ON-CHAIN, WO ES ZÄHLT
Blaze-Subnetze bewegen Tokens als signierte Nachrichten und wickeln jeden Trade auf der Stacks-Blockchain ab. Der Tab „Status“ zeigt das Netzwerk, die Token-Liste von Charisma und jedes Blaze-Subnetz mit deinem Guthaben darauf, direkt aus der Blockchain gelesen.

FUNKTIONIERT MIT JEDER STACKS-APP
Blaze Wallet spricht die Standardsprache der Stacks-Wallets und erscheint deshalb in der Liste „Wallet verbinden“ jeder App. Verbinde dich, signiere Nachrichten, sende STX und Tokens und führe Vertragsaufrufe aus.

JEDES TOKEN, EINE ANSICHT
Guthaben aktualisieren sich, sobald sich etwas ändert, mit Logos und Dollarwerten. Jedes Token zeigt eine Gesamtsumme, Standard und Blaze zusammen. Beim Senden ist genau der Betrag erlaubt, den du wählst. Tokens, die nicht auf der Token-Liste von Charisma stehen, etwa betrügerische Airdrops, werden ausgeblendet und können nicht versehentlich gesendet werden.

WISSE GENAU, WAS DU SIGNIERST
Orders werden in klaren Worten angezeigt: die Aktion, das Token, der Betrag und wer ausgezahlt werden kann. Transaktionen listen genau auf, welche Tokens deine Wallet verlassen können, und warnen unübersehbar, wenn eine Website mehr verlangt. Jede Anfrage öffnet sich in einem versiegelten Fenster, das die Website weder lesen noch verdecken noch anklicken kann.

DEINE SCHLÜSSEL BLEIBEN DEINE
Deine Seed-Phrase und deine Schlüssel werden in deinem Browser mit deinem Passwort verschlüsselt und niemals irgendwohin gesendet. Die Wallet sperrt sich nach 15 Minuten Inaktivität von selbst. Neue Seed-Phrasen müssen notiert und bestätigt werden, bevor sie gespeichert werden.

HELL ODER DUNKEL
Die Designs Hell · Bitcoin und Dunkel · RPG von Charisma. Blaze Wallet übernimmt die Einstellung deines Geräts, oder du wählst eins im Tresor.

Blaze Wallet kommt ohne Benutzerkonto, ohne Analysetools und ohne Tracking aus.
```
`apps/signet/store-assets/listing/tr.md`:

```markdown
Blaze Wallet, Stacks kullanımınızı bir üst seviyeye taşır. Bir Stacks cüzdanının yaptığı her şeyi yapar ve üstüne Blaze ekler: bir emri bir kez imzalarsınız, zamanı geldiğinde kendiliğinden gerçekleşir, zincir üzerinde kesinleşir ve yalnızca size ödenir. Charisma tarafından geliştirilen bu cüzdan, Chrome yan panelinde yer alır.

BİR KEZ İMZALAYIN, KENDİLİĞİNDEN ÇALIŞSIN
Limit emirleri ve planlı alımlar önceden imzalanır; fiyatı ya da zamanı geldiğinde gerçekleşir. Bir aylık alımlar gibi bütün bir planı tek bir kartla onaylayın: kart, kaç emir olduğunu, toplamda ne kadar harcayabileceklerini ve yalnızca size ödeme yapabileceklerini gösterir.

MÜMKÜN OLDUĞUNDA HIZLI, ÖNEMLİ OLDUĞUNDA ZİNCİR ÜZERİNDE
Blaze alt ağları, tokenları imzalı mesajlar olarak taşır ve her alım satımı Stacks blok zincirinde kesinleştirir. Durum sekmesi; ağı, Charisma token listesini ve her Blaze alt ağını, her birindeki bakiyenizle birlikte doğrudan zincirden okuyarak gösterir.

TÜM STACKS UYGULAMALARIYLA ÇALIŞIR
Blaze Wallet, standart Stacks cüzdan dilini konuşur; bu sayede her uygulamanın “Cüzdan bağla” listesinde görünür. Bağlanın, mesaj imzalayın, STX ve token gönderin, sözleşme çağrıları yapın.

TÜM TOKENLAR TEK EKRANDA
Bakiyeler, bir şey değiştiği anda logolar ve dolar değerleriyle birlikte güncellenir. Her token tek bir toplam gösterir: Standart ve Blaze bir arada. Gönderimlerde yalnızca tam olarak seçtiğiniz miktar gider. Dolandırıcılık amaçlı airdrop'lar gibi Charisma token listesinde olmayan tokenlar bir kenara ayrılır ve yanlışlıkla gönderilemez.

NE İMZALADIĞINIZI TAM OLARAK BİLİN
Emirler sade bir dille gösterilir: eylem, token, miktar ve kime ödeme yapılabileceği. İşlemler, cüzdanınızdan hangi tokenların çıkabileceğini tam olarak listeler ve bir site daha fazlasını istediğinde belirgin bir şekilde uyarır. Her istek, web sitesinin okuyamadığı, üstünü örtemediği ve tıklayamadığı mühürlü bir kartta açılır.

ANAHTARLARINIZ SİZDE KALIR
Kurtarma ifadeniz ve anahtarlarınız, tarayıcınızda şifrenizle şifrelenir ve hiçbir yere gönderilmez. Cüzdan, 15 dakika işlem yapılmadığında kendini kilitler. Yeni kurtarma ifadeleri, kaydedilmeden önce yazılıp doğrulanmalıdır.

AÇIK VEYA KOYU
Charisma imzalı Açık · Bitcoin ve Koyu · RPG görünümleri. Blaze Wallet cihazınızın ayarına uyar; dilerseniz Kasa bölümünden birini seçin.

Blaze Wallet üyelik gerektirmez; analitik veya izleme içermez.
```
`apps/signet/store-assets/listing/ja.md`:

```markdown
Blaze Wallet は、あなたの Stacks の使い方をアップグレードします。Stacks ウォレットにできることはすべてでき、さらに Blaze が加わります。注文に一度署名すれば、そのときが来ると自動で実行され、オンチェーンで決済されて、あなたにのみ支払われます。Charisma が開発し、Chrome のサイドパネルで動作します。

【一度署名すれば、あとは自動で】
指値注文や日時指定の購入は、あらかじめ署名しておけば、指定した価格や日時になったときに実行されます。1 か月分の購入のようなプラン全体も、1 枚のカードでまとめて承認できます。カードには、注文の数、支出できる合計、そしてあなたにしか支払われないことが表示されます。

【速くできるところは速く、肝心なところはオンチェーンで】
Blaze サブネットは、署名付きメッセージとしてトークンを移動し、すべての取引を Stacks ブロックチェーン上で決済します。ステータスタブでは、ネットワーク、Charisma のトークンリスト、すべての Blaze サブネットとそれぞれの残高を、チェーンから直接読み取って表示します。

【どの Stacks アプリでも使える】
Blaze Wallet は標準の Stacks ウォレット規格に対応しているため、どのアプリの「ウォレットを接続」リストにも表示されます。接続、メッセージへの署名、STX やトークンの送金、コントラクト呼び出しの実行ができます。

【すべてのトークンをひと目で】
残高は、変化があった瞬間にロゴやドル換算額とともに更新されます。各トークンは、スタンダードと Blaze を合わせた 1 つの合計で表示されます。送金で許可されるのは、選んだ数量ちょうどだけです。詐欺目的のエアドロップなど、Charisma のトークンリストに掲載されていないトークンは別にまとめられ、誤って送金することはできません。

【署名する内容が正確にわかる】
注文は、操作、トークン、数量、支払いを受けられる相手を、わかりやすい言葉で表示します。トランザクションでは、ウォレットから出ていく可能性のあるトークンを正確に一覧にし、サイトがそれ以上を求めると目立つように警告します。すべてのリクエストは、ウェブサイトが読み取ることも、覆い隠すことも、クリックすることもできない封印されたカードで開きます。

【秘密鍵はあなただけのもの】
シードフレーズと秘密鍵は、パスワードを使ってブラウザ内で暗号化され、どこにも送信されません。15 分間操作がないと、ウォレットは自動でロックされます。新しいシードフレーズは、書き留めて確認するまで保存されません。

【ライトもダークも】
Charisma のライト · Bitcoin とダーク · RPG、2 つのデザインを用意しています。Blaze Wallet はデバイスの設定に合わせますが、保管庫で選ぶこともできます。

Blaze Wallet には、ユーザー登録も、分析も、トラッキングもありません。
```
`apps/signet/store-assets/listing/pt_BR.md`:

```markdown
A Blaze Wallet melhora o seu jeito de usar a rede Stacks. Ela faz tudo o que uma carteira Stacks faz e ainda acrescenta o Blaze: assine uma ordem uma vez e ela é executada sozinha quando chegar a hora, liquidada on-chain e paga só a você. Criada pela Charisma, ela fica no painel lateral do Chrome.

ASSINE UMA VEZ E A ORDEM RODA SOZINHA
Ordens limitadas e compras programadas são assinadas com antecedência e executadas quando chega o preço ou a hora certa. Aprove um plano inteiro, como um mês de compras, com um só cartão que mostra quantas ordens são, o total que elas podem gastar e que elas só podem pagar a você.

RÁPIDO ONDE DÁ, ON-CHAIN ONDE IMPORTA
As sub-redes do Blaze movimentam tokens como mensagens assinadas e liquidam cada operação na blockchain Stacks. A guia Status mostra a rede, a lista de tokens da Charisma e cada sub-rede do Blaze com o seu saldo em cada uma, tudo lido direto da blockchain.

FUNCIONA COM QUALQUER APP DA REDE STACKS
A Blaze Wallet fala a linguagem padrão das carteiras Stacks, então aparece na lista "Conectar carteira" de qualquer app. Conecte-se, assine mensagens, envie STX e tokens e execute chamadas de contrato.

TODOS OS SEUS TOKENS EM UMA SÓ TELA
Os saldos se atualizam no instante em que algo muda, com logos e valores em dólar. Cada token mostra um só total, Padrão e Blaze juntos. Os envios permitem movimentar exatamente a quantidade que você escolher. Tokens que não estão na lista de tokens da Charisma, como airdrops de golpe, ficam guardados à parte e não podem ser enviados por engano.

SAIBA EXATAMENTE O QUE VOCÊ ASSINA
As ordens aparecem em palavras simples: a ação, o token, a quantidade e quem pode receber o pagamento. As transações listam exatamente quais tokens podem sair da sua carteira e alertam com destaque quando um site pede mais. Cada solicitação abre um cartão selado que o site não consegue ler, cobrir nem clicar.

SUAS CHAVES CONTINUAM SUAS
Sua frase de recuperação e suas chaves são criptografadas no seu navegador com a sua senha e nunca são enviadas a lugar nenhum. A carteira se bloqueia sozinha após 15 minutos de inatividade. Novas frases de recuperação precisam ser anotadas e confirmadas antes de serem salvas.

CLARO OU ESCURO
Os temas Claro · Bitcoin e Escuro · RPG da Charisma. A Blaze Wallet segue o tema do seu dispositivo, ou você pode escolher um no Cofre.

A Blaze Wallet não exige cadastro e não tem análises de uso nem rastreamento.
```

- [ ] **Patch the listing notes and the button row.** In French, German, Spanish, Brazilian Portuguese and Japanese, the Vault card's Export, Lock and Unlink buttons are a few pixels too wide for a 360-pixel panel, so the row may wrap. Save this patch as `/tmp/plan4-task3.patch`, then run `git apply --check /tmp/plan4-task3.patch && git apply /tmp/plan4-task3.patch`.

```diff
diff --git a/apps/signet/src/shared/styles/style.css b/apps/signet/src/shared/styles/style.css
index 2218872..2c2b5c8 100644
--- a/apps/signet/src/shared/styles/style.css
+++ b/apps/signet/src/shared/styles/style.css
@@ -129,7 +129,7 @@ input[type="checkbox"] {
 }
 
 .w-stack { display: flex; flex-direction: column; gap: 12px; }
-.w-actions { display: flex; gap: 8px; }
+.w-actions { display: flex; flex-wrap: wrap; gap: 8px; }
 .w-actions > * { flex: 1; }
 
 /* A list inside a card: rows split by soft lines */
diff --git a/apps/signet/store-assets/LISTING.md b/apps/signet/store-assets/LISTING.md
index 32b176d..90ec966 100644
--- a/apps/signet/store-assets/LISTING.md
+++ b/apps/signet/store-assets/LISTING.md
@@ -11,7 +11,10 @@ Upload `build/blaze-wallet-chrome.zip` (made by `pnpm package:store` in apps/sig
 
 **Category:** Tools (or Productivity; pick in the dashboard)
 
-**Language:** English
+**Languages:** English, 한국어, 简体中文, Español, Français, Deutsch, Türkçe, 日本語, Português (Brasil).
+- The summary comes from the extension itself (`locales/{folder}/messages.json`, `extensionDescription`), in each language.
+- In the dashboard, add each language and paste its description from `listing/{folder}.md` (folders `ko`, `zh_CN`, `es`, `fr`, `de`, `tr`, `ja`, `pt_BR`).
+- The privacy and permission sections aren't per-language.
 
 **Description:**
 
```

- [ ] **Commit**

```bash
git add apps/signet/store-assets apps/signet/src/shared/styles/style.css
git commit -m "feat(signet): Store descriptions in eight more languages; the Vault card's buttons wrap when a language runs long" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hand-off

- [ ] **Run the check once more:** `node apps/signet/scripts/check-locales.mjs`. Expected: `Locales check out: 9 languages, 232 English messages, 207 keys used in the code`.
- [ ] **Confirm the tree is clean** with `git status`.
- [ ] **Report to Ross.** Tell him the extension is ready for his manual pass, from the spec's "Testing":
  - **Restart `pnpm dev` for the extension first.** Plasmo only watches the locale folders that existed when it started.
  - Walk the side panel and one approval of each kind (connect, sign message, transaction, sign order, sign orders) in German (long words) and Japanese (fonts).
  - Switch languages with the Vault card's picker. Check that Automatic follows Chrome's language, and that a `zh-TW` Chrome starts in English.
  - Try an error in each place: a wrong password in the side panel, and Approve after the wallet auto-locked in the approval window.
  - Type an amount with a comma in German (`1,5`) and send it to himself.
  - When publishing 0.5.0: in the store dashboard, add each language and paste its description from `store-assets/listing/{folder}.md`.
