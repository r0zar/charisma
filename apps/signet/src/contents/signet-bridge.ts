/**
 * Bridge between the page's provider and the background, in the extension's isolated world.
 *
 * Forwards provider requests to the background (which learns the real site from Chrome, not from the
 * page), and shows the sealed approval frame when the background asks: an extension-page iframe inside
 * a closed shadow root, so the page can neither read it nor press its buttons.
 */
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

window.addEventListener("message", async (event: MessageEvent) => {
  if (event.source !== window || event.data?.source !== "signet-provider") return
  const { id, method, params } = event.data
  const response = await chrome.runtime.sendMessage({ type: "signet-rpc", id, method, params })
  window.postMessage({ source: "signet-bridge", id, response }, "*")
})

const frames = new Map<string, HTMLElement>()

function showApproval(requestId: string) {
  const host = document.createElement("div")
  const root = host.attachShadow({ mode: "closed" })
  const frame = document.createElement("iframe")
  frame.src = `${chrome.runtime.getURL("tabs/approve.html")}#${requestId}`
  frame.setAttribute("allowtransparency", "true")
  frame.style.cssText = [
    "position:fixed", "top:0", "left:50%", "transform:translateX(-50%)",
    "width:480px", "height:600px", "max-width:100vw", "border:0",
    "background:transparent", "color-scheme:normal", "z-index:2147483647"
  ].join(";")
  root.append(frame)
  document.documentElement.append(host)
  frames.set(requestId, host)
}

function hideApproval(requestId: string) {
  frames.get(requestId)?.remove()
  frames.delete(requestId)
}

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "signet-show-approval") showApproval(message.requestId)
  if (message?.type === "signet-hide-approval") hideApproval(message.requestId)
})
