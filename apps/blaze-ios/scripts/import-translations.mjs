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
