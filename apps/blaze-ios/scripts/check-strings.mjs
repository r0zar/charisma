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
