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

/** The Blaze flame (store-assets/icon.svg), shown in a site's "connect wallet" list */
const ICON = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a45"/><stop offset=".45" stop-color="#ec3d03"/><stop offset="1" stop-color="#c1121f"/></linearGradient></defs><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="url(#g)" transform="translate(-14.32 -17.58) scale(6.5263)"/></svg>'
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
  { id: "SignetProvider", name: "Blaze Wallet", icon: ICON, webUrl: "https://charisma.rocks" }
]
