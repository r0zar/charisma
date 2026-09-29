/**
 * The standard Stacks wallet provider, in the page's own JavaScript world.
 *
 * Registers `window.SignetProvider` in `window.wbip_providers` (how @stacks/connect finds wallets) and
 * forwards each `request(method, params)` to the Signet bridge content script. It holds no secrets:
 * the background decides, asks the user through a sealed approval frame, and answers in JSON-RPC.
 */
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  world: "MAIN",
  run_at: "document_start"
}

const ICON = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#010409"/><path d="M64 16 106 40v48L64 112 22 88V40z" fill="none" stroke="#7DF9FF" stroke-width="6"/><text x="64" y="82" text-anchor="middle" font-family="monospace" font-size="52" font-weight="bold" fill="#7DF9FF">S</text></svg>'
)}`

const provider = {
  isSignet: true,
  request(method: string, params?: unknown) {
    const id = crypto.randomUUID()
    return new Promise(resolve => {
      const onMessage = (event: MessageEvent) => {
        if (event.source !== window || event.data?.source !== "signet-bridge" || event.data.id !== id) return
        window.removeEventListener("message", onMessage)
        resolve(event.data.response)
      }
      window.addEventListener("message", onMessage)
      window.postMessage({ source: "signet-provider", id, method, params }, "*")
    })
  }
}

declare global {
  interface Window {
    SignetProvider?: typeof provider
    wbip_providers?: { id: string; name: string; icon?: string; webUrl?: string }[]
  }
}

window.SignetProvider = provider
window.wbip_providers = [
  ...(window.wbip_providers ?? []),
  { id: "SignetProvider", name: "Signet", icon: ICON, webUrl: "https://github.com/r0zar/signet" }
]
