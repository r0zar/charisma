# Blaze Wallet translations — Design

Date: 2026-10-12
Apps: `apps/signet` (Blaze Wallet Chrome extension, ships as v0.5.0) and `apps/blaze-ios` (in v1, see `2026-10-12-blaze-wallet-ios-design.md`)
Status: draft for Ross's review. Rules and per-app approach were approved in conversation

## Summary

Blaze Wallet speaks nine languages in both the Chrome extension and the iOS app.
- The extension starts in the browser's language and has a Language picker.
- The iOS app follows the phone's language, with no picker of its own. People with several languages on their iPhone get iOS's own per-app Language setting.
- Each app uses its platform's own translation files. One shared list of wallet terms keeps the two apps saying the same thing.
- Claude writes every translation and they ship without outside review, so a script guards completeness.

## Languages

| Language | Shown in the picker as | Chrome folder | Apple code |
|---|---|---|---|
| English (source, and the default) | English | `en` | `en` |
| Korean | 한국어 | `ko` | `ko` |
| Chinese, Simplified | 简体中文 | `zh_CN` | `zh-Hans` |
| Spanish | Español | `es` | `es` |
| French | Français | `fr` | `fr` |
| German | Deutsch | `de` | `de` |
| Turkish | Türkçe | `tr` | `tr` |
| Japanese | 日本語 | `ja` | `ja` |
| Portuguese, Brazil | Português (Brasil) | `pt_BR` | `pt-BR` |

The 9th, Brazilian Portuguese, was Claude's pick: Brazil leads Chainalysis's 2026 crypto adoption index (per a news summary of the report). Traditional Chinese would be a separate translation and is left for later.

## Shared rules (both apps)

**Choosing the language.**
- **Extension:** the picker's first choice is **Automatic**, then each language in its own name. Automatic matches the way Chrome itself does:
  - the exact language first (`zh-CN` → `zh_CN`, `pt-BR` → `pt_BR`)
  - then the base language when there's a folder for it (`es-419` → `es`, `de-AT` → `de`)
  - otherwise English. So Traditional Chinese (`zh-TW`) and European Portuguese (`pt-PT`) start in English, and can pick 简体中文 or Português (Brasil).
- **iOS:** no picker. Apple's own matching (`Bundle.preferredLocalizations`) picks the language from the phone's preferred languages, and Traditional Chinese phones get English there too. iOS shows its own per-app Language row in Settings once a phone has 2 or more preferred languages.

**Translated:**
- every screen and every message the wallet writes, errors included
- the extension's store description

