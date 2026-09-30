/**
 * Package the production build for the Chrome Web Store: the store assigns its own extension ID, so the
 * manifest's dev `key` (which pins the unpacked extension's ID locally) is removed from the upload.
 */
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"

const built = "build/chrome-mv3-prod"
const staged = "build/chrome-store"
const zip = "build/blaze-wallet-chrome.zip"

if (!existsSync(`${built}/manifest.json`)) throw new Error(`No production build at ${built}; run plasmo build first`)

rmSync(staged, { recursive: true, force: true })
rmSync(zip, { force: true })
cpSync(built, staged, { recursive: true })

const manifest = JSON.parse(readFileSync(`${staged}/manifest.json`, "utf8"))
delete manifest.key
writeFileSync(`${staged}/manifest.json`, JSON.stringify(manifest, null, 2))

execFileSync("zip", ["-qr", `../${zip.split("/").pop()}`, "."], { cwd: staged })
console.log(`Store package: ${zip} (version ${manifest.version}, no key)`)
