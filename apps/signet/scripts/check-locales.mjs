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
