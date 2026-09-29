/**
 * HUD kit: the Diagnostics hologram's look for every side panel tab. A framed screen with a status strip,
 * transparent panels with a title bar and hex pattern, dense LABEL: VALUE rows, table rows and bars.
 * Styles live in shared/styles/style.css (.hud-*).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { HexPattern } from "./HexPattern"
import { MemoryBar } from "./MemoryBar"
import { StatusIndicator } from "./StatusIndicator"

export { HexPattern, MemoryBar, StatusIndicator }

/** "r, g, b" triples for tinting HUD pieces */
export const HUD = {
  cyan: "125, 249, 255",
  green: "54, 199, 88",
  amber: "255, 204, 0",
  red: "255, 78, 78",
  steel: "140, 156, 168",
} as const

export type Tone = keyof typeof HUD

export const hudColor = (tone: Tone, alpha = 0.8) => `rgba(${HUD[tone]}, ${alpha})`

/** The outer frame, like the hologram: gradient glass, inset glow, and a status strip on top */
export function HudScreen({ title, stats = [], children }: {
  title: string
  stats?: { label: string; value: ReactNode; tone?: Tone }[]
  children: ReactNode
}) {
  return (
    <div style={{
      position: "relative",
      border: "1px solid rgba(125, 249, 255, 0.3)",
      borderRadius: "2px",
      overflow: "hidden",
      background: "linear-gradient(165deg, rgba(20, 30, 40, 0.9) 0%, rgba(8, 12, 18, 0.85) 100%)",
      boxShadow: "0 0 20px rgba(0, 0, 0, 0.8), inset 0 0 8px rgba(125, 249, 255, 0.5)"
    }}>
      <div style={{
        height: "16px",
        background: "rgba(0, 0, 0, 0.5)",
        borderBottom: "1px solid rgba(125, 249, 255, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        padding: "0 8px",
        fontSize: "8px",
        color: hudColor("cyan"),
        fontFamily: "monospace"
      }}>
        <span style={{ textShadow: "0 0 3px rgba(125, 249, 255, 0.6)" }}>{title}</span>
        <span style={{ display: "flex", gap: "10px" }}>
          {stats.map(stat => (
            <span key={stat.label} style={{ display: "flex", gap: "4px" }}>
              <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>{stat.label}:</span>
              <span style={{ color: hudColor(stat.tone ?? "cyan") }}>{stat.value}</span>
            </span>
          ))}
        </span>
      </div>
      <div style={{ padding: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {children}
      </div>
    </div>
  )
}

/** A panel inside a screen, like the hologram's sections: title bar with status dot, hex pattern behind */
export function HudPanel({ title, right, tone = "cyan", pattern = true, children }: {
  title: string
  /** Shown at the right of the title bar, before the status dot */
  right?: ReactNode
  tone?: Tone
  pattern?: boolean
  children: ReactNode
}) {
  const color = hudColor(tone)
  return (
    <div style={{
      position: "relative",
      border: `1px solid ${color}`,
      borderRadius: "2px",
      padding: "4px",
      overflow: "hidden",
      backdropFilter: "blur(2px)"
    }}>
      {pattern && <HexPattern color={color} />}
      <div style={{
        position: "relative",
        borderBottom: `1px solid ${color}`,
        fontSize: "8px",
        fontWeight: "bold",
        color,
        padding: "2px 4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
        fontFamily: "monospace"
      }}>
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {right}
          <StatusIndicator color={color} />
        </span>
      </div>
      <div className="hud-text" style={{ position: "relative", padding: "6px 4px 2px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "9px" }}>
        {children}
      </div>
    </div>
  )
}

/** One LABEL: VALUE line, like STATUS: LIVE in the hologram */
export function HudStat({ label, value, tone = "cyan" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontFamily: "monospace", fontSize: "8px" }}>
      <span style={{ color: "rgba(255, 255, 255, 0.6)", whiteSpace: "nowrap" }}>{label}:</span>
      <span style={{ color: hudColor(tone), fontWeight: "bold", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  )
}

/** A small HUD button, tinted by tone */
export function HudButton({ tone = "cyan", grow = false, style, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; grow?: boolean }) {
  return (
    <button
      type="button"
      className="hud-btn"
      style={{ ["--hud-c" as string]: HUD[tone], flex: grow ? 1 : undefined, ...style }}
      {...props}
    />
  )
}

/** Small uppercase label above a value or field */
export function HudLabel({ children }: { children: ReactNode }) {
  return <span className="hud-label">{children}</span>
}

/** A console-style line: "> message" */
export function HudLine({ children, tone = "cyan" }: { children: ReactNode; tone?: Tone }) {
  return <div style={{ fontFamily: "monospace", fontSize: "8px", color: hudColor(tone) }}>{">"} {children}</div>
}
