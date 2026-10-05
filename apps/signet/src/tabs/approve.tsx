/**
 * The sealed approval: a Signet page shown in a frame over the site (or in its own window).
 *
 * The site can't read or click inside it. Approve is held until Chrome's visibility check
 * (IntersectionObserver v2) has seen the whole card, fully on screen, uncovered and unfaded for a full
 * second, so a site can't trick you by laying something over it or sliding most of it away. Every click
 * while it's held starts that second again, so rapid clicking can't land on Approve the moment it opens.
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import NotificationPanel from "~shared/notifications/NotificationPanel"
import { ConnectContent } from "~shared/approvals/ConnectContent"
import { SignMessageContent } from "~shared/approvals/SignMessageContent"
import { CustomIcons } from "~shared/approvals/parts/Icons"
import type { ApprovalRequest } from "~background/lib/provider"
import { SignOrderContent } from "~shared/approvals/SignOrderContent"
import { SignOrdersContent } from "~shared/approvals/SignOrdersContent"
import { TransactionContent } from "~shared/approvals/TransactionContent"
import "@repo/brand/tokens.css"
import "@repo/brand/fonts.css"
import { applySavedTheme, colors } from "~shared/styles/theme"
import "~shared/styles/style.css"

applySavedTheme()

const [requestId, mode] = location.hash.slice(1).split("&")
// Signet's own window, never a frame: a site that frames this page with "&window" still gets the visibility check
const inWindow = mode === "window" && window.top === window
const SEEN_FOR_MS = 1000
const FALLBACK_AFTER_MS = 4000

interface Details extends ApprovalRequest {
  unlocked: boolean
  address: string | null
}

/** The 3D card for each kind of request: title, approve label, and what's being asked */
function cardFor(details: Details) {
  if (details.method === "stx_transferStx" || details.method === "stx_callContract") {
    return {
      title: details.method === "stx_transferStx" ? "SEND STX" : "RUN TRANSACTION",
      approve: "SEND",
      color: colors.danger,
      content: <TransactionContent origin={details.origin} address={details.address} method={details.method} params={details.params as Record<string, any>} />
    }
  }
  if (details.method === "stx_signStructuredMessage") {
    const { message, domain } = details.params as { message: string; domain: string }
    return {
      title: "SIGN ORDER",
      approve: "SIGN",
      color: colors.warning,
      content: <SignOrderContent origin={details.origin} address={details.address} message={message} domain={domain} />
    }
  }
  if (details.method === "blaze_signStructuredMessages") {
    const { messages } = details.params as { messages: string[] }
    return {
      title: `SIGN ${messages.length.toLocaleString("en-US")} ORDERS`,
      approve: "SIGN ALL",
      color: colors.warning,
      content: <SignOrdersContent origin={details.origin} address={details.address} messages={messages} />
    }
  }
  if (details.method === "stx_signMessage") {
    const { message } = details.params as { message: string }
    return {
      title: "SIGN MESSAGE",
      approve: "SIGN",
      color: colors.warning,
      content: <SignMessageContent origin={details.origin} address={details.address} message={message} />
    }
  }
  return {
    title: "CONNECT REQUEST",
    approve: "CONNECT",
    color: colors.accent,
    content: <ConnectContent origin={details.origin} address={details.address} />
  }
}

async function ask<T>(action: string, extra: object = {}): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type: "signet-approval", action, requestId, ...extra })
  if (!response || response.error) throw new Error(response?.error ?? "Blaze Wallet did not answer")
  return response.result
}

/**
 * True once `target` has been entirely on screen and uncovered for SEEN_FOR_MS, counted from when `ready`
 * (the card is drawn). `restart` starts the count again. In Signet's own window there's nothing to cover it.
 */