**Not translated:**
- seed words (always the English BIP39 list, because Stacks wallets accept only that and other words would give a different wallet)
- token names and symbols, addresses, txids
- brand names: Blaze Wallet, Blaze, Charisma, Charisma Swap, Stacks
- Apple system names, which use Apple's own wording per language: Face ID, passcode, Settings
- the privacy policy
- messages written by servers or libraries (for example the network's rejection reason). Those show as-is after a translated lead-in such as "The network rejected the transfer:"

**Numbers.**
- **The format follows the active locale.** In the extension that's the active language. On iOS it's `Locale.current`, the phone's language plus its region, which is also what the decimal keypad types. Amounts, dollar values and times use that locale's marks (`1.234,56` in German).
- **Each screen keeps its precision.** Only the marks change:
  - token list: cut (not rounded) to at most 6 decimals
  - Status: rounded to 4 decimals
  - send review and every approval card: the exact amount, every decimal
- **Two of those are fixes.** Today the send review cuts to 6 decimals, so 1 satoshi of sBTC shows "0.000000". The transaction approval rounds to 6. Both become exact.
- **Typing an amount accepts only the locale's decimal mark**, and no grouping marks: `1,5` in German, `1.5` in Japanese. Anything else gets "Enter an amount like 1,5", written with the locale's mark.
- **Max** fills the exact balance with the locale's decimal mark and no grouping. Today the extension cuts Max to 6 decimals and strips commas, which would delete a German decimal comma.

**Seed word entry.** This applies to importing words and to the new-seed confirmation step. Before comparing words:
- convert full-width letters and spaces to normal ones (Unicode NFKC), since Japanese, Chinese and Korean keyboards type them
- turn Turkish `İ` and `ı` into `i`, since Turkish keyboards and autocorrect type them and lowercasing `İ` gives `i̇`
- then lowercase and collapse spaces. Lowercasing never uses a locale (JS `toLowerCase()`, Swift `lowercased()`), because Turkish-locale lowercasing turns `I` into `ı` and a seed typed in capitals would fail.

On iOS, seed-word fields also use the ASCII-capable keyboard with autocapitalization and autocorrection off. The normalization still applies to pasted words.

**Wallet terms.**
- `docs/i18n/wallet-terms.md` fixes the translation of the words that must never drift, in all nine languages: seed phrase, account, active, unlink, lock, unlock, auto-lock, network fee, recipient, amount, send, receive, balance, Standard, on Blaze, token list, unlisted, subnet, explorer, and the safety line "Exactly this amount, nothing else".
- Whichever plan runs first writes the list. Both apps follow it.

**Plurals.**
- Counted phrases ("3 tokens", "1 without a price") pick the language's plural form.
- Korean, Chinese and Japanese have one form. The others have one/other, and Spanish, French and Portuguese also have `many`.
- Each language provides the forms its `Intl.PluralRules` categories need, and no more.

**Whole sentences.** Text is never assembled from fragments ("You" + "send" + "at most" + amount). Each sentence is one string with fill-in slots, so word order can change per language.

**Layout and fonts.**
- German and French run about 30% longer, so every screen is checked in German. Safety warnings wrap and are never cut off.
- The brand fonts cover Spanish, French, German, Turkish and Portuguese (checked with CoreText). They have no Korean, Japanese or Chinese, so those show in the system's fonts.
- Each page or app declares its active language (`<html lang>` in the extension, the app locale on iOS), so Japanese and Chinese characters take their own shapes.

**Quality.** Each app has a check that fails when any language is missing a string, has an empty one, or has fill-in slots that don't match English. Packaging runs it first.

## Chrome extension (`apps/signet`)

**Files.**
- `apps/signet/locales/{folder}/messages.json` in Chrome's format (`{ key: { message, description } }`), which Plasmo copies into `_locales`. `description` tells the translator where the text appears.
- Fill-in slots use Chrome's own `$1`…`$9`, and `$$` writes a literal `$`.
- Plural keys end in the plural category: `tokenCount_one`, `tokenCount_other`, and `_many` where needed.
- Add the folder before starting `pnpm dev`: Plasmo only watches locale files that existed when the dev server started.

**Manifest.**
- `manifest.default_locale: "en"`.
- `description` and `manifest.description` become `__MSG_extensionDescription__`, so the Chrome Web Store and `chrome://extensions` show it per language.
- It must be **132 characters or fewer** in every language. That's Chrome's limit, and English is already 126.
- The name stays "Blaze Wallet" everywhere.

**Where the code lives:**
- `src/shared/i18n-core.ts`: lookup, `$n` substitution and plural selection over the nine bundled files. It touches no `localStorage` and no DOM, so the background service worker can import it. The background uses it only in English, to build `WalletError.message`.
- `src/shared/seed-words.ts`: the one seed-word normalization function, used by the side panel and the background alike.

**The helper**, `src/shared/i18n.ts`, for extension pages only. It builds on `i18n-core.ts`:
- `chrome.i18n.getMessage` can't switch languages on demand, so the helper reads the same nine files, bundled as JSON imports.
- It exposes `t(key, ...fills)`; `plural(key, count, ...fills)`, which picks with `Intl.PluralRules` and falls back to `_other`; and `locale`, the BCP 47 tag for `Intl` formatting.
- The setting lives in `localStorage` (`blaze-language`: `auto` or a folder name), like the theme. Every extension page shares one origin, so one pick covers the side panel and the approval window.
- Automatic reads `chrome.i18n.getUILanguage()`.
- The helper sets `<html lang>` at load.
- A key missing from a translation throws in development. Packaging can't ship one because the check fails.

**The picker.** Wallet → Vault card, a Language dropdown under Theme. Choosing a language saves it and reloads the side panel. The wallet stays unlocked, since the session is in `chrome.storage.session`. An open approval window picks it up the next time it opens.

**Errors from the background.** The background never picks a language.
- **WalletError.** These throw a `WalletError` carrying a message key and its fills (the values for `$1`…`$9`):
  - the 19 `throw new Error(...)` sites whose messages reach the wallet's own pages, in `lib/wallet/storage.ts`, `lib/wallet/index.ts`, `lib/tokens.ts` and `lib/diagnostics.ts`
  - `handleApproval`'s "This request is no longer waiting" in `lib/provider.ts`

  The 4 guards in `messages/handler.ts` (an invalid id, a sender that isn't a wallet page, an invalid send, an unknown action) stay plain errors. Only a bug can reach them, so they cross as `{ message }` and show after the "Something went wrong" lead-in.

  Its `.message` is the English text, built from `locales/en/messages.json`. So anything that still reads `.message`, such as the JSON-RPC errors `handleRpc` returns to websites, stays English for developers.
- **Wallet pages.** The message handler replies `{ success: false, error: { key, fills } }` for a `WalletError`, and `{ success: false, error: { message } }` for anything else (a library or a server). `handleApproval`'s reply to the approval window does the same: `{ error: { key, fills } }` or `{ error: { message } }`.
- **Translating.** `sendMessage` in `src/shared/context/utils.ts` and `ask()` in `src/tabs/approve.tsx` both turn a keyed error into an `Error` with message `t(key, ...fills)`. An unexpected one becomes an `Error` with the raw message, marked `unexpected`.
- **Lead-ins.** The shared `ErrorText` adds the "Something went wrong: {message}" lead-in only to unexpected errors. A line with its own lead-in, like "Prices unavailable: {message}", shows the raw message, so lead-ins are never doubled.
  - For that to work, screens keep the `Error` itself in state, not just `err.message`.
  - The approval window shows its errors with `ErrorText` instead of its own `<p className="w-error">` (`approve.tsx` lines 148 and 170).

**Everything with text goes through `t()`:**
- the side panel: Wallet, Tokens and Status tabs, the error boundary, and the export notices in `shared/context/utils.ts`
- the text inside `confirm()` dialogs (Unlink). Their OK and Cancel buttons stay in Chrome's own language, which the extension can't change.
- the approval window `tabs/approve.tsx` and its card:
  - `shared/notifications/NotificationPanel.tsx`
  - the five approval contents (connect, sign message, sign order, sign orders, transaction)
  - the safety lines in `TransactionContent.tsx`, rewritten as whole-sentence strings
- `title`, `aria-label` and `placeholder` attributes
- errors thrown in UI code
- `src/contents` shows no text and needs nothing.

**Numbers.**
- The hardcoded `"en-US"` in `tabs/approve.tsx`, `sidepanel/StatusTab.tsx`, `shared/ui.tsx`, `shared/tabs/TransferTab.tsx`, `shared/approvals/SignOrdersContent.tsx` and `shared/approvals/TransactionContent.tsx` becomes the helper's `locale`.
- `locale` is Chrome's own language when that's a variant of the page's language, and the page's language otherwise. So Latin American Spanish (`es-419`) writes `1,234.5`, where Spain's `es` writes `1.234,5`. `<html lang>` stays the page's language.
- The precision of each screen follows the shared number rules. That includes the two fixes: the send review and `TransactionContent.tsx` show exact amounts.
- `parseUnits` and the Max button in `TransferTab.tsx` follow the shared rules for the decimal mark.
- The amount placeholder (`0.0 STX`) uses the active decimal mark.

**Seed words.** The shared seed-word normalization goes in one function, used in three places:
- `validateSeedPhrase` and `importSeedPhrase` in `background/lib/wallet`
- `confirmAndSave` in `shared/wallet/WalletTab.tsx`, where today `.trim().toLowerCase()` would reject a Turkish `İ`

**Store listing.**
- `store-assets/listing/{folder}.md` holds each language's translation of only the Description section of `store-assets/LISTING.md`. Ross pastes them into the Chrome Web Store dashboard when publishing.
- The summary comes from the manifest. The privacy and permission sections aren't per-language in the dashboard.
- Screenshots stay English for now.
- Version 0.5.0.

**Check.** `scripts/check-locales.mjs` (`pnpm --filter signet-signer check:locales`) fails on:
- a key in `en` missing from another language, or an extra one (plural keys compare by base name)
- a plural key missing a form that the language's `Intl.PluralRules` categories need
- different `$n` slots from English
- an empty message
- any `$word$` pattern, such as `$1$2`. Chrome reads that as an undefined placeholder and refuses to load the whole extension.
- `extensionDescription` over 132 characters
- a key used in `src` that isn't in `en`: every `t()` and `plural()` key, and every `new WalletError("…")` key

`package:store` runs it before building.

## iOS app (`apps/blaze-ios`)

Added to the iOS spec (section Languages). In short:
- **Files.**
  - `Localizable.xcstrings`, Apple's String Catalog, in the app target. SwiftUI text is extracted into it automatically.
  - `InfoPlist.xcstrings` for the Face ID prompt.
  - WalletCore stays language-free: its errors are typed, and the app's catalog words them. One catalog to translate and check.
- **No picker.** The app follows the phone's language (see Choosing the language).
- **Rules.** Amount parsing and formatting live in WalletCore and use `Locale.current`. Seed-word normalization lives in StacksKit and uses no locale. Both have unit tests.
- **Check.** `scripts/check-strings.mjs` checks that both catalogs have every key in all nine languages, marked translated, with matching format specifiers.

## Testing

- Both checks pass.
- Unit tests, iOS:
  - parsing in `de_DE`, `tr_TR`, `ja_JP` and `en_US` (`1,5` accepted in German and rejected in Japanese; grouping rejected)
  - the token list cuts while review is exact
  - seed normalization turns `İ` and full-width input into the right words
- Manual, extension:
  - walk the side panel and one approval of each kind in German (length) and Japanese (fonts)
  - switch language with the picker
  - check Automatic follows Chrome's language, and a `zh-TW` Chrome starts in English
  - try an error in each place: a wrong password in the side panel, and Approve after the wallet auto-locked in the approval window
- Manual, iOS: the same walk in German and Japanese (Xcode scheme → App Language).

## Later

- Traditional Chinese, and more languages on demand.
- Translated store screenshots; App Store listing translations when the iOS app is published.
- Right-to-left languages (Arabic, Hebrew, Persian), which need layout work.
