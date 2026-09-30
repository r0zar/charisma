#!/usr/bin/env node
/**
 * Manage the token block list on the live token cache.
 *
 *   node scripts/blocklist.mjs list
 *   node scripts/blocklist.mjs block   SP….contract-name
 *   node scripts/blocklist.mjs unblock SP….contract-name
 *
 * Blocked tokens drop off the token list, so Charisma apps and Blaze Wallet hide them.
 * Reads TOKEN_CACHE_ADMIN_KEY (and optional TOKEN_CACHE_URL) from the environment or .env.local.
 */
import { existsSync, readFileSync } from "node:fs"

const env = existsSync(".env.local")
  ? Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").map(line => line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?$/)).filter(Boolean).map(m => [m[1], m[2]]))
  : {}
const BASE = process.env.TOKEN_CACHE_URL ?? env.TOKEN_CACHE_URL ?? "https://tokens.charisma.rocks"
const KEY = process.env.TOKEN_CACHE_ADMIN_KEY ?? env.TOKEN_CACHE_ADMIN_KEY

const [command, contractId] = process.argv.slice(2)
const url = `${BASE}/api/v1/blacklist`

async function call(method, target, body) {
  if (method !== "GET" && !KEY) throw new Error("TOKEN_CACHE_ADMIN_KEY is not set (env or apps/token-cache/.env.local)")
  const res = await fetch(target, {
    method,
    headers: { "Content-Type": "application/json", ...(KEY && { Authorization: `Bearer ${KEY}` }) },
    body: body && JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.success === false) throw new Error(`${method} ${target} failed (${res.status}): ${data.error ?? data.message}`)
  return data
}

if (command === "list") {
  const { data } = await call("GET", url)
  console.log(data.join("\n") || "(empty)")
} else if ((command === "block" || command === "unblock") && /^S[PM][0-9A-Z]+\.[a-zA-Z][\w-]*$/.test(contractId ?? "")) {
  const data = command === "block"
    ? await call("POST", url, { contractId })
    : await call("DELETE", `${url}?contractId=${encodeURIComponent(contractId)}`)
  console.log(data.message ?? data)
} else {
  console.error("Usage: node scripts/blocklist.mjs list | block <contractId> | unblock <contractId>")
  process.exit(1)
}