function useProvenVisible(target: React.RefObject<HTMLElement>, ready: boolean) {
  const [proven, setProven] = useState(inWindow)
  const [restarts, setRestarts] = useState(0)
  useEffect(() => {
    if (inWindow || !ready || !target.current) return
    let timer: ReturnType<typeof setTimeout>
    setProven(false)
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer)
      setProven(false)
      const visible = (entry as IntersectionObserverEntry & { isVisible?: boolean }).isVisible
      if (visible && entry.intersectionRatio >= 1) timer = setTimeout(() => setProven(true), SEEN_FOR_MS)
    }, { threshold: [1], trackVisibility: true, delay: 100 } as IntersectionObserverInit)
    observer.observe(target.current)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [ready, restarts])
  return { proven, restart: () => setRestarts(n => n + 1) }
}

export default function Approve() {
  const frame = useRef<HTMLDivElement>(null)
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stuck, setStuck] = useState(false)
  const [windowId, setWindowId] = useState<number>()
  const { proven: visible, restart } = useProvenVisible(frame, !!details)

  // Load the request; while the wallet is locked, check again every second
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const load = () => ask<Details>("get")
      .then(next => {
        setDetails(next)
        if (!next.unlocked) timer = setTimeout(load, 1000)
      })
      .catch(err => setError(err.message))
    load()
    chrome.windows.getCurrent().then(w => setWindowId(w.id))
    return () => clearTimeout(timer)
  }, [])

  // Covered for too long: offer Signet's own window
  useEffect(() => {
    if (visible) return setStuck(false)
    const timer = setTimeout(() => setStuck(true), FALLBACK_AFTER_MS)
    return () => clearTimeout(timer)
  }, [visible])

  const decide = (approved: boolean) =>
    ask("decide", { approved })
      .then(() => { if (inWindow) window.close() })
      .catch(err => setError(err.message))

  const card = details && cardFor(details)
  const hold = !details?.unlocked ? "UNLOCK WALLET FIRST" : !visible ? "CHECKING…" : undefined

  return (
    <div ref={frame} onPointerDownCapture={() => { if (!visible) restart() }} style={{ position: "fixed", inset: 0, fontFamily: "var(--font-sans)" }}>
      {/* Transparent over the site; Signet's dark background in its own window */}
      {/* Over the site: transparent, in the color scheme the frame was given (a mismatch would paint it opaque) */}
      <style>{inWindow ? "html, body { margin: 0; background: var(--bg); }" : "html { color-scheme: normal !important; } html, body { margin: 0; background: transparent; }"}</style>
      {!details && error && (
        <div style={{ margin: "20px auto", width: "360px", padding: "12px", background: "var(--bg)", border: `1px solid ${colors.danger}`, color: colors.danger, fontSize: "12px", borderRadius: "6px" }}>
          {error}
        </div>
      )}
      {details && card && (
        <NotificationPanel
          approveHold={hold}
          notification={{
            title: card.title,
            color: card.color,
            customIcon: CustomIcons.checkExtension,
            message: (
              <>
                {card.content}
                {!details.unlocked && (
                  <Note onClick={() => windowId !== undefined && chrome.sidePanel.open({ windowId })}>
                    🔐 Blaze Wallet is locked. Open it to unlock ›
                  </Note>
                )}
                {stuck && !inWindow && (
                  <Note onClick={() => ask("window").catch(err => setError(err.message))}>
                    Something is covering this card. Continue in a Blaze Wallet window ›
                  </Note>
                )}
                {error && <div style={{ color: colors.danger, fontSize: "11px", marginTop: "8px" }}>{error}</div>}
              </>
            ),
            actions: [
              { id: "reject", label: "DENY", action: "reject", color: colors.danger },
              { id: "approve", label: card.approve, action: "approve", color: colors.success }
            ]
          }}
          onDismiss={() => decide(false)}
          onReject={() => decide(false)}
          onApprove={() => decide(true)}
        />
      )}
    </div>
  )
}

function Note({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ marginTop: "10px", fontSize: "11px", color: colors.accent, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
    >
      {children}
    </div>
  )
}
