# Blaze Wallet iOS, Plan 3b: Eight More Languages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The iOS app speaks Korean, Simplified Chinese, Spanish, French, German, Turkish, Japanese and Brazilian Portuguese as well as English, with a check that fails when any string is missing or unsafe.

**Architecture:**
- **Where translations live:** Apple's String Catalogs (`Localizable.xcstrings`, `InfoPlist.xcstrings`) stay the one home of every translation.
- **How they get in:** a small import script writes per-language JSON maps into the catalogs. `sync-strings.sh` (plan 3) then rewrites them in Xcode's own format.
- **How they're checked:** `check-strings.mjs` checks completeness, plural forms and format specifiers.
- **Shared terms:** `docs/i18n/wallet-terms.md` fixes the terms both the app and the Chrome extension use.

**Tech Stack:** String Catalogs, Node (no dependencies), `xcrun xcstringstool`.

**Spec:** `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md` (all of "Shared rules"), and `docs/superpowers/specs/2026-10-12-blaze-wallet-ios-design.md` (section "Languages").

**Baseline:** branch `feat/blaze-ios` with plan 3 done (the English app; `sync-strings.sh` reports 140 keys and changes nothing).

---

## Working notes for every task

- **Pre-tested.** This plan was replayed before it was written. Starting from plan 3's English catalog, importing these eight files then syncing gives the same catalog in any import order, and the check prints `All strings are translated into 8 languages`. The app built with all nine `.lproj` folders, and Welcome drew correctly in German and Japanese.
- **Translations:** Claude wrote them, following the terms list, with no outside review (Ross's choice). Copy them exactly: every format specifier and non-breaking space (U+00A0, as in "Face ID") is deliberate.
- **Commands:** run every command from the repo root.
- **Commits:** commit after every task, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

| File | Responsibility |
|---|---|
| `docs/i18n/wallet-terms.md` | The terms both apps use, per language, plus platform and grammar rules |
| `apps/blaze-ios/scripts/import-translations.mjs` | Writes per-language JSON maps into the two catalogs |
| `apps/blaze-ios/scripts/check-strings.mjs` | Fails on a missing, untranslated or mismatched string in any language |
| `apps/blaze-ios/BlazeWallet/Localizable.xcstrings`, `InfoPlist.xcstrings` | Gain the eight languages |
| `apps/blaze-ios/README.md` | Gains a Languages section |

---

### Task 1: The terms list

**Files:** Create `docs/i18n/wallet-terms.md`

- [ ] **Write it**

```markdown
# Blaze Wallet terms

The words that must never drift between the Chrome extension (`apps/signet/locales`) and the iOS app (`apps/blaze-ios/BlazeWallet/Localizable.xcstrings`). Every translation in both apps uses these. Rules and languages: `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md`.

**Never translated:**
- Blaze Wallet, Blaze, Charisma, Charisma Swap, Stacks, STX
- Bitcoin and RPG in the theme names
- seed words (always the English BIP39 list)
- token names and symbols, addresses, txids

**Apple's own words:** Face ID, passcode and Settings use Apple's wording in each language. Note: Simplified Chinese calls Face ID 面容 ID.

| English | 한국어 (ko) | 简体中文 (zh-Hans / zh_CN) | Español (es) | Français (fr) | Deutsch (de) | Türkçe (tr) | 日本語 (ja) | Português (Brasil) (pt-BR / pt_BR) |
|---|---|---|---|---|---|---|---|---|
| wallet | 지갑 | 钱包 | billetera | portefeuille | Wallet | cüzdan | ウォレット | carteira |
| seed phrase | 시드 문구 | 助记词 | frase semilla | phrase de récupération | Seed-Phrase | kurtarma ifadesi | シードフレーズ | frase de recuperação |
| (seed) words | 단어 | 单词 | palabras | mots | Wörter | kelimeler | 単語 | palavras |
| account | 계정 | 账户 | cuenta | compte | Konto | hesap | アカウント | conta |
| active | 사용 중 | 使用中 | activa | actif | aktiv | etkin | 使用中 | ativa |
| use (switch to an account) | 사용 | 使用 | usar | utiliser | verwenden | kullan | 使用 | usar |
| unlink | 연결 해제 | 取消关联 | desvincular | dissocier | trennen | bağlantıyı kaldır | リンク解除 | desvincular |
| lock | 잠금 | 锁定 | bloquear | verrouiller | sperren | kilitle | ロック | bloquear |
| unlock | 잠금 해제 | 解锁 | desbloquear | déverrouiller | entsperren | kilidi aç | ロック解除 | desbloquear |
| auto-lock | 자동 잠금 | 自动锁定 | bloqueo automático | verrouillage automatique | automatische Sperre | otomatik kilit | 自動ロック | bloqueio automático |
| network fee | 네트워크 수수료 | 网络手续费 | comisión de red | frais de réseau | Netzwerkgebühr | ağ ücreti | ネットワーク手数料 | taxa de rede |
| recipient | 받는 사람 | 收款人 | destinatario | destinataire | Empfänger | alıcı | 受取人 | destinatário |
| amount (of a token) | 수량 | 数量 | cantidad | montant | Betrag | miktar | 数量 | quantidade |
| send | 보내기 | 发送 | enviar | envoyer | senden | gönder | 送金 | enviar |
| receive | 받기 | 收款 | recibir | recevoir | empfangen | al | 受け取る | receber |
| balance | 잔액 | 余额 | saldo | solde | Guthaben | bakiye | 残高 | saldo |
| Standard (the on-chain balance) | 일반 | 标准 | Estándar | Standard | Standard | Standart | スタンダード | Padrão |
| on Blaze | Blaze에 | 在 Blaze 上 | en Blaze | sur Blaze | auf Blaze | Blaze'de | Blaze 上 | no Blaze |
| token | 토큰 | 代币 | token | jeton | Token | token | トークン | token |
| token list | 토큰 목록 | 代币列表 | lista de tokens | liste de jetons | Token-Liste | token listesi | トークンリスト | lista de tokens |
| unlisted | 목록에 없음 | 未收录 | no listado | non listé | nicht gelistet | listede yok | 未掲載 | não listado |
| subnet | 서브넷 | 子网 | subred | sous-réseau | Subnetz | alt ağ | サブネット | sub-rede |
| explorer | 탐색기 | 区块浏览器 | explorador | explorateur | Explorer | blok gezgini | エクスプローラー | explorador |
| Exactly this amount, nothing else | 정확히 이 수량만, 그 이상은 없음 | 只转出这个数量，不多不少 | Exactamente esta cantidad, nada más | Exactement ce montant, rien de plus | Genau dieser Betrag, sonst nichts | Tam olarak bu miktar, fazlası değil | この数量だけ、それ以上は送られません | Exatamente esta quantidade, nada mais |
| funds | 자금 | 资金 | fondos | fonds | Guthaben | fonlar | 資金 | fundos |
| Vault (the settings card) | 보관함 | 保险库 | Bóveda | Coffre-fort | Tresor | Kasa | 保管庫 | Cofre |
| Theme | 테마 | 主题 | Tema | Thème | Design | Tema | テーマ | Tema |
| Live (Status: everything answered) | 정상 | 在线 | En línea | En ligne | Online | Çevrimiçi | 正常 | Online |
| Face ID (Apple) | Face ID | 面容 ID | Face ID | Face ID | Face ID | Face ID | Face ID | Face ID |
| passcode (Apple) | 암호 | 密码 | código | code | Code | parola | パスコード | código |
| Settings (Apple) | 설정 | 设置 | Ajustes | Réglages | Einstellungen | Ayarlar | 設定 | Ajustes |
| System (theme) | 시스템 | 跟随系统 | Sistema | Système | System | Sistem | システム | Sistema |
| Light · Bitcoin | 라이트 · Bitcoin | 浅色 · Bitcoin | Claro · Bitcoin | Clair · Bitcoin | Hell · Bitcoin | Açık · Bitcoin | ライト · Bitcoin | Claro · Bitcoin |
| Dark · RPG | 다크 · RPG | 深色 · RPG | Oscuro · RPG | Sombre · RPG | Dunkel · RPG | Koyu · RPG | ダーク · RPG | Escuro · RPG |

**Tone:** plain and calm, as in English. How each language addresses the person:

| Language | Address |
|---|---|
| Spanish | tú |
| German | du |
| Portuguese (Brazil) | você |
| French | vous |
| Turkish | polite siz forms ("girin", "kontrol edin") |
| Korean | polite -요 / -습니다 endings |
| Japanese | です / ます |
| Chinese | neutral |

**Platform words.** When a platform has its own word for something, each app follows its own platform:

| Example | iOS app (Apple's iOS terms) | Extension (Chrome's and the web's) |
|---|---|---|
| "Copy" in Chinese | 拷贝 | 复制 |
| "Done" in Spanish | OK | Listo |
| "Done" in Portuguese | OK | Concluído |

**Shared phrases:** where the extension says the same thing as the iOS app (the seed-word warnings, the send review, the unlink dialogs, the errors), use the iOS app's translation word for word.

**Grammar, per language:**
- **Korean:** never attach a particle straight to a fill-in (`%@` or `$1`), because the right particle depends on the word that fills it.
- **Simplified Chinese:** full-width punctuation (，。：). "Live" (Status) is 在线.
- **Spanish:** Latin American verbs (ingresa, agrega, revisa).
- **Turkish:**
  - the plural of token is "tokenlar"
  - no suffix attached to a fill-in or a brand name: reword instead ("Stacks ağında")
  - the seed warning says "kontrolünü ele geçirir", not "kontrol eder", which also means "checks"
- **Japanese:**
  - a half-width space between Latin text or numbers and Japanese ("Blaze 上", "24 単語"); full-width （）「」：？
  - the vault's "Keys" is 秘密鍵, because plain 鍵 can mean "lock"
  - tokens are counted with 種類
  - "Live" (Status) is 正常
- **Korean and Japanese:** "controls your funds" is "can move your funds at will" (자금을 마음대로 움직일 수 있습니다 / 資金を自由に動かせます).
- **French:** the curly apostrophe (’), and a non-breaking space before : ; ? ! and inside « ».
- **German:** a non-breaking space before a trailing "…" ("Wird geprüft …").
- **Brazilian Portuguese:** "a Blaze Wallet" and "da Charisma" (both feminine); "Charisma Swap" with no article.
```

- [ ] **Commit**

```bash
git add docs/i18n/wallet-terms.md
git commit -m "docs(i18n): The Blaze Wallet terms both apps translate the same way" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The import and the check

**Files:** Create `apps/blaze-ios/scripts/import-translations.mjs`, `apps/blaze-ios/scripts/check-strings.mjs`

- [ ] **Write the check, and watch it fail**

```js
/**
 * Fails when the app's String Catalogs aren't complete in all nine languages (translations spec, "Quality").
 * Checked for every key Xcode still uses:
 *   - each language has it, marked translated, not empty
 *   - counted phrases have every plural form the language needs (Intl.PluralRules)
 *   - the format specifiers (%@, %lld, positional or not) match the English, so no value gets lost or misread
 * Run from the repo root: node apps/blaze-ios/scripts/check-strings.mjs
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const LANGUAGES = ["ko", "zh-Hans", "es", "fr", "de", "tr", "ja", "pt-BR"]
const app = join(dirname(fileURLToPath(import.meta.url)), "../BlazeWallet")
const problems = []

/** "%1$@ and %lld" → ["%@", "%lld"]: the specifiers, order-free, positions dropped */
const specifiers = text => (text.match(/%(\d+\$)?(@|lld|ld|d|f|s)/g) ?? []).map(spec => spec.replace(/\d+\$/, "")).sort()

/** A localization's texts: one string, or one per plural form */
function texts(localization) {
  if (localization?.stringUnit) return { "": localization.stringUnit }
  const plural = localization?.variations?.plural
  return plural ? Object.fromEntries(Object.entries(plural).map(([form, value]) => [form, value.stringUnit])) : null
}

for (const file of ["Localizable.xcstrings", "InfoPlist.xcstrings"]) {
  const catalog = JSON.parse(readFileSync(join(app, file), "utf8"))
  for (const [key, entry] of Object.entries(catalog.strings)) {
    if (entry.shouldTranslate === false || entry.extractionState === "stale") continue
    const english = texts(entry.localizations?.en) ?? { "": { value: key } }
    const expected = specifiers(Object.values(english)[0].value)
    for (const language of LANGUAGES) {
      const found = texts(entry.localizations?.[language])
      if (!found) {
        problems.push(`${file} ${language}: missing "${key}"`)
        continue
      }
      if (entry.localizations.en?.variations?.plural || entry.localizations[language].variations?.plural) {
        for (const form of new Intl.PluralRules(language).resolvedOptions().pluralCategories) {
          if (!found[form]) problems.push(`${file} ${language}: "${key}" has no "${form}" plural form`)
        }
      }
      for (const [form, unit] of Object.entries(found)) {
        const where = `${file} ${language}: "${key}"${form ? ` (${form})` : ""}`
        if (unit?.state !== "translated" || !unit.value?.trim()) problems.push(`${where} isn't translated`)
        else if (specifiers(unit.value).join() !== expected.join()) problems.push(`${where} has ${specifiers(unit.value).join(" ") || "no specifiers"}, English has ${expected.join(" ") || "none"}`)
      }
    }
  }
}

if (problems.length) {
  console.error(`${problems.join("\n")}\n\n${problems.length} problem${problems.length === 1 ? "" : "s"}`)
  // exitCode, not exit(): exit() can cut off output still being written to a pipe
  process.exitCode = 1
} else {
  console.log(`All strings are translated into ${LANGUAGES.length} languages`)
}
```

Run: `node apps/blaze-ios/scripts/check-strings.mjs 2>&1 | tail -1`
Expected: `1128 problems` (141 keys × 8 languages, none translated yet).

- [ ] **Write the import**

```js
/**
 * Puts translations into BlazeWallet/Localizable.xcstrings (and the Face ID prompt into InfoPlist.xcstrings).
 * Each file is named after an Apple language code (ko.json, zh-Hans.json, pt-BR.json…) and maps an English key to
 * its translation, or to { one, many, other } for a counted phrase. A key the catalogs don't have is an error.
 *   node apps/blaze-ios/scripts/import-translations.mjs path/to/ko.json path/to/ja.json …
 * Then run scripts/sync-strings.sh, which also rewrites the catalog in Xcode's own format.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const app = join(dirname(fileURLToPath(import.meta.url)), "../BlazeWallet")
const catalogs = Object.fromEntries(
  ["Localizable.xcstrings", "InfoPlist.xcstrings"].map(file => [file, JSON.parse(readFileSync(join(app, file), "utf8"))])
)

const unit = value => ({ stringUnit: { state: "translated", value } })

for (const path of process.argv.slice(2)) {
  const language = basename(path, ".json")
  const translations = JSON.parse(readFileSync(path, "utf8"))
  for (const [key, translation] of Object.entries(translations)) {
    const catalog = Object.values(catalogs).find(catalog => key in catalog.strings)
    if (!catalog) throw new Error(`${language}: "${key}" isn't in either catalog`)
    const entry = catalog.strings[key]
    entry.localizations ??= {}
    entry.localizations[language] = typeof translation === "string"
      ? unit(translation)
      : { variations: { plural: Object.fromEntries(Object.entries(translation).map(([form, value]) => [form, unit(value)])) } }
  }
  console.log(`${language}: ${Object.keys(translations).length} strings`)
}

for (const [file, catalog] of Object.entries(catalogs)) {
  // Languages in alphabetical order, as Xcode writes them, so the same translations always give the same file
  for (const entry of Object.values(catalog.strings)) {
    if (entry.localizations) entry.localizations = Object.fromEntries(Object.entries(entry.localizations).sort(([a], [b]) => a.localeCompare(b)))
  }
  writeFileSync(join(app, file), `${JSON.stringify(catalog, null, 2)}\n`)
}
```

- [ ] **Commit**

```bash
git add apps/blaze-ios/scripts/check-strings.mjs apps/blaze-ios/scripts/import-translations.mjs
git commit -m "feat(blaze-ios): Strings check and translation import" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The translations

**Files:** Modify `apps/blaze-ios/BlazeWallet/Localizable.xcstrings`, `apps/blaze-ios/BlazeWallet/InfoPlist.xcstrings` (generated by the import)

- [ ] **Write the eight files** into `/tmp/blaze-translations/` (temporary; the catalogs keep the result):

`/tmp/blaze-translations/ko.json` (Korean):

```json
{
 "%@ on Blaze": "Blaze에 %@",
 "%@ sent": "%@ 보내기 완료",
 "%@ units": "%@ 단위",
 "%lld tokens": {
  "other": "토큰 %lld개"
 },
 "%lld unlisted · not on Charisma's token list, may be scams": {
  "other": "목록에 없음 %lld개 · Charisma 토큰 목록에 없으며, 사기일 수 있습니다"
 },
 "%lld without a price": {
  "other": "가격 정보 없음 %lld개"
 },
 "+ Account": "+ 계정",
 "12 or 24 words": "단어 12개 또는 24개",
 "A seed phrase named “%@” already exists.": "이름이 ‘%@’인 시드 문구가 이미 있습니다.",
 "Account %lld": "계정 %lld",
 "Active": "사용 중",
 "Add an account from a seed phrase below.": "아래 시드 문구에서 계정을 추가하세요.",
 "Address": "주소",
 "After 15 idle minutes": "15분 동안 사용하지 않으면",
 "Amount": "수량",
 "An unknown token: shown in its smallest units, and it can't be sent from here.": "알 수 없는 토큰입니다. 가장 작은 단위로 표시되며, 여기서 보낼 수 없습니다.",
 "Anyone who sees these words controls your funds. Write them down on paper and keep them private.": "이 단어를 보는 사람은 누구나 자금을 마음대로 움직일 수 있습니다. 종이에 적어 비밀로 보관하세요.",
 "At most %lld decimal places.": {
  "other": "소수점 이하는 %lld자리까지만 입력할 수 있습니다."
 },
 "Auto-lock": "자동 잠금",
 "Back": "뒤로",
 "Back to the words": "단어로 돌아가기",
 "Blaze subnets": "Blaze 서브넷",
 "Block": "블록",
 "Cancel": "취소",
 "Cancelled.": "취소되었습니다.",
 "Charisma token list": "Charisma 토큰 목록",
 "Charisma's balance service sent something Blaze Wallet can't read.": "Charisma 잔액 서비스에서 Blaze Wallet이 읽을 수 없는 데이터를 받았습니다.",
 "Charisma's price feed sent something Blaze Wallet can't read.": "Charisma 가격 피드에서 Blaze Wallet이 읽을 수 없는 데이터를 받았습니다.",
 "Charisma's token list has no asset name for %@, so it can't be sent safely.": "Charisma 토큰 목록에 %@의 자산 이름이 없어 안전하게 보낼 수 없습니다.",
 "Charisma's token list is unavailable, so tokens can't be checked against its block list.": "Charisma 토큰 목록을 사용할 수 없어 토큰을 차단 목록과 대조할 수 없습니다.",
 "Charisma's token list sent something Blaze Wallet can't read.": "Charisma 토큰 목록에서 Blaze Wallet이 읽을 수 없는 데이터를 받았습니다.",
 "Check again": "다시 확인",
 "Checked at %@": "%@에 확인됨",
 "Checking": "확인 중",
 "Checking…": "확인 중…",
 "Confirm and save": "확인 후 저장",
 "Confirm your words": "단어 확인",
 "Continue": "계속",
 "Copied": "복사됨",
 "Copy": "복사",
 "Couldn't load Charisma's token list (%lld).": "Charisma 토큰 목록을 불러오지 못했습니다(%lld).",
 "Couldn't load balances (%lld).": "잔액을 불러오지 못했습니다(%lld).",
 "Couldn't load prices (%lld).": "가격을 불러오지 못했습니다(%lld).",
 "Couldn't reach Charisma's balance service. Check your connection.": "Charisma 잔액 서비스에 연결하지 못했습니다. 인터넷 연결을 확인하세요.",
 "Couldn't reach Charisma's price feed. Check your connection.": "Charisma 가격 피드에 연결하지 못했습니다. 인터넷 연결을 확인하세요.",
 "Couldn't reach Charisma's token list. Check your connection.": "Charisma 토큰 목록에 연결하지 못했습니다. 인터넷 연결을 확인하세요.",
 "Couldn't reach the Stacks network. Check your connection.": "Stacks 네트워크에 연결하지 못했습니다. 인터넷 연결을 확인하세요.",
 "Create a new wallet": "새 지갑 만들기",
 "Create your wallet": "지갑 만들기",
 "Dark · RPG": "다크 · RPG",
 "Done": "완료",
 "Enter a Stacks address (SP…).": "Stacks 주소(SP…)를 입력하세요.",
 "Enter an amount like %@.": "수량을 %@처럼 입력하세요.",
 "Error": "오류",
 "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.": "모든 시드 문구와 계정이 이 iPhone에서 제거됩니다. 자금은 블록체인에 안전하게 남아 있으며, 다시 접근하려면 시드 문구가 필요합니다.",
 "Exactly this amount, nothing else": "정확히 이 수량만, 그 이상은 없음",
 "Face ID and the passcode aren't available on this iPhone right now.": "지금은 이 iPhone에서 Face ID와 암호를 사용할 수 없습니다.",
 "Generate 24 words": "단어 24개 생성",
 "Generate new": "새로 생성",
 "Holding your funds": "자금 보유 중",
 "I wrote all 24 words down, in order": "단어 24개를 모두 순서대로 적었습니다",
 "Import": "가져오기",
 "Import a seed phrase": "시드 문구 가져오기",
 "In %lld min": {
  "other": "%lld분 후"
 },
 "It confirms on Stacks in a few minutes.": "몇 분 안에 Stacks에서 확정됩니다.",
 "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.": "이 시드 문구의 계정과 자금은 블록체인에 안전하게 남아 있습니다. 여기서 다시 사용하려면 시드 문구의 단어가 필요합니다.",
 "Keys": "키",
 "Light · Bitcoin": "라이트 · Bitcoin",
 "Live": "정상",
 "Loading balances…": "잔액 불러오는 중…",
 "Lock": "잠금",
 "Max": "최대",
 "My seed phrase": "내 시드 문구",
 "Name": "이름",
 "Network fee": "네트워크 수수료",
 "New seed phrase": "새 시드 문구",
 "No active account": "사용 중인 계정 없음",
 "No funds on any of the %lld subnets.": {
  "other": "서브넷 %lld개 중 어디에도 자금이 없습니다."
 },
 "Not enough STX for the network fee. You can send up to %@ STX.": "네트워크 수수료를 낼 STX가 부족합니다. 최대 %@ STX까지 보낼 수 있습니다.",
 "Not enough STX for the network fee: it's %@ STX and you have %@ STX.": "네트워크 수수료를 낼 STX가 부족합니다. 수수료는 %1$@ STX이고 잔액은 %2$@ STX입니다.",
 "Not on Charisma's token list, so it can't be sent from here.": "Charisma 토큰 목록에 없어 여기서 보낼 수 없습니다.",
 "OK": "확인",
 "On this iPhone only, behind Face ID": "이 iPhone에만, Face ID로 보호",
 "Prices unavailable: %@": "가격 정보를 사용할 수 없음: %@",
 "Receive": "받기",
 "Recipient": "받는 사람",
 "Response": "응답 시간",
 "Review": "검토",
 "Safety": "안전",
 "Seed phrases": "시드 문구",
 "Send": "보내기",
 "Send %@": "%@ 보내기",
 "Send only Stacks (STX) and Stacks tokens to this address.": "이 주소로는 Stacks(STX)와 Stacks 토큰만 보내세요.",
 "Send the most: %@ STX": "최대 %@ STX 보내기",
 "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap.": "보내기에는 일반 잔액(%1$@ %2$@)이 사용됩니다. Blaze에 있는 잔액(%3$@)은 해당 서브넷에 그대로 남습니다. Charisma Swap을 사용해 옮기세요.",
 "Set a passcode on this iPhone to use Blaze Wallet.": "Blaze Wallet을 사용하려면 이 iPhone에 암호를 설정하세요.",
 "Show words": "단어 보기",
 "Show your seed phrase": "시드 문구 보기",
 "Something isn't working": "문제가 있습니다",
 "Something went wrong: %@": "문제가 발생했습니다: %@",
 "Stacks network": "Stacks 네트워크",
 "Status": "상태",
 "System": "시스템",
 "That account is no longer in this wallet.": "해당 계정은 더 이상 이 지갑에 없습니다.",
 "That isn't a valid seed phrase: check each word's spelling and that none are missing.": "유효한 시드 문구가 아닙니다. 각 단어의 철자가 맞는지, 빠진 단어가 없는지 확인하세요.",
 "That seed phrase is no longer in this wallet.": "해당 시드 문구는 더 이상 이 지갑에 없습니다.",
 "That's more than one send can carry. Send it in parts.": "한 번에 보낼 수 있는 수량을 넘습니다. 여러 번에 나눠 보내세요.",
 "That's more than you have.": "잔액보다 많습니다.",
 "The Stacks network didn't answer (%lld).": "Stacks 네트워크가 응답하지 않았습니다(%lld).",
 "The Stacks network sent something Blaze Wallet can't read.": "Stacks 네트워크에서 Blaze Wallet이 읽을 수 없는 데이터를 받았습니다.",
 "The amount must be more than zero.": "수량은 0보다 커야 합니다.",
 "The network rejected the transfer: %@": "네트워크가 전송을 거부했습니다: %@",
 "The wallet is locked. Unlock it to continue.": "지갑이 잠겨 있습니다. 계속하려면 잠금을 해제하세요.",
 "Theme": "테마",
 "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.": "이 24개 단어는 이 지갑을 복구할 수 있는 유일한 방법입니다. 이 단어를 보는 사람은 누구나 자금을 마음대로 움직일 수 있으며, Blaze Wallet은 이 단어를 복구할 수 없습니다.",
 "This iPhone couldn't make random words. Try again.": "이 iPhone에서 무작위 단어를 만들지 못했습니다. 다시 시도하세요.",
 "This iPhone's Keychain refused (%@).": "이 iPhone의 키체인이 요청을 거부했습니다(%@).",
 "This wallet": "이 지갑",
 "To": "받는 사람",
 "Tokens": "토큰",
 "Total value": "총 평가액",
 "Try again": "다시 시도",
 "Type these words from what you wrote down.": "적어 둔 내용을 보고 아래 단어를 입력하세요.",
 "Unlink": "연결 해제",
 "Unlink this seed phrase from this iPhone?": "이 iPhone에서 이 시드 문구를 연결 해제하겠습니까?",
 "Unlink this wallet from this iPhone?": "이 iPhone에서 이 지갑을 연결 해제하겠습니까?",
 "Unlink wallet": "지갑 연결 해제",
 "Unlock": "잠금 해제",
 "Unlock your wallet": "지갑 잠금 해제",
 "Use": "사용",
 "Vault": "보관함",
 "View on explorer": "탐색기에서 보기",
 "Wallet": "지갑",
 "Word #%lld": "단어 #%lld",
 "Word %@ doesn't match. Check what you wrote down.": "일치하지 않는 단어: %@. 적어 둔 내용을 확인하세요.",
 "Write these down": "이 단어를 적어 두세요",
 "You have %@ %@.": "잔액은 %1$@ %2$@입니다.",
 "You have no %@ to send yet.": "아직 보낼 수 있는 %@ 잔액이 없습니다.",
 "Your %@ is all on Blaze. Move it with Charisma Swap.": "%@ 잔액은 모두 Blaze에 있습니다. Charisma Swap을 사용해 옮기세요.",
 "Your keys stay on this iPhone, behind Face ID.": "키는 이 iPhone에 보관되며 Face ID로 보호됩니다.",
 "NSFaceIDUsageDescription": "Blaze Wallet은 Face ID를 사용하여 지갑의 잠금을 해제합니다."
}
```

`/tmp/blaze-translations/zh-Hans.json` (Simplified Chinese):

```json
{
 "%@ on Blaze": "%@ 在 Blaze 上",
 "%@ sent": "%@ 已发送",
 "%@ units": "%@ 个单位",
 "%lld tokens": {
  "other": "%lld 个代币"
 },
 "%lld unlisted · not on Charisma's token list, may be scams": {
  "other": "%lld 个未收录 · 不在 Charisma 代币列表中，可能是诈骗代币"
 },
 "%lld without a price": {
  "other": "%lld 个暂无价格"
 },
 "+ Account": "+ 账户",
 "12 or 24 words": "12 或 24 个单词",
 "A seed phrase named “%@” already exists.": "已存在名为“%@”的助记词。",
 "Account %lld": "账户 %lld",
 "Active": "使用中",
 "Add an account from a seed phrase below.": "请从下方的助记词添加账户。",
 "Address": "地址",
 "After 15 idle minutes": "闲置 15 分钟后",
 "Amount": "数量",
 "An unknown token: shown in its smallest units, and it can't be sent from here.": "未知代币：以最小单位显示，且无法在此发送。",
 "Anyone who sees these words controls your funds. Write them down on paper and keep them private.": "任何看到这些单词的人都能控制你的资金。请把它们抄写在纸上，并妥善保密。",
 "At most %lld decimal places.": {
  "other": "最多 %lld 位小数。"
 },
 "Auto-lock": "自动锁定",
 "Back": "返回",
 "Back to the words": "返回查看单词",
 "Blaze subnets": "Blaze 子网",
 "Block": "区块",
 "Cancel": "取消",
 "Cancelled.": "已取消。",
 "Charisma token list": "Charisma 代币列表",
 "Charisma's balance service sent something Blaze Wallet can't read.": "Charisma 余额服务返回了 Blaze Wallet 无法读取的内容。",
 "Charisma's price feed sent something Blaze Wallet can't read.": "Charisma 价格源返回了 Blaze Wallet 无法读取的内容。",
 "Charisma's token list has no asset name for %@, so it can't be sent safely.": "Charisma 代币列表中没有 %@ 的资产名称，因此无法安全发送。",
 "Charisma's token list is unavailable, so tokens can't be checked against its block list.": "Charisma 代币列表不可用，因此无法对照其屏蔽列表检查代币。",
 "Charisma's token list sent something Blaze Wallet can't read.": "Charisma 代币列表返回了 Blaze Wallet 无法读取的内容。",
 "Check again": "重新检查",
 "Checked at %@": "检查于 %@",
 "Checking": "检查中",
 "Checking…": "正在检查…",
 "Confirm and save": "确认并保存",
 "Confirm your words": "确认单词",
 "Continue": "继续",
 "Copied": "已拷贝",
 "Copy": "拷贝",
 "Couldn't load Charisma's token list (%lld).": "无法加载 Charisma 代币列表（%lld）。",
 "Couldn't load balances (%lld).": "无法加载余额（%lld）。",
 "Couldn't load prices (%lld).": "无法加载价格（%lld）。",
 "Couldn't reach Charisma's balance service. Check your connection.": "无法连接 Charisma 余额服务。请检查网络连接。",
 "Couldn't reach Charisma's price feed. Check your connection.": "无法连接 Charisma 价格源。请检查网络连接。",
 "Couldn't reach Charisma's token list. Check your connection.": "无法访问 Charisma 代币列表。请检查网络连接。",
 "Couldn't reach the Stacks network. Check your connection.": "无法连接 Stacks 网络。请检查网络连接。",
 "Create a new wallet": "创建新钱包",
 "Create your wallet": "创建钱包",
 "Dark · RPG": "深色 · RPG",
 "Done": "完成",
 "Enter a Stacks address (SP…).": "请输入 Stacks 地址（SP…）。",
 "Enter an amount like %@.": "请输入数量，例如 %@。",
 "Error": "出错",
 "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.": "所有助记词和账户都将从此 iPhone 上移除。你的资金仍安全地保存在区块链上；你需要凭助记词才能重新访问。",
 "Exactly this amount, nothing else": "只转出这个数量，不多不少",
 "Face ID and the passcode aren't available on this iPhone right now.": "此 iPhone 上的面容 ID 和密码目前不可用。",
 "Generate 24 words": "生成 24 个单词",
 "Generate new": "生成新助记词",
 "Holding your funds": "存有你资金的子网",
 "I wrote all 24 words down, in order": "我已按顺序抄下全部 24 个单词",
 "Import": "导入",
 "Import a seed phrase": "导入助记词",
 "In %lld min": {
  "other": "%lld 分钟后"
 },
 "It confirms on Stacks in a few minutes.": "交易几分钟内就会在 Stacks 上确认。",
 "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.": "该助记词下的账户和资金仍安全地保存在区块链上。要在此再次使用它们，你需要这组助记词。",
 "Keys": "密钥",
 "Light · Bitcoin": "浅色 · Bitcoin",
 "Live": "在线",
 "Loading balances…": "正在加载余额…",
 "Lock": "锁定",
 "Max": "最大",
 "My seed phrase": "我的助记词",
 "Name": "名称",
 "Network fee": "网络手续费",
 "New seed phrase": "新助记词",
 "No active account": "没有使用中的账户",
 "No funds on any of the %lld subnets.": {
  "other": "%lld 个子网中没有任何资金。"
 },
 "Not enough STX for the network fee. You can send up to %@ STX.": "STX 不足以支付网络手续费。你最多可以发送 %@ STX。",
 "Not enough STX for the network fee: it's %@ STX and you have %@ STX.": "STX 不足以支付网络手续费：手续费为 %1$@ STX，你的余额为 %2$@ STX。",
 "Not on Charisma's token list, so it can't be sent from here.": "不在 Charisma 代币列表中，因此无法在此发送。",
 "OK": "好",
 "On this iPhone only, behind Face ID": "仅在此 iPhone 上，受面容 ID 保护",
 "Prices unavailable: %@": "价格不可用：%@",
 "Receive": "收款",
 "Recipient": "收款人",
 "Response": "响应时间",
 "Review": "核对",
 "Safety": "安全",
 "Seed phrases": "助记词",
 "Send": "发送",
 "Send %@": "发送 %@",
 "Send only Stacks (STX) and Stacks tokens to this address.": "请仅向此地址发送 Stacks（STX）和 Stacks 代币。",
 "Send the most: %@ STX": "发送最大数量：%@ STX",
 "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap.": "发送使用的是你标准余额中的 %1$@ %2$@。你在 Blaze 上的 %3$@ 会留在其子网中；可使用 Charisma Swap 转移。",
 "Set a passcode on this iPhone to use Blaze Wallet.": "请在此 iPhone 上设置密码以使用 Blaze Wallet。",
 "Show words": "显示单词",
 "Show your seed phrase": "显示助记词",
 "Something isn't working": "出现问题",
 "Something went wrong: %@": "出错了：%@",
 "Stacks network": "Stacks 网络",
 "Status": "状态",
 "System": "跟随系统",
 "That account is no longer in this wallet.": "该账户已不在此钱包中。",
 "That isn't a valid seed phrase: check each word's spelling and that none are missing.": "这不是有效的助记词：请检查每个单词的拼写，并确认没有遗漏。",
 "That seed phrase is no longer in this wallet.": "该助记词已不在此钱包中。",
 "That's more than one send can carry. Send it in parts.": "超出了单笔发送的上限。请分几次发送。",
 "That's more than you have.": "超出了你的余额。",
 "The Stacks network didn't answer (%lld).": "Stacks 网络未响应（%lld）。",
 "The Stacks network sent something Blaze Wallet can't read.": "Stacks 网络返回了 Blaze Wallet 无法读取的内容。",
 "The amount must be more than zero.": "数量必须大于零。",
 "The network rejected the transfer: %@": "网络拒绝了这笔转账：%@",
 "The wallet is locked. Unlock it to continue.": "钱包已锁定。请解锁以继续。",
 "Theme": "主题",
 "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.": "这 24 个单词是恢复此钱包的唯一方式。任何看到它们的人都能控制你的资金，而且 Blaze Wallet 无法找回它们。",
 "This iPhone couldn't make random words. Try again.": "此 iPhone 无法生成随机单词。请重试。",
 "This iPhone's Keychain refused (%@).": "此 iPhone 的钥匙串拒绝了请求（%@）。",
 "This wallet": "此钱包",
 "To": "收款人",
 "Tokens": "代币",
 "Total value": "总价值",
 "Try again": "重试",
 "Type these words from what you wrote down.": "请根据你抄下的内容输入这些单词。",
 "Unlink": "取消关联",
 "Unlink this seed phrase from this iPhone?": "要将此助记词与此 iPhone 取消关联吗？",
 "Unlink this wallet from this iPhone?": "要将此钱包与此 iPhone 取消关联吗？",
 "Unlink wallet": "取消关联钱包",
 "Unlock": "解锁",
 "Unlock your wallet": "解锁钱包",
 "Use": "使用",
 "Vault": "保险库",
 "View on explorer": "在区块浏览器中查看",
 "Wallet": "钱包",
 "Word #%lld": "第 %lld 个单词",
 "Word %@ doesn't match. Check what you wrote down.": "单词 %@ 不匹配。请检查你抄下的内容。",
 "Write these down": "抄下这些单词",
 "You have %@ %@.": "你的余额为 %1$@ %2$@。",
 "You have no %@ to send yet.": "你还没有可发送的 %@。",
 "Your %@ is all on Blaze. Move it with Charisma Swap.": "你的 %@ 全部在 Blaze 上。请使用 Charisma Swap 转移。",
 "Your keys stay on this iPhone, behind Face ID.": "你的密钥留在此 iPhone 上，受面容 ID 保护。",
 "NSFaceIDUsageDescription": "Blaze Wallet 使用面容 ID 解锁你的钱包。"
}
```

`/tmp/blaze-translations/es.json` (Spanish):

```json
{
 "%@ on Blaze": "%@ en Blaze",
 "%@ sent": "%@ enviado",
 "%@ units": "%@ unidades",
 "%lld tokens": {
  "one": "%lld token",
  "many": "%lld tokens",
  "other": "%lld tokens"
 },
 "%lld unlisted · not on Charisma's token list, may be scams": {
  "one": "%lld no listado · no está en la lista de tokens de Charisma, puede ser una estafa",
  "many": "%lld no listados · no están en la lista de tokens de Charisma, pueden ser estafas",
  "other": "%lld no listados · no están en la lista de tokens de Charisma, pueden ser estafas"
 },
 "%lld without a price": {
  "one": "%lld sin precio",
  "many": "%lld sin precio",
  "other": "%lld sin precio"
 },
 "+ Account": "+ Cuenta",
 "12 or 24 words": "12 o 24 palabras",
 "A seed phrase named “%@” already exists.": "Ya existe una frase semilla llamada “%@”.",
 "Account %lld": "Cuenta %lld",
 "Active": "Activa",
 "Add an account from a seed phrase below.": "Agrega una cuenta desde una frase semilla de abajo.",
 "Address": "Dirección",
 "After 15 idle minutes": "Tras 15 minutos de inactividad",
 "Amount": "Cantidad",
 "An unknown token: shown in its smallest units, and it can't be sent from here.": "Un token desconocido: se muestra en unidades mínimas y no se puede enviar desde aquí.",
 "Anyone who sees these words controls your funds. Write them down on paper and keep them private.": "Cualquiera que vea estas palabras controla tus fondos. Anótalas en papel y mantenlas en privado.",
 "At most %lld decimal places.": {
  "one": "Como máximo %lld decimal.",
  "many": "Como máximo %lld decimales.",
  "other": "Como máximo %lld decimales."
 },
 "Auto-lock": "Bloqueo automático",
 "Back": "Atrás",
 "Back to the words": "Volver a las palabras",
 "Blaze subnets": "Subredes de Blaze",
 "Block": "Bloque",
 "Cancel": "Cancelar",
 "Cancelled.": "Cancelado.",
 "Charisma token list": "Lista de tokens de Charisma",
 "Charisma's balance service sent something Blaze Wallet can't read.": "El servicio de saldos de Charisma envió algo que Blaze Wallet no puede leer.",
 "Charisma's price feed sent something Blaze Wallet can't read.": "La fuente de precios de Charisma envió algo que Blaze Wallet no puede leer.",
 "Charisma's token list has no asset name for %@, so it can't be sent safely.": "La lista de tokens de Charisma no tiene nombre de activo para %@, así que no se puede enviar de forma segura.",
 "Charisma's token list is unavailable, so tokens can't be checked against its block list.": "La lista de tokens de Charisma no está disponible, así que no se puede verificar si los tokens están en su lista de bloqueo.",
 "Charisma's token list sent something Blaze Wallet can't read.": "La lista de tokens de Charisma envió algo que Blaze Wallet no puede leer.",
 "Check again": "Verificar de nuevo",
 "Checked at %@": "Verificado: %@",
 "Checking": "Verificando",
 "Checking…": "Verificando…",
 "Confirm and save": "Confirmar y guardar",
 "Confirm your words": "Confirma tus palabras",
 "Continue": "Continuar",
 "Copied": "Copiado",
 "Copy": "Copiar",
 "Couldn't load Charisma's token list (%lld).": "No se pudo cargar la lista de tokens de Charisma (%lld).",
 "Couldn't load balances (%lld).": "No se pudieron cargar los saldos (%lld).",
 "Couldn't load prices (%lld).": "No se pudieron cargar los precios (%lld).",
 "Couldn't reach Charisma's balance service. Check your connection.": "No se pudo conectar con el servicio de saldos de Charisma. Revisa tu conexión.",
 "Couldn't reach Charisma's price feed. Check your connection.": "No se pudo conectar con la fuente de precios de Charisma. Revisa tu conexión.",
 "Couldn't reach Charisma's token list. Check your connection.": "No se pudo conectar con la lista de tokens de Charisma. Revisa tu conexión.",
 "Couldn't reach the Stacks network. Check your connection.": "No se pudo conectar con la red de Stacks. Revisa tu conexión.",
 "Create a new wallet": "Crear nueva billetera",
 "Create your wallet": "Crear tu billetera",
 "Dark · RPG": "Oscuro · RPG",
 "Done": "OK",
 "Enter a Stacks address (SP…).": "Ingresa una dirección de Stacks (SP…).",
 "Enter an amount like %@.": "Ingresa una cantidad como %@.",
 "Error": "Error",
 "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.": "Se eliminarán todas las frases semilla y cuentas de este iPhone. Tus fondos siguen seguros en la blockchain; necesitarás tus frases semilla para volver a entrar.",
 "Exactly this amount, nothing else": "Exactamente esta cantidad, nada más",
 "Face ID and the passcode aren't available on this iPhone right now.": "Face ID y el código no están disponibles en este iPhone ahora mismo.",
 "Generate 24 words": "Generar 24 palabras",
 "Generate new": "Generar nueva",
 "Holding your funds": "Con tus fondos",
 "I wrote all 24 words down, in order": "Anoté las 24 palabras, en orden",
 "Import": "Importar",
 "Import a seed phrase": "Importar frase semilla",
 "In %lld min": {
  "one": "En %lld min",
  "many": "En %lld min",
  "other": "En %lld min"
 },
 "It confirms on Stacks in a few minutes.": "Se confirmará en Stacks en unos minutos.",
 "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.": "Sus cuentas y fondos siguen seguros en la blockchain. Para volver a usarlos aquí, necesitarás las palabras de la frase semilla.",
 "Keys": "Claves",
 "Light · Bitcoin": "Claro · Bitcoin",
 "Live": "En línea",
 "Loading balances…": "Cargando saldos…",
 "Lock": "Bloquear",
 "Max": "Máx.",
 "My seed phrase": "Mi frase semilla",
 "Name": "Nombre",
 "Network fee": "Comisión de red",
 "New seed phrase": "Nueva frase semilla",
 "No active account": "Ninguna cuenta activa",
 "No funds on any of the %lld subnets.": {
  "one": "No hay fondos en %lld subred.",
  "many": "No hay fondos en ninguna de las %lld subredes.",
  "other": "No hay fondos en ninguna de las %lld subredes."
 },
 "Not enough STX for the network fee. You can send up to %@ STX.": "No tienes suficientes STX para la comisión de red. Puedes enviar hasta %@ STX.",
 "Not enough STX for the network fee: it's %@ STX and you have %@ STX.": "No tienes suficientes STX para la comisión de red: cuesta %@ STX y tienes %@ STX.",
 "Not on Charisma's token list, so it can't be sent from here.": "No está en la lista de tokens de Charisma, así que no se puede enviar desde aquí.",
 "OK": "OK",
 "On this iPhone only, behind Face ID": "Solo en este iPhone, protegidas con Face ID",
 "Prices unavailable: %@": "Precios no disponibles: %@",
 "Receive": "Recibir",
 "Recipient": "Destinatario",
 "Response": "Respuesta",
 "Review": "Revisar",
 "Safety": "Seguridad",
 "Seed phrases": "Frases semilla",
 "Send": "Enviar",
 "Send %@": "Enviar %@",
 "Send only Stacks (STX) and Stacks tokens to this address.": "Envía solo Stacks (STX) y tokens de Stacks a esta dirección.",
 "Send the most: %@ STX": "Enviar el máximo: %@ STX",
 "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap.": "Los envíos usan tu saldo Estándar de %@ %@. Tu saldo de %@ en Blaze se queda en su subred; muévelo con Charisma Swap.",
 "Set a passcode on this iPhone to use Blaze Wallet.": "Configura un código en este iPhone para usar Blaze Wallet.",
 "Show words": "Ver palabras",
 "Show your seed phrase": "Mostrar tu frase semilla",
 "Something isn't working": "Algo no funciona",
 "Something went wrong: %@": "Algo salió mal: %@",
 "Stacks network": "Red de Stacks",
 "Status": "Estado",
 "System": "Sistema",
 "That account is no longer in this wallet.": "Esa cuenta ya no está en esta billetera.",
 "That isn't a valid seed phrase: check each word's spelling and that none are missing.": "Esa no es una frase semilla válida: revisa la ortografía de cada palabra y que no falte ninguna.",
 "That seed phrase is no longer in this wallet.": "Esa frase semilla ya no está en esta billetera.",
 "That's more than one send can carry. Send it in parts.": "Es más de lo que cabe en un solo envío. Envíalo en partes.",
 "That's more than you have.": "Es más de lo que tienes.",
 "The Stacks network didn't answer (%lld).": "La red de Stacks no respondió (%lld).",
 "The Stacks network sent something Blaze Wallet can't read.": "La red de Stacks envió algo que Blaze Wallet no puede leer.",
 "The amount must be more than zero.": "La cantidad debe ser mayor que cero.",
 "The network rejected the transfer: %@": "La red rechazó la transferencia: %@",
 "The wallet is locked. Unlock it to continue.": "La billetera está bloqueada. Desbloquéala para continuar.",
 "Theme": "Tema",
 "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.": "Estas 24 palabras son la única forma de recuperar esta billetera. Cualquiera que las vea controla tus fondos, y Blaze Wallet no puede recuperarlas.",
 "This iPhone couldn't make random words. Try again.": "Este iPhone no pudo generar palabras aleatorias. Inténtalo de nuevo.",
 "This iPhone's Keychain refused (%@).": "El Llavero de este iPhone rechazó la operación (%@).",
 "This wallet": "Esta billetera",
 "To": "Para",
 "Tokens": "Tokens",
 "Total value": "Valor total",
 "Try again": "Reintentar",
 "Type these words from what you wrote down.": "Escribe estas palabras a partir de lo que anotaste.",
 "Unlink": "Desvincular",
 "Unlink this seed phrase from this iPhone?": "¿Desvincular esta frase semilla de este iPhone?",
 "Unlink this wallet from this iPhone?": "¿Desvincular esta billetera de este iPhone?",
 "Unlink wallet": "Desvincular billetera",
 "Unlock": "Desbloquear",
 "Unlock your wallet": "Desbloquear tu billetera",
 "Use": "Usar",
 "Vault": "Bóveda",
 "View on explorer": "Ver en el explorador",
 "Wallet": "Billetera",
 "Word #%lld": "Palabra #%lld",
 "Word %@ doesn't match. Check what you wrote down.": "La palabra %@ no coincide. Revisa lo que anotaste.",
 "Write these down": "Anota estas palabras",
 "You have %@ %@.": "Tienes %@ %@.",
 "You have no %@ to send yet.": "Aún no tienes %@ para enviar.",
 "Your %@ is all on Blaze. Move it with Charisma Swap.": "Todo tu saldo de %@ está en Blaze. Muévelo con Charisma Swap.",
 "Your keys stay on this iPhone, behind Face ID.": "Tus claves se quedan en este iPhone, protegidas con Face ID.",
 "NSFaceIDUsageDescription": "Blaze Wallet usa Face ID para desbloquear tu billetera."
}
```

`/tmp/blaze-translations/fr.json` (French):

```json
{
 "%@ on Blaze": "%@ sur Blaze",
 "%@ sent": "%@ envoyé",
 "%@ units": "%@ unités",
 "%lld tokens": {
  "one": "%lld jeton",
  "many": "%lld jetons",
  "other": "%lld jetons"
 },
 "%lld unlisted · not on Charisma's token list, may be scams": {
  "one": "%lld non listé · absent de la liste de jetons de Charisma, peut-être une arnaque",
  "many": "%lld non listés · absents de la liste de jetons de Charisma, peut-être des arnaques",
  "other": "%lld non listés · absents de la liste de jetons de Charisma, peut-être des arnaques"
 },
 "%lld without a price": {
  "one": "%lld sans prix",
  "many": "%lld sans prix",
  "other": "%lld sans prix"
 },
 "+ Account": "+ Compte",
 "12 or 24 words": "12 ou 24 mots",
 "A seed phrase named “%@” already exists.": "Une phrase de récupération nommée « %@ » existe déjà.",
 "Account %lld": "Compte %lld",
 "Active": "Actif",
 "Add an account from a seed phrase below.": "Ajoutez un compte à partir d’une phrase de récupération ci-dessous.",
 "Address": "Adresse",
 "After 15 idle minutes": "Après 15 min d’inactivité",
 "Amount": "Montant",
 "An unknown token: shown in its smallest units, and it can't be sent from here.": "Jeton inconnu : il est affiché dans sa plus petite unité et ne peut pas être envoyé d’ici.",
 "Anyone who sees these words controls your funds. Write them down on paper and keep them private.": "Toute personne qui voit ces mots a le contrôle de vos fonds. Notez-les sur papier et gardez-les secrets.",
 "At most %lld decimal places.": {
  "one": "Au maximum %lld décimale.",
  "many": "Au maximum %lld décimales.",
  "other": "Au maximum %lld décimales."
 },
 "Auto-lock": "Verrouillage automatique",
 "Back": "Retour",
 "Back to the words": "Revenir aux mots",
 "Blaze subnets": "Sous-réseaux Blaze",
 "Block": "Bloc",
 "Cancel": "Annuler",
 "Cancelled.": "Annulé.",
 "Charisma token list": "Liste de jetons Charisma",
 "Charisma's balance service sent something Blaze Wallet can't read.": "Le service de soldes de Charisma a envoyé des données que Blaze Wallet ne peut pas lire.",
 "Charisma's price feed sent something Blaze Wallet can't read.": "Le flux de prix de Charisma a envoyé des données que Blaze Wallet ne peut pas lire.",
 "Charisma's token list has no asset name for %@, so it can't be sent safely.": "La liste de jetons de Charisma n’a pas de nom d’actif pour %@, ce jeton ne peut donc pas être envoyé en toute sécurité.",
 "Charisma's token list is unavailable, so tokens can't be checked against its block list.": "La liste de jetons de Charisma est indisponible, les jetons ne peuvent donc pas être comparés à sa liste de blocage.",
 "Charisma's token list sent something Blaze Wallet can't read.": "La liste de jetons de Charisma a envoyé des données que Blaze Wallet ne peut pas lire.",
 "Check again": "Vérifier à nouveau",
 "Checked at %@": "Vérifié à %@",
 "Checking": "Vérification",
 "Checking…": "Vérification…",
 "Confirm and save": "Confirmer et enregistrer",
 "Confirm your words": "Confirmez vos mots",
 "Continue": "Continuer",
 "Copied": "Copié",
 "Copy": "Copier",
 "Couldn't load Charisma's token list (%lld).": "Impossible de charger la liste de jetons de Charisma (%lld).",
 "Couldn't load balances (%lld).": "Impossible de charger les soldes (%lld).",
 "Couldn't load prices (%lld).": "Impossible de charger les prix (%lld).",
 "Couldn't reach Charisma's balance service. Check your connection.": "Impossible de joindre le service de soldes de Charisma. Vérifiez votre connexion.",
 "Couldn't reach Charisma's price feed. Check your connection.": "Impossible d’accéder au flux de prix de Charisma. Vérifiez votre connexion.",
 "Couldn't reach Charisma's token list. Check your connection.": "Impossible d’accéder à la liste de jetons de Charisma. Vérifiez votre connexion.",
 "Couldn't reach the Stacks network. Check your connection.": "Impossible de joindre le réseau Stacks. Vérifiez votre connexion.",
 "Create a new wallet": "Créer un nouveau portefeuille",
 "Create your wallet": "Créer votre portefeuille",
 "Dark · RPG": "Sombre · RPG",
 "Done": "OK",
 "Enter a Stacks address (SP…).": "Saisissez une adresse Stacks (SP…).",
 "Enter an amount like %@.": "Saisissez un montant, par exemple %@.",
 "Error": "Erreur",
 "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.": "Toutes les phrases de récupération et tous les comptes seront supprimés de cet iPhone. Vos fonds restent en sécurité sur la blockchain ; pour retrouver l’accès, vous aurez besoin de vos phrases de récupération.",
 "Exactly this amount, nothing else": "Exactement ce montant, rien de plus",
 "Face ID and the passcode aren't available on this iPhone right now.": "Face ID et le code ne sont pas disponibles sur cet iPhone pour le moment.",
 "Generate 24 words": "Générer 24 mots",
 "Generate new": "Générer une nouvelle phrase",
 "Holding your funds": "Détenant vos fonds",
 "I wrote all 24 words down, in order": "J’ai noté les 24 mots, dans l’ordre",
 "Import": "Importer",
 "Import a seed phrase": "Importer une phrase de récupération",
 "In %lld min": {
  "one": "Dans %lld min",
  "many": "Dans %lld min",
  "other": "Dans %lld min"
 },
 "It confirms on Stacks in a few minutes.": "Le transfert sera confirmé sur Stacks dans quelques minutes.",
 "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.": "Ses comptes et ses fonds restent en sécurité sur la blockchain. Pour les utiliser à nouveau ici, vous aurez besoin des mots de la phrase de récupération.",
 "Keys": "Clés",
 "Light · Bitcoin": "Clair · Bitcoin",
 "Live": "En ligne",
 "Loading balances…": "Chargement des soldes…",
 "Lock": "Verrouiller",
 "Max": "Max",
 "My seed phrase": "Ma phrase de récupération",
 "Name": "Nom",
 "Network fee": "Frais de réseau",
 "New seed phrase": "Nouvelle phrase de récupération",
 "No active account": "Aucun compte actif",
 "No funds on any of the %lld subnets.": {
  "one": "Aucun fonds sur %lld sous-réseau.",
  "many": "Aucun fonds sur les %lld sous-réseaux.",
  "other": "Aucun fonds sur les %lld sous-réseaux."
 },
 "Not enough STX for the network fee. You can send up to %@ STX.": "Pas assez de STX pour les frais de réseau. Vous pouvez envoyer jusqu’à %@ STX.",
 "Not enough STX for the network fee: it's %@ STX and you have %@ STX.": "Pas assez de STX pour les frais de réseau : ils s’élèvent à %1$@ STX et vous avez %2$@ STX.",
 "Not on Charisma's token list, so it can't be sent from here.": "Ce jeton ne figure pas sur la liste de jetons de Charisma, il ne peut donc pas être envoyé d’ici.",
 "OK": "OK",
 "On this iPhone only, behind Face ID": "Uniquement sur cet iPhone, protégées par Face ID",
 "Prices unavailable: %@": "Prix indisponibles : %@",
 "Receive": "Recevoir",
 "Recipient": "Destinataire",
 "Response": "Temps de réponse",
 "Review": "Vérifier",
 "Safety": "Sécurité",
 "Seed phrases": "Phrases de récupération",
 "Send": "Envoyer",
 "Send %@": "Envoyer %@",
 "Send only Stacks (STX) and Stacks tokens to this address.": "N’envoyez à cette adresse que des Stacks (STX) et des jetons Stacks.",
 "Send the most: %@ STX": "Envoyer le maximum : %@ STX",
 "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap.": "Les envois utilisent votre solde Standard de %1$@ %2$@. Votre solde de %3$@ sur Blaze reste dans son sous-réseau ; déplacez-le avec Charisma Swap.",
 "Set a passcode on this iPhone to use Blaze Wallet.": "Définissez un code sur cet iPhone pour utiliser Blaze Wallet.",
 "Show words": "Voir les mots",
 "Show your seed phrase": "Afficher votre phrase de récupération",
 "Something isn't working": "Quelque chose ne fonctionne pas",
 "Something went wrong: %@": "Une erreur s’est produite : %@",
 "Stacks network": "Réseau Stacks",
 "Status": "État",
 "System": "Système",
 "That account is no longer in this wallet.": "Ce compte ne fait plus partie de ce portefeuille.",
 "That isn't a valid seed phrase: check each word's spelling and that none are missing.": "Ce n’est pas une phrase de récupération valide : vérifiez l’orthographe de chaque mot et qu’il n’en manque aucun.",
 "That seed phrase is no longer in this wallet.": "Cette phrase de récupération ne fait plus partie de ce portefeuille.",
 "That's more than one send can carry. Send it in parts.": "C’est plus qu’un seul envoi ne peut contenir. Envoyez-le en plusieurs fois.",
 "That's more than you have.": "C’est plus que ce que vous avez.",
 "The Stacks network didn't answer (%lld).": "Le réseau Stacks n’a pas répondu (%lld).",
 "The Stacks network sent something Blaze Wallet can't read.": "Le réseau Stacks a envoyé des données que Blaze Wallet ne peut pas lire.",
 "The amount must be more than zero.": "Le montant doit être supérieur à zéro.",
 "The network rejected the transfer: %@": "Le réseau a refusé le transfert : %@",
 "The wallet is locked. Unlock it to continue.": "Le portefeuille est verrouillé. Déverrouillez-le pour continuer.",
 "Theme": "Thème",
 "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.": "Ces 24 mots sont le seul moyen de récupérer ce portefeuille. Toute personne qui les voit a le contrôle de vos fonds, et Blaze Wallet ne peut pas récupérer ces mots.",
 "This iPhone couldn't make random words. Try again.": "Cet iPhone n’a pas pu générer de mots aléatoires. Réessayez.",
 "This iPhone's Keychain refused (%@).": "Le trousseau de cet iPhone a refusé la demande (%@).",
 "This wallet": "Ce portefeuille",
 "To": "À",
 "Tokens": "Jetons",
 "Total value": "Valeur totale",
 "Try again": "Réessayer",
 "Type these words from what you wrote down.": "Saisissez ces mots d’après ce que vous avez noté.",
 "Unlink": "Dissocier",
 "Unlink this seed phrase from this iPhone?": "Dissocier cette phrase de récupération de cet iPhone ?",
 "Unlink this wallet from this iPhone?": "Dissocier ce portefeuille de cet iPhone ?",
 "Unlink wallet": "Dissocier le portefeuille",
 "Unlock": "Déverrouiller",
 "Unlock your wallet": "Déverrouiller votre portefeuille",
 "Use": "Utiliser",
 "Vault": "Coffre-fort",
 "View on explorer": "Voir dans l’explorateur",
 "Wallet": "Portefeuille",
 "Word #%lld": "Mot #%lld",
 "Word %@ doesn't match. Check what you wrote down.": "Le mot %@ ne correspond pas. Vérifiez ce que vous avez noté.",
 "Write these down": "Notez ces mots",
 "You have %@ %@.": "Vous avez %1$@ %2$@.",
 "You have no %@ to send yet.": "Vous n’avez encore aucun %@ à envoyer.",
 "Your %@ is all on Blaze. Move it with Charisma Swap.": "Votre solde %@ est entièrement sur Blaze. Déplacez-le avec Charisma Swap.",
 "Your keys stay on this iPhone, behind Face ID.": "Vos clés restent sur cet iPhone, protégées par Face ID.",
 "NSFaceIDUsageDescription": "Blaze Wallet utilise Face ID pour déverrouiller votre portefeuille."
}
```

`/tmp/blaze-translations/de.json` (German):

```json
{
 "%@ on Blaze": "%@ auf Blaze",
 "%@ sent": "%@ gesendet",
 "%@ units": "%@ Einheiten",
 "%lld tokens": {
  "one": "%lld Token",
  "other": "%lld Tokens"
 },
 "%lld unlisted · not on Charisma's token list, may be scams": {
  "one": "%lld nicht gelistet · nicht auf der Token-Liste von Charisma, möglicherweise Betrug",
  "other": "%lld nicht gelistet · nicht auf der Token-Liste von Charisma, möglicherweise Betrug"
 },
 "%lld without a price": {
  "one": "%lld ohne Preis",
  "other": "%lld ohne Preis"
 },
 "+ Account": "+ Konto",
 "12 or 24 words": "12 oder 24 Wörter",
 "A seed phrase named “%@” already exists.": "Eine Seed-Phrase mit dem Namen „%@“ gibt es bereits.",
 "Account %lld": "Konto %lld",
 "Active": "Aktiv",
 "Add an account from a seed phrase below.": "Füge unten ein Konto aus einer Seed-Phrase hinzu.",
 "Address": "Adresse",
 "After 15 idle minutes": "Nach 15 Min. Inaktivität",
 "Amount": "Betrag",
 "An unknown token: shown in its smallest units, and it can't be sent from here.": "Ein unbekanntes Token: Es wird in seiner kleinsten Einheit angezeigt und kann hier nicht gesendet werden.",
 "Anyone who sees these words controls your funds. Write them down on paper and keep them private.": "Wer diese Wörter sieht, hat die Kontrolle über dein Guthaben. Notiere sie auf Papier und halte sie geheim.",
 "At most %lld decimal places.": {
  "one": "Höchstens %lld Nachkommastelle.",
  "other": "Höchstens %lld Nachkommastellen."
 },
 "Auto-lock": "Automatische Sperre",
 "Back": "Zurück",
 "Back to the words": "Zurück zu den Wörtern",
 "Blaze subnets": "Blaze-Subnetze",
 "Block": "Block",
 "Cancel": "Abbrechen",
 "Cancelled.": "Abgebrochen.",
 "Charisma token list": "Charisma-Token-Liste",
 "Charisma's balance service sent something Blaze Wallet can't read.": "Der Guthabendienst von Charisma hat Daten gesendet, die Blaze Wallet nicht lesen kann.",
 "Charisma's price feed sent something Blaze Wallet can't read.": "Der Preis-Feed von Charisma hat Daten gesendet, die Blaze Wallet nicht lesen kann.",
 "Charisma's token list has no asset name for %@, so it can't be sent safely.": "Die Token-Liste von Charisma hat keinen Asset-Namen für %@, daher kann dieses Token nicht sicher gesendet werden.",
 "Charisma's token list is unavailable, so tokens can't be checked against its block list.": "Die Token-Liste von Charisma ist nicht verfügbar, daher können Tokens nicht mit der Sperrliste von Charisma abgeglichen werden.",
 "Charisma's token list sent something Blaze Wallet can't read.": "Die Token-Liste von Charisma hat Daten gesendet, die Blaze Wallet nicht lesen kann.",
 "Check again": "Erneut prüfen",
 "Checked at %@": "Geprüft um %@",
 "Checking": "Wird geprüft",
 "Checking…": "Wird geprüft …",
 "Confirm and save": "Bestätigen und sichern",
 "Confirm your words": "Bestätige deine Wörter",
 "Continue": "Weiter",
 "Copied": "Kopiert",
 "Copy": "Kopieren",
 "Couldn't load Charisma's token list (%lld).": "Die Token-Liste von Charisma konnte nicht geladen werden (%lld).",
 "Couldn't load balances (%lld).": "Guthaben konnten nicht geladen werden (%lld).",
 "Couldn't load prices (%lld).": "Preise konnten nicht geladen werden (%lld).",
 "Couldn't reach Charisma's balance service. Check your connection.": "Der Guthabendienst von Charisma ist nicht erreichbar. Prüfe deine Verbindung.",
 "Couldn't reach Charisma's price feed. Check your connection.": "Der Preis-Feed von Charisma ist nicht erreichbar. Prüfe deine Verbindung.",
 "Couldn't reach Charisma's token list. Check your connection.": "Die Token-Liste von Charisma ist nicht erreichbar. Prüfe deine Verbindung.",
 "Couldn't reach the Stacks network. Check your connection.": "Das Stacks-Netzwerk ist nicht erreichbar. Prüfe deine Verbindung.",
 "Create a new wallet": "Neue Wallet erstellen",
 "Create your wallet": "Deine Wallet erstellen",
 "Dark · RPG": "Dunkel · RPG",
 "Done": "Fertig",
 "Enter a Stacks address (SP…).": "Gib eine Stacks-Adresse ein (SP…).",
 "Enter an amount like %@.": "Gib einen Betrag wie %@ ein.",
 "Error": "Fehler",
 "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.": "Alle Seed-Phrasen und Konten werden von diesem iPhone entfernt. Dein Guthaben bleibt sicher auf der Blockchain; um wieder Zugang zu erhalten, brauchst du deine Seed-Phrasen.",
 "Exactly this amount, nothing else": "Genau dieser Betrag, sonst nichts",
 "Face ID and the passcode aren't available on this iPhone right now.": "Face ID und der Code sind auf diesem iPhone gerade nicht verfügbar.",
 "Generate 24 words": "24 Wörter generieren",
 "Generate new": "Neue generieren",
 "Holding your funds": "Mit deinem Guthaben",
 "I wrote all 24 words down, in order": "Ich habe alle 24 Wörter der Reihe nach notiert",
 "Import": "Importieren",
 "Import a seed phrase": "Seed-Phrase importieren",
 "In %lld min": {
  "one": "In %lld Min.",
  "other": "In %lld Min."
 },
 "It confirms on Stacks in a few minutes.": "Die Transaktion wird in wenigen Minuten auf Stacks bestätigt.",
 "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.": "Die Konten und das Guthaben dieser Seed-Phrase bleiben sicher auf der Blockchain. Um sie hier wieder zu verwenden, brauchst du die Wörter der Seed-Phrase.",
 "Keys": "Schlüssel",
 "Light · Bitcoin": "Hell · Bitcoin",
 "Live": "Online",
 "Loading balances…": "Guthaben werden geladen …",
 "Lock": "Sperren",
 "Max": "Max",
 "My seed phrase": "Meine Seed-Phrase",
 "Name": "Name",
 "Network fee": "Netzwerkgebühr",
 "New seed phrase": "Neue Seed-Phrase",
 "No active account": "Kein aktives Konto",
 "No funds on any of the %lld subnets.": {
  "one": "Kein Guthaben auf %lld Subnetz.",
  "other": "Kein Guthaben auf den %lld Subnetzen."
 },
 "Not enough STX for the network fee. You can send up to %@ STX.": "Nicht genug STX für die Netzwerkgebühr. Du kannst bis zu %@ STX senden.",
 "Not enough STX for the network fee: it's %@ STX and you have %@ STX.": "Nicht genug STX für die Netzwerkgebühr von %1$@ STX: Du hast %2$@ STX.",
 "Not on Charisma's token list, so it can't be sent from here.": "Dieses Token ist nicht auf der Token-Liste von Charisma und kann daher hier nicht gesendet werden.",
 "OK": "OK",
 "On this iPhone only, behind Face ID": "Nur auf diesem iPhone, geschützt durch Face ID",
 "Prices unavailable: %@": "Preise nicht verfügbar: %@",
 "Receive": "Empfangen",
 "Recipient": "Empfänger",
 "Response": "Antwortzeit",
 "Review": "Prüfen",
 "Safety": "Sicherheit",
 "Seed phrases": "Seed-Phrasen",
 "Send": "Senden",
 "Send %@": "%@ senden",
 "Send only Stacks (STX) and Stacks tokens to this address.": "Sende an diese Adresse nur Stacks (STX) und Stacks-Tokens.",
 "Send the most: %@ STX": "Maximum senden: %@ STX",
 "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap.": "Beim Senden wird dein Standard-Guthaben von %1$@ %2$@ verwendet. Dein Guthaben von %3$@ auf Blaze bleibt in seinem Subnetz; verschiebe es mit Charisma Swap.",
 "Set a passcode on this iPhone to use Blaze Wallet.": "Lege auf diesem iPhone einen Code fest, um Blaze Wallet zu verwenden.",
 "Show words": "Wörter zeigen",
 "Show your seed phrase": "Deine Seed-Phrase anzeigen",
 "Something isn't working": "Etwas funktioniert nicht",
 "Something went wrong: %@": "Etwas ist schiefgelaufen: %@",
 "Stacks network": "Stacks-Netzwerk",
 "Status": "Status",
 "System": "System",
 "That account is no longer in this wallet.": "Dieses Konto ist nicht mehr in dieser Wallet.",
 "That isn't a valid seed phrase: check each word's spelling and that none are missing.": "Das ist keine gültige Seed-Phrase: Prüfe die Schreibweise jedes Wortes und ob eines fehlt.",
 "That seed phrase is no longer in this wallet.": "Diese Seed-Phrase ist nicht mehr in dieser Wallet.",
 "That's more than one send can carry. Send it in parts.": "Das ist mehr, als auf einmal gesendet werden kann. Sende den Betrag in mehreren Teilen.",
 "That's more than you have.": "Das ist mehr, als du hast.",
 "The Stacks network didn't answer (%lld).": "Das Stacks-Netzwerk hat nicht geantwortet (%lld).",
 "The Stacks network sent something Blaze Wallet can't read.": "Das Stacks-Netzwerk hat Daten gesendet, die Blaze Wallet nicht lesen kann.",
 "The amount must be more than zero.": "Der Betrag muss größer als null sein.",
 "The network rejected the transfer: %@": "Das Netzwerk hat die Transaktion abgelehnt: %@",
 "The wallet is locked. Unlock it to continue.": "Die Wallet ist gesperrt. Entsperre sie, um fortzufahren.",
 "Theme": "Design",
 "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.": "Diese 24 Wörter sind der einzige Weg, diese Wallet wiederherzustellen. Wer sie sieht, hat die Kontrolle über dein Guthaben, und Blaze Wallet kann die Wörter nicht wiederherstellen.",
 "This iPhone couldn't make random words. Try again.": "Dieses iPhone konnte keine zufälligen Wörter erzeugen. Versuche es erneut.",
 "This iPhone's Keychain refused (%@).": "Der Schlüsselbund dieses iPhone hat die Anfrage abgelehnt (%@).",
 "This wallet": "Diese Wallet",
 "To": "An",
 "Tokens": "Tokens",
 "Total value": "Gesamtwert",
 "Try again": "Erneut versuchen",
 "Type these words from what you wrote down.": "Gib diese Wörter so ein, wie du sie notiert hast.",
 "Unlink": "Trennen",
 "Unlink this seed phrase from this iPhone?": "Diese Seed-Phrase von diesem iPhone trennen?",
 "Unlink this wallet from this iPhone?": "Diese Wallet von diesem iPhone trennen?",
 "Unlink wallet": "Wallet trennen",
 "Unlock": "Entsperren",
 "Unlock your wallet": "Deine Wallet entsperren",
 "Use": "Verwenden",
 "Vault": "Tresor",
 "View on explorer": "Im Explorer ansehen",
 "Wallet": "Wallet",
 "Word #%lld": "Wort #%lld",
 "Word %@ doesn't match. Check what you wrote down.": "Wort %@ stimmt nicht überein. Prüfe, was du notiert hast.",
 "Write these down": "Notiere diese Wörter",
 "You have %@ %@.": "Du hast %1$@ %2$@.",
 "You have no %@ to send yet.": "Du hast noch kein %@ zum Senden.",
 "Your %@ is all on Blaze. Move it with Charisma Swap.": "Dein %@ liegt komplett auf Blaze. Verschiebe es mit Charisma Swap.",
 "Your keys stay on this iPhone, behind Face ID.": "Deine Schlüssel bleiben auf diesem iPhone, geschützt durch Face ID.",
 "NSFaceIDUsageDescription": "Blaze Wallet verwendet Face ID, um deine Wallet zu entsperren."
}
```

`/tmp/blaze-translations/tr.json` (Turkish):

```json
{
 "%@ on Blaze": "%@ Blaze'de",
 "%@ sent": "%@ gönderildi",
 "%@ units": "%@ birim",
 "%lld tokens": {
  "one": "%lld token",
  "other": "%lld token"
 },
 "%lld unlisted · not on Charisma's token list, may be scams": {
  "one": "%lld token listede yok · Charisma'nın token listesinde değil, dolandırıcılık olabilir",
  "other": "%lld token listede yok · Charisma'nın token listesinde değil, dolandırıcılık olabilir"
 },
 "%lld without a price": {
  "one": "%lld tanesinin fiyatı yok",
  "other": "%lld tanesinin fiyatı yok"
 },
 "+ Account": "+ Hesap",
 "12 or 24 words": "12 veya 24 kelime",
 "A seed phrase named “%@” already exists.": "“%@” adlı bir kurtarma ifadesi zaten var.",
 "Account %lld": "Hesap %lld",
 "Active": "Etkin",
 "Add an account from a seed phrase below.": "Aşağıdaki bir kurtarma ifadesinden hesap ekleyin.",
 "Address": "Adres",
 "After 15 idle minutes": "15 dakika işlem yapılmadığında",
 "Amount": "Miktar",
 "An unknown token: shown in its smallest units, and it can't be sent from here.": "Bilinmeyen bir token: en küçük birimleriyle gösterilir ve buradan gönderilemez.",
 "Anyone who sees these words controls your funds. Write them down on paper and keep them private.": "Bu kelimeleri gören herkes fonlarınızın kontrolünü ele geçirir. Onları kâğıda yazın ve gizli tutun.",
 "At most %lld decimal places.": {
  "one": "En fazla %lld ondalık basamak.",
  "other": "En fazla %lld ondalık basamak."
 },
 "Auto-lock": "Otomatik kilit",
 "Back": "Geri",
 "Back to the words": "Kelimelere geri dön",
 "Blaze subnets": "Blaze alt ağları",
 "Block": "Blok",
 "Cancel": "Vazgeç",
 "Cancelled.": "İptal edildi.",
 "Charisma token list": "Charisma token listesi",
 "Charisma's balance service sent something Blaze Wallet can't read.": "Charisma'nın bakiye hizmeti, Blaze Wallet tarafından okunamayan bir yanıt gönderdi.",
 "Charisma's price feed sent something Blaze Wallet can't read.": "Charisma'nın fiyat akışı, Blaze Wallet tarafından okunamayan bir yanıt gönderdi.",
 "Charisma's token list has no asset name for %@, so it can't be sent safely.": "Charisma'nın token listesinde %@ için varlık adı yok, bu yüzden güvenle gönderilemez.",
 "Charisma's token list is unavailable, so tokens can't be checked against its block list.": "Charisma'nın token listesi kullanılamıyor, bu yüzden tokenlar engelleme listesine göre kontrol edilemiyor.",
 "Charisma's token list sent something Blaze Wallet can't read.": "Charisma'nın token listesi, Blaze Wallet tarafından okunamayan bir yanıt gönderdi.",
 "Check again": "Tekrar kontrol et",
 "Checked at %@": "Son kontrol: %@",
 "Checking": "Kontrol ediliyor",
 "Checking…": "Kontrol ediliyor…",
 "Confirm and save": "Onayla ve kaydet",
 "Confirm your words": "Kelimelerinizi doğrulayın",
 "Continue": "Devam",
 "Copied": "Kopyalandı",
 "Copy": "Kopyala",
 "Couldn't load Charisma's token list (%lld).": "Charisma'nın token listesi yüklenemedi (%lld).",
 "Couldn't load balances (%lld).": "Bakiyeler yüklenemedi (%lld).",
 "Couldn't load prices (%lld).": "Fiyatlar yüklenemedi (%lld).",
 "Couldn't reach Charisma's balance service. Check your connection.": "Charisma'nın bakiye hizmetine ulaşılamadı. Bağlantınızı kontrol edin.",
 "Couldn't reach Charisma's price feed. Check your connection.": "Charisma'nın fiyat akışına ulaşılamadı. Bağlantınızı kontrol edin.",
 "Couldn't reach Charisma's token list. Check your connection.": "Charisma'nın token listesine ulaşılamadı. Bağlantınızı kontrol edin.",
 "Couldn't reach the Stacks network. Check your connection.": "Stacks ağına ulaşılamadı. Bağlantınızı kontrol edin.",
 "Create a new wallet": "Yeni cüzdan oluştur",
 "Create your wallet": "Cüzdanınızı oluşturmak için",
 "Dark · RPG": "Koyu · RPG",
 "Done": "Bitti",
 "Enter a Stacks address (SP…).": "Bir Stacks adresi girin (SP…).",
 "Enter an amount like %@.": "%@ gibi bir miktar girin.",
 "Error": "Hata",
 "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.": "Tüm kurtarma ifadeleri ve hesaplar bu iPhone'dan kaldırılır. Fonlarınız blok zincirinde güvende kalır; yeniden erişmek için kurtarma ifadelerinize ihtiyacınız olacak.",
 "Exactly this amount, nothing else": "Tam olarak bu miktar, fazlası değil",
 "Face ID and the passcode aren't available on this iPhone right now.": "Face ID ve parola şu anda bu iPhone'da kullanılamıyor.",
 "Generate 24 words": "24 kelime oluştur",
 "Generate new": "Yeni oluştur",
 "Holding your funds": "Fonlarınızı tutan alt ağlar",
 "I wrote all 24 words down, in order": "24 kelimenin tamamını sırasıyla yazdım",
 "Import": "İçe aktar",
 "Import a seed phrase": "Kurtarma ifadesi içe aktar",
 "In %lld min": {
  "one": "%lld dk sonra",
  "other": "%lld dk sonra"
 },
 "It confirms on Stacks in a few minutes.": "Birkaç dakika içinde Stacks ağında onaylanır.",
 "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.": "Bu kurtarma ifadesindeki hesaplar ve fonlar blok zincirinde güvende kalır. Onları burada tekrar kullanmak için kurtarma ifadesinin kelimelerine ihtiyacınız olacak.",
 "Keys": "Anahtarlar",
 "Light · Bitcoin": "Açık · Bitcoin",
 "Live": "Çevrimiçi",
 "Loading balances…": "Bakiyeler yükleniyor…",
 "Lock": "Kilitle",
 "Max": "Maks.",
 "My seed phrase": "Kurtarma ifadem",
 "Name": "Ad",
 "Network fee": "Ağ ücreti",
 "New seed phrase": "Yeni kurtarma ifadesi",
 "No active account": "Etkin hesap yok",
 "No funds on any of the %lld subnets.": {
  "one": "%lld alt ağda hiç fon yok.",
  "other": "%lld alt ağın hiçbirinde fon yok."
 },
 "Not enough STX for the network fee. You can send up to %@ STX.": "Ağ ücreti için yeterli STX yok. En fazla %@ STX gönderebilirsiniz.",
 "Not enough STX for the network fee: it's %@ STX and you have %@ STX.": "Ağ ücreti için yeterli STX yok: ücret %1$@ STX, sizde %2$@ STX var.",
 "Not on Charisma's token list, so it can't be sent from here.": "Charisma'nın token listesinde yok, bu yüzden buradan gönderilemez.",
 "OK": "Tamam",
 "On this iPhone only, behind Face ID": "Yalnızca bu iPhone'da, Face ID korumasıyla",
 "Prices unavailable: %@": "Fiyatlar kullanılamıyor: %@",
 "Receive": "Al",
 "Recipient": "Alıcı",
 "Response": "Yanıt süresi",
 "Review": "İncele",
 "Safety": "Güvenlik",
 "Seed phrases": "Kurtarma ifadeleri",
 "Send": "Gönder",
 "Send %@": "%@ gönder",
 "Send only Stacks (STX) and Stacks tokens to this address.": "Bu adrese yalnızca Stacks (STX) ve Stacks tokenları gönderin.",
 "Send the most: %@ STX": "En fazlasını gönder: %@ STX",
 "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap.": "Gönderirken Standart bakiyenizdeki %1$@ %2$@ kullanılır. Blaze'deki %3$@ kendi alt ağında kalır; Charisma Swap ile taşıyın.",
 "Set a passcode on this iPhone to use Blaze Wallet.": "Blaze Wallet kullanmak için bu iPhone'da bir parola belirleyin.",
 "Show words": "Kelimeleri göster",
 "Show your seed phrase": "Kurtarma ifadenizi göstermek için",
 "Something isn't working": "Bir şeyler çalışmıyor",
 "Something went wrong: %@": "Bir sorun oluştu: %@",
 "Stacks network": "Stacks ağı",
 "Status": "Durum",
 "System": "Sistem",
 "That account is no longer in this wallet.": "O hesap artık bu cüzdanda değil.",
 "That isn't a valid seed phrase: check each word's spelling and that none are missing.": "Bu geçerli bir kurtarma ifadesi değil: her kelimenin yazımını ve eksik kelime olmadığını kontrol edin.",
 "That seed phrase is no longer in this wallet.": "O kurtarma ifadesi artık bu cüzdanda değil.",
 "That's more than one send can carry. Send it in parts.": "Bu, tek seferde gönderilebilecek miktardan fazla. Parçalara bölerek gönderin.",
 "That's more than you have.": "Bu, sahip olduğunuzdan fazla.",
 "The Stacks network didn't answer (%lld).": "Stacks ağı yanıt vermedi (%lld).",
 "The Stacks network sent something Blaze Wallet can't read.": "Stacks ağı, Blaze Wallet tarafından okunamayan bir yanıt gönderdi.",
 "The amount must be more than zero.": "Miktar sıfırdan büyük olmalı.",
 "The network rejected the transfer: %@": "Ağ, transferi reddetti: %@",
 "The wallet is locked. Unlock it to continue.": "Cüzdan kilitli. Devam etmek için kilidini açın.",
 "Theme": "Tema",
 "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.": "Bu 24 kelime, bu cüzdanı kurtarmanın tek yoludur. Onları gören herkes fonlarınızın kontrolünü ele geçirir ve Blaze Wallet onları geri getiremez.",
 "This iPhone couldn't make random words. Try again.": "Bu iPhone rastgele kelime oluşturamadı. Tekrar deneyin.",
 "This iPhone's Keychain refused (%@).": "Bu iPhone'un Anahtar Zinciri isteği reddetti (%@).",
 "This wallet": "Bu cüzdan",
 "To": "Alıcı",
 "Tokens": "Tokenlar",
 "Total value": "Toplam değer",
 "Try again": "Tekrar dene",
 "Type these words from what you wrote down.": "Bu kelimeleri yazdıklarınıza bakarak girin.",
 "Unlink": "Bağlantıyı kaldır",
 "Unlink this seed phrase from this iPhone?": "Bu kurtarma ifadesinin bu iPhone ile bağlantısı kaldırılsın mı?",
 "Unlink this wallet from this iPhone?": "Bu cüzdanın bu iPhone ile bağlantısı kaldırılsın mı?",
 "Unlink wallet": "Cüzdanın bağlantısını kaldır",
 "Unlock": "Kilidi aç",
 "Unlock your wallet": "Cüzdanınızın kilidini açmak için",
 "Use": "Kullan",
 "Vault": "Kasa",
 "View on explorer": "Blok gezgininde görüntüle",
 "Wallet": "Cüzdan",
 "Word #%lld": "%lld. kelime",
 "Word %@ doesn't match. Check what you wrote down.": "Eşleşmeyen kelime: %@. Yazdıklarınızı kontrol edin.",
 "Write these down": "Bunları yazın",
 "You have %@ %@.": "Sizde %1$@ %2$@ var.",
 "You have no %@ to send yet.": "Henüz gönderebileceğiniz %@ yok.",
 "Your %@ is all on Blaze. Move it with Charisma Swap.": "%@ bakiyenizin tamamı Blaze'de. Charisma Swap ile taşıyın.",
 "Your keys stay on this iPhone, behind Face ID.": "Anahtarlarınız Face ID korumasıyla bu iPhone'da kalır.",
 "NSFaceIDUsageDescription": "Blaze Wallet, cüzdanınızın kilidini açmak için Face ID kullanır."
}
```

`/tmp/blaze-translations/ja.json` (Japanese):

```json
{
 "%@ on Blaze": "Blaze 上に %@",
 "%@ sent": "%@ を送金しました",
 "%@ units": "%@ 単位",
 "%lld tokens": {
  "other": "トークン %lld 種類"
 },
 "%lld unlisted · not on Charisma's token list, may be scams": {
  "other": "未掲載 %lld 種類 · Charisma のトークンリストに掲載されておらず、詐欺の可能性があります"
 },
 "%lld without a price": {
  "other": "価格情報なし %lld 種類"
 },
 "+ Account": "+ アカウント",
 "12 or 24 words": "12 単語または 24 単語",
 "A seed phrase named “%@” already exists.": "「%@」という名前のシードフレーズはすでに存在します。",
 "Account %lld": "アカウント %lld",
 "Active": "使用中",
 "Add an account from a seed phrase below.": "下のシードフレーズからアカウントを追加してください。",
 "Address": "アドレス",
 "After 15 idle minutes": "15 分間操作がないとき",
 "Amount": "数量",
 "An unknown token: shown in its smallest units, and it can't be sent from here.": "不明なトークンです。最小単位で表示され、ここからは送金できません。",
 "Anyone who sees these words controls your funds. Write them down on paper and keep them private.": "これらの単語を見た人は誰でも、あなたの資金を自由に動かせます。紙に書き留めて、誰にも知られないように保管してください。",
 "At most %lld decimal places.": {
  "other": "小数点以下は %lld 桁までです。"
 },
 "Auto-lock": "自動ロック",
 "Back": "戻る",
 "Back to the words": "単語に戻る",
 "Blaze subnets": "Blaze サブネット",
 "Block": "ブロック",
 "Cancel": "キャンセル",
 "Cancelled.": "キャンセルされました。",
 "Charisma token list": "Charisma トークンリスト",
 "Charisma's balance service sent something Blaze Wallet can't read.": "Charisma の残高サービスから、Blaze Wallet が読み取れないデータが届きました。",
 "Charisma's price feed sent something Blaze Wallet can't read.": "Charisma の価格フィードから、Blaze Wallet が読み取れないデータが届きました。",
 "Charisma's token list has no asset name for %@, so it can't be sent safely.": "Charisma のトークンリストに %@ のアセット名がないため、安全に送金できません。",
 "Charisma's token list is unavailable, so tokens can't be checked against its block list.": "Charisma のトークンリストを利用できないため、トークンをブロックリストと照合できません。",
 "Charisma's token list sent something Blaze Wallet can't read.": "Charisma のトークンリストから、Blaze Wallet が読み取れないデータが届きました。",
 "Check again": "再確認",
 "Checked at %@": "%@ に確認済み",
 "Checking": "確認中",
 "Checking…": "確認中…",
 "Confirm and save": "確認して保存",
 "Confirm your words": "単語の確認",
 "Continue": "続ける",
 "Copied": "コピー済み",
 "Copy": "コピー",
 "Couldn't load Charisma's token list (%lld).": "Charisma のトークンリストを読み込めませんでした（%lld）。",
 "Couldn't load balances (%lld).": "残高を読み込めませんでした（%lld）。",
 "Couldn't load prices (%lld).": "価格を読み込めませんでした（%lld）。",
 "Couldn't reach Charisma's balance service. Check your connection.": "Charisma の残高サービスに接続できませんでした。インターネット接続を確認してください。",
 "Couldn't reach Charisma's price feed. Check your connection.": "Charisma の価格フィードに接続できませんでした。インターネット接続を確認してください。",
 "Couldn't reach Charisma's token list. Check your connection.": "Charisma のトークンリストに接続できませんでした。インターネット接続を確認してください。",
 "Couldn't reach the Stacks network. Check your connection.": "Stacks ネットワークに接続できませんでした。インターネット接続を確認してください。",
 "Create a new wallet": "新しいウォレットを作成",
 "Create your wallet": "ウォレットを作成",
 "Dark · RPG": "ダーク · RPG",
 "Done": "完了",
 "Enter a Stacks address (SP…).": "Stacks アドレス（SP…）を入力してください。",
 "Enter an amount like %@.": "数量は %@ のように入力してください。",
 "Error": "エラー",
 "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.": "すべてのシードフレーズとアカウントがこの iPhone から削除されます。資金はブロックチェーン上に安全に残りますが、再びアクセスするにはシードフレーズが必要です。",
 "Exactly this amount, nothing else": "この数量だけ、それ以上は送られません",
 "Face ID and the passcode aren't available on this iPhone right now.": "現在、この iPhone では Face ID とパスコードを使用できません。",
 "Generate 24 words": "24 単語を生成",
 "Generate new": "新規作成",
 "Holding your funds": "資金を保有中",
 "I wrote all 24 words down, in order": "24 単語すべてを順番どおりに書き留めました",
 "Import": "インポート",
 "Import a seed phrase": "シードフレーズをインポート",
 "In %lld min": {
  "other": "%lld 分後"
 },
 "It confirms on Stacks in a few minutes.": "Stacks での確定には数分かかります。",
 "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.": "このシードフレーズのアカウントと資金は、ブロックチェーン上に安全に残ります。ここで再び使うには、シードフレーズの単語が必要です。",
 "Keys": "秘密鍵",
 "Light · Bitcoin": "ライト · Bitcoin",
 "Live": "正常",
 "Loading balances…": "残高を読み込み中…",
 "Lock": "ロック",
 "Max": "最大",
 "My seed phrase": "私のシードフレーズ",
 "Name": "名前",
 "Network fee": "ネットワーク手数料",
 "New seed phrase": "新しいシードフレーズ",
 "No active account": "使用中のアカウントなし",
 "No funds on any of the %lld subnets.": {
  "other": "%lld 個のサブネットのいずれにも資金がありません。"
 },
 "Not enough STX for the network fee. You can send up to %@ STX.": "ネットワーク手数料に必要な STX が足りません。最大 %@ STX まで送金できます。",
 "Not enough STX for the network fee: it's %@ STX and you have %@ STX.": "ネットワーク手数料に必要な STX が足りません。手数料は %1$@ STX で、残高は %2$@ STX です。",
 "Not on Charisma's token list, so it can't be sent from here.": "Charisma のトークンリストに掲載されていないため、ここからは送金できません。",
 "OK": "OK",
 "On this iPhone only, behind Face ID": "この iPhone のみ、Face ID で保護",
 "Prices unavailable: %@": "価格情報を利用できません：%@",
 "Receive": "受け取る",
 "Recipient": "受取人",
 "Response": "応答時間",
 "Review": "確認",
 "Safety": "安全",
 "Seed phrases": "シードフレーズ",
 "Send": "送金",
 "Send %@": "%@ を送金",
 "Send only Stacks (STX) and Stacks tokens to this address.": "このアドレスには Stacks（STX）と Stacks トークンのみを送金してください。",
 "Send the most: %@ STX": "最大 %@ STX を送金",
 "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap.": "送金にはスタンダードの %1$@ %2$@ が使われます。Blaze 上の %3$@ はそのサブネットに残ります。Charisma Swap で移動してください。",
 "Set a passcode on this iPhone to use Blaze Wallet.": "Blaze Wallet を使用するには、この iPhone にパスコードを設定してください。",
 "Show words": "単語を表示",
 "Show your seed phrase": "シードフレーズを表示",
 "Something isn't working": "問題が発生しています",
 "Something went wrong: %@": "問題が発生しました：%@",
 "Stacks network": "Stacks ネットワーク",
 "Status": "ステータス",
 "System": "システム",
 "That account is no longer in this wallet.": "そのアカウントはもうこのウォレットにありません。",
 "That isn't a valid seed phrase: check each word's spelling and that none are missing.": "有効なシードフレーズではありません。各単語のつづりと、抜けている単語がないかを確認してください。",
 "That seed phrase is no longer in this wallet.": "そのシードフレーズはもうこのウォレットにありません。",
 "That's more than one send can carry. Send it in parts.": "1 回で送金できる数量を超えています。分けて送金してください。",
 "That's more than you have.": "残高を超えています。",
 "The Stacks network didn't answer (%lld).": "Stacks ネットワークから応答がありませんでした（%lld）。",
 "The Stacks network sent something Blaze Wallet can't read.": "Stacks ネットワークから、Blaze Wallet が読み取れないデータが届きました。",
 "The amount must be more than zero.": "数量は 0 より大きくしてください。",
 "The network rejected the transfer: %@": "ネットワークが送金を拒否しました：%@",
 "The wallet is locked. Unlock it to continue.": "ウォレットはロックされています。続けるにはロックを解除してください。",
 "Theme": "テーマ",
 "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.": "この 24 単語は、このウォレットを復元する唯一の手段です。これらの単語を見た人は誰でも、あなたの資金を自由に動かせます。また、Blaze Wallet はこれらの単語を復元できません。",
 "This iPhone couldn't make random words. Try again.": "この iPhone でランダムな単語を生成できませんでした。もう一度お試しください。",
 "This iPhone's Keychain refused (%@).": "この iPhone のキーチェーンが要求を拒否しました（%@）。",
 "This wallet": "このウォレット",
 "To": "宛先",
 "Tokens": "トークン",
 "Total value": "総額",
 "Try again": "再試行",
 "Type these words from what you wrote down.": "書き留めた内容を見て、次の単語を入力してください。",
 "Unlink": "リンク解除",
 "Unlink this seed phrase from this iPhone?": "この iPhone からこのシードフレーズのリンクを解除しますか？",
 "Unlink this wallet from this iPhone?": "この iPhone からこのウォレットのリンクを解除しますか？",
 "Unlink wallet": "ウォレットのリンクを解除",
 "Unlock": "ロック解除",
 "Unlock your wallet": "ウォレットのロックを解除",
 "Use": "使用",
 "Vault": "保管庫",
 "View on explorer": "エクスプローラーで表示",
 "Wallet": "ウォレット",
 "Word #%lld": "単語 #%lld",
 "Word %@ doesn't match. Check what you wrote down.": "単語 %@ が一致しません。書き留めた内容を確認してください。",
 "Write these down": "単語を書き留めてください",
 "You have %@ %@.": "残高は %1$@ %2$@ です。",
 "You have no %@ to send yet.": "送金できる %@ はまだありません。",
 "Your %@ is all on Blaze. Move it with Charisma Swap.": "%@ はすべて Blaze 上にあります。Charisma Swap で移動してください。",
 "Your keys stay on this iPhone, behind Face ID.": "秘密鍵はこの iPhone に保管され、Face ID で保護されます。",
 "NSFaceIDUsageDescription": "Blaze Wallet は Face ID を使用してウォレットのロックを解除します。"
}
```

`/tmp/blaze-translations/pt-BR.json` (Brazilian Portuguese):

```json
{
 "%@ on Blaze": "%@ no Blaze",
 "%@ sent": "%@ enviado",
 "%@ units": "%@ unidades",
 "%lld tokens": {
  "one": "%lld token",
  "many": "%lld tokens",
  "other": "%lld tokens"
 },
 "%lld unlisted · not on Charisma's token list, may be scams": {
  "one": "%lld não listado · não está na lista de tokens da Charisma, pode ser um golpe",
  "many": "%lld não listados · não estão na lista de tokens da Charisma, podem ser golpes",
  "other": "%lld não listados · não estão na lista de tokens da Charisma, podem ser golpes"
 },
 "%lld without a price": {
  "one": "%lld sem preço",
  "many": "%lld sem preço",
  "other": "%lld sem preço"
 },
 "+ Account": "+ Conta",
 "12 or 24 words": "12 ou 24 palavras",
 "A seed phrase named “%@” already exists.": "Já existe uma frase de recuperação chamada “%@”.",
 "Account %lld": "Conta %lld",
 "Active": "Ativa",
 "Add an account from a seed phrase below.": "Adicione uma conta a partir de uma frase de recuperação abaixo.",
 "Address": "Endereço",
 "After 15 idle minutes": "Após 15 minutos de inatividade",
 "Amount": "Quantidade",
 "An unknown token: shown in its smallest units, and it can't be sent from here.": "Um token desconhecido: aparece em unidades mínimas e não pode ser enviado daqui.",
 "Anyone who sees these words controls your funds. Write them down on paper and keep them private.": "Qualquer pessoa que veja estas palavras controla seus fundos. Anote-as em papel e guarde-as em segredo.",
 "At most %lld decimal places.": {
  "one": "No máximo %lld casa decimal.",
  "many": "No máximo %lld casas decimais.",
  "other": "No máximo %lld casas decimais."
 },
 "Auto-lock": "Bloqueio automático",
 "Back": "Voltar",
 "Back to the words": "Voltar às palavras",
 "Blaze subnets": "Sub-redes do Blaze",
 "Block": "Bloco",
 "Cancel": "Cancelar",
 "Cancelled.": "Cancelado.",
 "Charisma token list": "Lista de tokens da Charisma",
 "Charisma's balance service sent something Blaze Wallet can't read.": "O serviço de saldos da Charisma enviou algo que a Blaze Wallet não consegue ler.",
 "Charisma's price feed sent something Blaze Wallet can't read.": "A fonte de preços da Charisma enviou algo que a Blaze Wallet não consegue ler.",
 "Charisma's token list has no asset name for %@, so it can't be sent safely.": "A lista de tokens da Charisma não tem nome de ativo para %@, então não pode ser enviado com segurança.",
 "Charisma's token list is unavailable, so tokens can't be checked against its block list.": "A lista de tokens da Charisma está indisponível, então não é possível verificar se os tokens estão na lista de bloqueio dela.",
 "Charisma's token list sent something Blaze Wallet can't read.": "A lista de tokens da Charisma enviou algo que a Blaze Wallet não consegue ler.",
 "Check again": "Verificar novamente",
 "Checked at %@": "Verificado: %@",
 "Checking": "Verificando",
 "Checking…": "Verificando…",
 "Confirm and save": "Confirmar e salvar",
 "Confirm your words": "Confirme suas palavras",
 "Continue": "Continuar",
 "Copied": "Copiado",
 "Copy": "Copiar",
 "Couldn't load Charisma's token list (%lld).": "Não foi possível carregar a lista de tokens da Charisma (%lld).",
 "Couldn't load balances (%lld).": "Não foi possível carregar os saldos (%lld).",
 "Couldn't load prices (%lld).": "Não foi possível carregar os preços (%lld).",
 "Couldn't reach Charisma's balance service. Check your connection.": "Não foi possível conectar ao serviço de saldos da Charisma. Verifique sua conexão.",
 "Couldn't reach Charisma's price feed. Check your connection.": "Não foi possível conectar à fonte de preços da Charisma. Verifique sua conexão.",
 "Couldn't reach Charisma's token list. Check your connection.": "Não foi possível conectar à lista de tokens da Charisma. Verifique sua conexão.",
 "Couldn't reach the Stacks network. Check your connection.": "Não foi possível conectar à rede Stacks. Verifique sua conexão.",
 "Create a new wallet": "Criar nova carteira",
 "Create your wallet": "Criar sua carteira",
 "Dark · RPG": "Escuro · RPG",
 "Done": "OK",
 "Enter a Stacks address (SP…).": "Insira um endereço Stacks (SP…).",
 "Enter an amount like %@.": "Insira uma quantidade como %@.",
 "Error": "Erro",
 "Every seed phrase and account is removed from this iPhone. Your funds stay safe on the blockchain; you'll need your seed phrases to get back in.": "Todas as frases de recuperação e contas serão removidas deste iPhone. Seus fundos continuam seguros na blockchain; você vai precisar das suas frases de recuperação para entrar de novo.",
 "Exactly this amount, nothing else": "Exatamente esta quantidade, nada mais",
 "Face ID and the passcode aren't available on this iPhone right now.": "O Face ID e o código não estão disponíveis neste iPhone no momento.",
 "Generate 24 words": "Gerar 24 palavras",
 "Generate new": "Gerar nova",
 "Holding your funds": "Com seus fundos",
 "I wrote all 24 words down, in order": "Anotei as 24 palavras, em ordem",
 "Import": "Importar",
 "Import a seed phrase": "Importar frase de recuperação",
 "In %lld min": {
  "one": "Em %lld min",
  "many": "Em %lld min",
  "other": "Em %lld min"
 },
 "It confirms on Stacks in a few minutes.": "A confirmação na rede Stacks leva alguns minutos.",
 "Its accounts and funds stay safe on the blockchain. To use them here again, you'll need the seed phrase words.": "As contas e os fundos dela continuam seguros na blockchain. Para usá-los aqui de novo, você vai precisar das palavras da frase de recuperação.",
 "Keys": "Chaves",
 "Light · Bitcoin": "Claro · Bitcoin",
 "Live": "Online",
 "Loading balances…": "Carregando saldos…",
 "Lock": "Bloquear",
 "Max": "Máx.",
 "My seed phrase": "Minha frase de recuperação",
 "Name": "Nome",
 "Network fee": "Taxa de rede",
 "New seed phrase": "Nova frase de recuperação",
 "No active account": "Nenhuma conta ativa",
 "No funds on any of the %lld subnets.": {
  "one": "Sem fundos em %lld sub-rede.",
  "many": "Sem fundos em nenhuma das %lld sub-redes.",
  "other": "Sem fundos em nenhuma das %lld sub-redes."
 },
 "Not enough STX for the network fee. You can send up to %@ STX.": "STX insuficiente para a taxa de rede. Você pode enviar até %@ STX.",
 "Not enough STX for the network fee: it's %@ STX and you have %@ STX.": "STX insuficiente para a taxa de rede: ela custa %@ STX e você tem %@ STX.",
 "Not on Charisma's token list, so it can't be sent from here.": "Não está na lista de tokens da Charisma, então não pode ser enviado daqui.",
 "OK": "OK",
 "On this iPhone only, behind Face ID": "Apenas neste iPhone, protegidas pelo Face ID",
 "Prices unavailable: %@": "Preços indisponíveis: %@",
 "Receive": "Receber",
 "Recipient": "Destinatário",
 "Response": "Resposta",
 "Review": "Revisar",
 "Safety": "Segurança",
 "Seed phrases": "Frases de recuperação",
 "Send": "Enviar",
 "Send %@": "Enviar %@",
 "Send only Stacks (STX) and Stacks tokens to this address.": "Envie apenas Stacks (STX) e tokens da rede Stacks para este endereço.",
 "Send the most: %@ STX": "Enviar o máximo: %@ STX",
 "Sends use your %@ %@ on Standard. Your %@ on Blaze stays in its subnet; move it with Charisma Swap.": "Os envios usam seu saldo Padrão de %@ %@. Seu saldo de %@ no Blaze fica na própria sub-rede; mova-o com Charisma Swap.",
 "Set a passcode on this iPhone to use Blaze Wallet.": "Defina um código neste iPhone para usar a Blaze Wallet.",
 "Show words": "Ver palavras",
 "Show your seed phrase": "Mostrar sua frase de recuperação",
 "Something isn't working": "Algo não está funcionando",
 "Something went wrong: %@": "Algo deu errado: %@",
 "Stacks network": "Rede Stacks",
 "Status": "Status",
 "System": "Sistema",
 "That account is no longer in this wallet.": "Essa conta não está mais nesta carteira.",
 "That isn't a valid seed phrase: check each word's spelling and that none are missing.": "Essa frase de recuperação não é válida: confira a grafia de cada palavra e se não falta nenhuma.",
 "That seed phrase is no longer in this wallet.": "Essa frase de recuperação não está mais nesta carteira.",
 "That's more than one send can carry. Send it in parts.": "É mais do que um único envio pode levar. Envie em partes.",
 "That's more than you have.": "É mais do que você tem.",
 "The Stacks network didn't answer (%lld).": "A rede Stacks não respondeu (%lld).",
 "The Stacks network sent something Blaze Wallet can't read.": "A rede Stacks enviou algo que a Blaze Wallet não consegue ler.",
 "The amount must be more than zero.": "A quantidade deve ser maior que zero.",
 "The network rejected the transfer: %@": "A rede rejeitou a transferência: %@",
 "The wallet is locked. Unlock it to continue.": "A carteira está bloqueada. Desbloqueie-a para continuar.",
 "Theme": "Tema",
 "These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.": "Estas 24 palavras são a única forma de recuperar esta carteira. Qualquer pessoa que as veja controla seus fundos, e a Blaze Wallet não pode recuperá-las.",
 "This iPhone couldn't make random words. Try again.": "Este iPhone não conseguiu gerar palavras aleatórias. Tente novamente.",
 "This iPhone's Keychain refused (%@).": "As Chaves deste iPhone recusaram a operação (%@).",
 "This wallet": "Esta carteira",
 "To": "Para",
 "Tokens": "Tokens",
 "Total value": "Valor total",
 "Try again": "Tentar novamente",
 "Type these words from what you wrote down.": "Digite estas palavras a partir do que você anotou.",
 "Unlink": "Desvincular",
 "Unlink this seed phrase from this iPhone?": "Desvincular esta frase de recuperação deste iPhone?",
 "Unlink this wallet from this iPhone?": "Desvincular esta carteira deste iPhone?",
 "Unlink wallet": "Desvincular carteira",
 "Unlock": "Desbloquear",
 "Unlock your wallet": "Desbloquear sua carteira",
 "Use": "Usar",
 "Vault": "Cofre",
 "View on explorer": "Ver no explorador",
 "Wallet": "Carteira",
 "Word #%lld": "Palavra #%lld",
 "Word %@ doesn't match. Check what you wrote down.": "A palavra %@ não corresponde. Confira o que você anotou.",
 "Write these down": "Anote estas palavras",
 "You have %@ %@.": "Você tem %@ %@.",
 "You have no %@ to send yet.": "Você ainda não tem %@ para enviar.",
 "Your %@ is all on Blaze. Move it with Charisma Swap.": "Todo o seu saldo de %@ está no Blaze. Mova-o com Charisma Swap.",
 "Your keys stay on this iPhone, behind Face ID.": "Suas chaves ficam neste iPhone, protegidas pelo Face ID.",
 "NSFaceIDUsageDescription": "A Blaze Wallet usa o Face ID para desbloquear sua carteira."
}
```

- [ ] **Import them, sync, check**

```bash
node apps/blaze-ios/scripts/import-translations.mjs /tmp/blaze-translations/{ko,zh-Hans,es,fr,de,tr,ja,pt-BR}.json
sh apps/blaze-ios/scripts/sync-strings.sh
node apps/blaze-ios/scripts/check-strings.mjs
rm -rf /tmp/blaze-translations
```

Expected:
- `ko: 141 strings` and so on for each language
- `Synced 140 lines of keys into BlazeWallet/Localizable.xcstrings`
- `All strings are translated into 8 languages`

- [ ] **Commit**

```bash
git add apps/blaze-ios/BlazeWallet/Localizable.xcstrings apps/blaze-ios/BlazeWallet/InfoPlist.xcstrings
git commit -m "feat(blaze-ios): Korean, Chinese, Spanish, French, German, Turkish, Japanese and Portuguese" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: README

- [ ] **Add this section to the end of `apps/blaze-ios/README.md`:**

```markdown
## Languages

The app ships in nine languages, following `docs/superpowers/specs/2026-10-12-blaze-wallet-i18n-design.md`. The words that must match the Chrome extension are in `docs/i18n/wallet-terms.md`.
- **Check:** `node apps/blaze-ios/scripts/check-strings.mjs` checks that every string is in all nine languages, marked translated, with matching format specifiers.
- **Add or change translations:** write one JSON file per language (`ko.json`, `zh-Hans.json`… mapping each English key to its translation, or to `{ one, many, other }`). Then run `node apps/blaze-ios/scripts/import-translations.mjs <files>`, then `sh apps/blaze-ios/scripts/sync-strings.sh`, then the check.
```

- [ ] **Commit**

```bash
git add apps/blaze-ios/README.md
git commit -m "docs(blaze-ios): How the app's languages are checked and updated" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: See it in German and Japanese

- [ ] **Build, then launch on a temporary simulator in German, then Japanese**

```bash
TYPE=$(xcrun simctl list devicetypes | grep -E "iPhone 1[67] Pro \(" | head -1 | sed -E 's/.*\((com\.apple[^)]+)\).*/\1/')
RUNTIME=$(xcrun simctl list runtimes | grep -E "^iOS" | tail -1 | sed -E 's/.* - (com\.apple[^ ]+).*/\1/')
UDID=$(xcrun simctl create BlazeLanguages "$TYPE" "$RUNTIME") && echo "$UDID" > /tmp/blaze-languages-udid && xcrun simctl boot "$UDID"
(cd apps/blaze-ios && xcodegen generate)
xcodebuild -project apps/blaze-ios/BlazeWallet.xcodeproj -scheme BlazeWallet -destination "id=$UDID" -derivedDataPath /tmp/blaze-ios-languages -skipPackagePluginValidation build CODE_SIGN_IDENTITY=- 2>&1 | grep -E "BUILD (SUCCEEDED|FAILED)"
ls /tmp/blaze-ios-languages/Build/Products/Debug-iphonesimulator/BlazeWallet.app | grep lproj
xcrun simctl install "$UDID" /tmp/blaze-ios-languages/Build/Products/Debug-iphonesimulator/BlazeWallet.app
for lang in de ja; do xcrun simctl terminate "$UDID" rocks.charisma.blazewallet 2>/dev/null; xcrun simctl launch "$UDID" rocks.charisma.blazewallet -AppleLanguages "($lang)" && sleep 5 && xcrun simctl io "$UDID" screenshot /tmp/blaze-welcome-$lang.png; done
```

Expected:
- `** BUILD SUCCEEDED **`
- nine folders: `de.lproj en.lproj es.lproj fr.lproj ja.lproj ko.lproj pt-BR.lproj tr.lproj zh-Hans.lproj`

- [ ] **Look at both screenshots.**
  - German: "Neue Wallet erstellen" and "Seed-Phrase importieren".
  - Japanese: 新しいウォレットを作成 and シードフレーズをインポート, with "Face ID" kept together on one line.

- [ ] **Delete the simulator:** `UDID=$(cat /tmp/blaze-languages-udid) && xcrun simctl shutdown "$UDID" && xcrun simctl delete "$UDID" && rm /tmp/blaze-languages-udid`

- [ ] **Report to Ross:**
  - the screenshots, with the branch and last commit
  - his manual pass (iOS spec, Testing): walk the app in German (longest text) and Japanese (system fonts), using Xcode's scheme App Language option
