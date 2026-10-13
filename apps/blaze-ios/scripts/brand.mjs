/**
 * Brand assets for the iOS app, from @repo/brand (packages/brand): every colour token in both themes, the fonts and
 * the Blaze flame, written into BlazeWallet/Brand. The output is committed; re-run when packages/brand changes:
 *   node apps/blaze-ios/scripts/brand.mjs
 * The app icon is drawn separately by scripts/app-icon.swift.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const app = join(dirname(fileURLToPath(import.meta.url)), "..")
const repo = join(app, "../..")
const brand = join(repo, "packages/brand")
const out = join(app, "BlazeWallet/Brand")
const catalog = join(out, "Brand.xcassets")
const info = { author: "xcode", version: 1 }

function json(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

const tokens = JSON.parse(readFileSync(join(brand, "tokens.json"), "utf8")).color.tokens
const byName = Object.fromEntries(tokens.map(token => [token.name, token.value]))

/** A token's value in one theme, following aliases such as "{accent-soft}" */
function resolve(value, theme, seen = []) {
  const raw = typeof value === "string" ? value : value[theme]
  const alias = /^\{(.+)\}$/.exec(raw)
  if (!alias) return raw
  if (seen.includes(alias[1]) || !(alias[1] in byName)) throw new Error(`Bad colour alias ${raw}`)
  return resolve(byName[alias[1]], theme, [...seen, alias[1]])
}

/** "#rrggbb" or "#rrggbbaa" as an asset catalog colour */
function colour(hex) {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex)
  if (!match) throw new Error(`Not a hex colour: ${hex}`)
  const channel = at => (parseInt(match[1].slice(at, at + 2), 16) / 255).toFixed(3)
  const alpha = (parseInt(match[2] ?? "ff", 16) / 255).toFixed(3)
  return { "color-space": "srgb", components: { red: channel(0), green: channel(2), blue: channel(4), alpha } }
}

json(join(catalog, "Contents.json"), { info })
rmSync(join(catalog, "Colors"), { recursive: true, force: true })
json(join(catalog, "Colors/Contents.json"), { info })
for (const { name, value } of tokens) {
  json(join(catalog, `Colors/${name}.colorset/Contents.json`), {
    colors: [
      { idiom: "universal", color: colour(resolve(value, "light")) },
      { idiom: "universal", appearances: [{ appearance: "luminosity", value: "dark" }], color: colour(resolve(value, "dark")) }
    ],
    info
  })
}

// The Blaze flame, kept as a vector
copyFileSync(join(repo, "apps/signet/src/assets/blaze-flame.svg"), join(mkdirIn(catalog, "BlazeFlame.imageset"), "blaze-flame.svg"))
json(join(catalog, "BlazeFlame.imageset/Contents.json"), {
  images: [{ filename: "blaze-flame.svg", idiom: "universal" }],
  info,
  properties: { "preserves-vector-representation": true }
})

// The app icon's slot: scripts/app-icon.swift draws AppIcon.png into it
json(join(catalog, "AppIcon.appiconset/Contents.json"), {
  images: [{ filename: "AppIcon.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
  info
})

// The fonts, with the open-licence ones' licences. Matter is commercial; Ross confirmed its licence covers the app
// (iOS spec, Decision 2).
const FONTS = [
  "DMMono-Regular.woff2", "DMMono-Medium.woff2", "YsabeauInfant.woff2", "YsabeauInfant-Italic.woff2", "Matter-Regular.woff2",
  "Matter-Medium.woff2", "OFL-DMMono.txt", "OFL-YsabeauInfant.txt"
]
for (const font of FONTS) copyFileSync(join(brand, "fonts", font), join(mkdirIn(out, "Fonts"), font))

function mkdirIn(parent, name) {
  const path = join(parent, name)
  mkdirSync(path, { recursive: true })
  return path
}

console.log(`Wrote ${tokens.length} colours, the flame, the icon slot and ${FONTS.length} font files to ${out}`)
