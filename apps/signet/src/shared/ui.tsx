/**
 * Small pieces of Charisma's app look (@repo/brand's cx- widgets, as in Swap) shared by the wallet's screens.
 */
import type { ReactNode } from "react"
import flameIcon from "data-base64:~assets/blaze-flame.svg"

/** A card with an optional title row */
export function Card({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="cx-card">
      {(title || right) && (
        <div className="w-card-head">
          {title && <h2>{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

/** The official Blaze Wallet flame: the same art as the toolbar icon */
export function BlazeFlame({ size }: { size: number }) {
  return <img src={flameIcon} width={size} height={size} alt="" style={{ display: "block", flex: "none" }} />
}

/** One label and value line; values read as numbers (mono) unless `text` */
export function Kv({ label, children, tone, text }: { label: string; children: ReactNode; tone?: "success" | "warning" | "danger"; text?: boolean }) {
  return (
    <div className={text ? "cx-kv w-kv-text" : "cx-kv"}>
      <span>{label}</span>
      <span style={tone ? { color: `var(--${tone})` } : undefined}>{children}</span>
    </div>
  )
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="w-error" role="alert">{error}</p> : null
}

/** "SP2ZNG…55KS" */
export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
