/**
 * The standard Stacks wallet provider, in the page's own JavaScript world.
 *
 * Registers `window.SignetProvider` in `window.wbip_providers` (how @stacks/connect finds wallets) and
 * forwards each `request(method, params)` to the Signet bridge content script. It holds no secrets:
 * the background decides, asks the user through a sealed approval frame, and answers in JSON-RPC.
 */
import type { PlasmoCSConfig } from "plasmo"
/** The official Blaze Wallet flame, shown in a site's "connect wallet" list */
import ICON from "data-base64:~assets/blaze-flame.svg"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  world: "MAIN",
  run_at: "document_start"
}

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
