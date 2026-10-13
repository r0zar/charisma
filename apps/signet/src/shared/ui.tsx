/**
 * Small pieces of Charisma's app look (@repo/brand's cx- widgets, as in Swap) shared by the wallet's screens, and
 * amounts in the page's language.
 */
import type { ReactNode } from "react"
import flameIcon from "data-base64:~assets/blaze-flame.svg"
import { describeError } from "~shared/errors"
import { locale } from "~shared/i18n"

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

/** An error, worded; unexpected ones (from a library or a server) lead in with "Something went wrong:" */
export function ErrorText({ error }: { error: Error | null }) {
  return error ? <p className="w-error" role="alert">{describeError(error)}</p> : null
}

/** This language's decimal mark: "." in English, "," in German */
export const decimalMark = new Intl.NumberFormat(locale).formatToParts(1.5).find(part => part.type === "decimal")!.value

/**
 * Smallest units as whole tokens in the page's language, exactly: 1500000 with 6 decimals is "1.5" in English and
 * "1,5" in German. `maxDecimals` cuts (never rounds) the fraction: the token list shows at most 6.
 */
export function formatUnits(raw: bigint, decimals: number, maxDecimals = decimals): string {
  // Instant balances go below zero when signed orders promise more than the wallet holds
  if (raw < 0n) return `-${formatUnits(-raw, decimals, maxDecimals)}`
  const text = raw.toString().padStart(decimals + 1, "0")
  const whole = text.slice(0, text.length - decimals)
  const fraction = text.slice(text.length - decimals).slice(0, maxDecimals).replace(/0+$/, "")
  return `${BigInt(whole).toLocaleString(locale)}${fraction ? `${decimalMark}${fraction}` : ""}`
}

/** The exact amount with this language's decimal mark and no grouping, so parseUnits reads it back (Max) */
export function editableUnits(raw: bigint, decimals: number): string {
  const text = raw.toString().padStart(decimals + 1, "0")
  const fraction = text.slice(text.length - decimals).replace(/0+$/, "")
  return `${text.slice(0, text.length - decimals)}${fraction ? `${decimalMark}${fraction}` : ""}`
}

/** "SP2ZNG…55KS" */
export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
