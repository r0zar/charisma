/**
 * The sealed approval: a Signet page shown in a frame over the site (or in its own window).
 *
 * The site can't read or click inside it. Approve is held until Chrome's visibility check
 * (IntersectionObserver v2) has seen the whole frame uncovered and unfaded for a full second,
 * so a site can't trick you by laying something over it.
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import NotificationPanel from "~shared/notifications/NotificationPanel"
import { ConnectContent } from "~shared/approvals/ConnectContent"
import { SignMessageContent } from "~shared/approvals/SignMessageContent"
import { CustomIcons } from "~shared/approvals/parts/Icons"
import { colors } from "~shared/styles/theme"
import type { ApprovalRequest } from "~background/lib/provider"
import { SignOrderContent } from "~shared/approvals/SignOrderContent"
import { TransactionContent } from "~shared/approvals/TransactionContent"
import "~shared/styles/style.css"

const [requestId, mode] = location.hash.slice(1).split("&")
const inWindow = mode === "window"
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
      color: colors.neonRed,
      content: <TransactionContent origin={details.origin} address={details.address} method={details.method} params={details.params as Record<string, any>} />
    }
  }
  if (details.method === "stx_signStructuredMessage") {
    const { message, domain } = details.params as { message: string; domain: string }
    return {
      title: "SIGN ORDER",
      approve: "SIGN",
      color: colors.neonOrange,
      content: <SignOrderContent origin={details.origin} address={details.address} message={message} domain={domain} />
    }
  }
  if (details.method === "stx_signMessage") {
    const { message } = details.params as { message: string }
    return {
      title: "SIGN MESSAGE",
      approve: "SIGN",
      color: colors.neonOrange,
      content: <SignMessageContent origin={details.origin} address={details.address} message={message} />
    }
  }
  return {
    title: "CONNECT REQUEST",
    approve: "CONNECT",
    color: colors.cyber,
    content: <ConnectContent origin={details.origin} address={details.address} />
  }
}

async function ask<T>(action: string, extra: object = {}): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type: "signet-approval", action, requestId, ...extra })
  if (!response || response.error) throw new Error(response?.error ?? "Blaze Wallet did not answer")
  return response.result
}

/** True once `target` has been fully visible for SEEN_FOR_MS. In Signet's own window there's nothing to cover it. */
function useProvenVisible(target: React.RefObject<HTMLElement>) {
  const [proven, setProven] = useState(inWindow)
  useEffect(() => {
    if (inWindow || !target.current) return
    let timer: ReturnType<typeof setTimeout>
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer)
      setProven(false)
      if ((entry as IntersectionObserverEntry & { isVisible?: boolean }).isVisible) {
        timer = setTimeout(() => setProven(true), SEEN_FOR_MS)
      }
    }, { threshold: [0], trackVisibility: true, delay: 100 } as IntersectionObserverInit)
    observer.observe(target.current)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [])
  return proven
}

export default function Approve() {
  const frame = useRef<HTMLDivElement>(null)
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stuck, setStuck] = useState(false)
  const [windowId, setWindowId] = useState<number>()
  const visible = useProvenVisible(frame)

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
    <div ref={frame} style={{ position: "fixed", inset: 0, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Transparent over the site; Signet's dark background in its own window */}
      <style>{`html, body { margin: 0; background: ${inWindow ? "#010409" : "transparent"}; }`}</style>
      {!details && error && (
        <div style={{ margin: "20px auto", width: "360px", padding: "12px", background: "#010409", border: `1px solid ${colors.neonRed}`, color: colors.neonRed, fontSize: "12px", borderRadius: "6px" }}>
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
                {error && <div style={{ color: colors.neonRed, fontSize: "11px", marginTop: "8px" }}>{error}</div>}
              </>
            ),
            actions: [
              { id: "reject", label: "DENY", action: "reject", color: colors.neonRed },
              { id: "approve", label: card.approve, action: "approve", color: colors.neonGreen }
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
      style={{ marginTop: "10px", fontSize: "11px", color: colors.cyber, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
    >
      {children}
    </div>
  )
}
