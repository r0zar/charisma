/**
 * HUD kit: the Diagnostics hologram's look for every side panel tab. A framed screen with a status strip,
 * transparent panels with a title bar and hex pattern, dense LABEL: VALUE rows, table rows and bars.
 * Styles live in shared/styles/style.css (.hud-*).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { colors, tint } from "~shared/styles/theme"
import { HexPattern } from "./HexPattern"
import { MemoryBar } from "./MemoryBar"
import { StatusIndicator } from "./StatusIndicator"

export { HexPattern, MemoryBar, StatusIndicator }

/** Brand colors for tinting HUD pieces (the names are the HUD's own: cyan is the brand accent) */
export const HUD = {
  cyan: colors.accent,
  green: colors.success,
  amber: colors.warning,
  red: colors.danger,
  steel: colors.inkMuted,
} as const

export type Tone = keyof typeof HUD

export const hudColor = (tone: Tone, alpha = 0.8) => tint(HUD[tone], alpha)

/** The outer frame, like the hologram: gradient glass, inset glow, and a status strip on top */
export function HudScreen({ title, stats = [], gap = 6, children }: {
  title: string
  stats?: { label: string; value: ReactNode; tone?: Tone }[]
  /** Space between panels, in px */
  gap?: number
  children: ReactNode
}) {
  return (
    <div style={{
      position: "relative",
      border: "1px solid color-mix(in srgb, var(--hud-accent) 30%, transparent)",
      borderRadius: "2px",
      overflow: "hidden",
      background: "linear-gradient(165deg, color-mix(in srgb, var(--surface-raised) 90%, transparent) 0%, color-mix(in srgb, var(--bg) 85%, transparent) 100%)",
      boxShadow: "0 0 20px color-mix(in srgb, #000 calc(80% * var(--shade)), transparent), inset 0 0 8px color-mix(in srgb, var(--hud-accent) calc(50% * var(--glow)), transparent)"
    }}>
      <div style={{
        height: "16px",
        background: "color-mix(in srgb, #000 calc(50% * var(--shade)), transparent)",
        borderBottom: "1px solid color-mix(in srgb, var(--hud-accent) 40%, transparent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        padding: "0 8px",
        fontSize: "8px",
        color: hudColor("cyan"),
        fontFamily: "var(--font-mono)"
      }}>
        <span style={{ textShadow: "0 0 3px color-mix(in srgb, var(--hud-accent) calc(60% * var(--glow)), transparent)" }}>{title}</span>
        <span style={{ display: "flex", gap: "10px" }}>
          {stats.map(stat => (
            <span key={stat.label} style={{ display: "flex", gap: "4px" }}>
              <span style={{ color: "color-mix(in srgb, var(--ink) 60%, transparent)" }}>{stat.label}:</span>
              <span style={{ color: hudColor(stat.tone ?? "cyan") }}>{stat.value}</span>
            </span>
          ))}
        </span>
      </div>
      <div style={{ padding: `${gap}px`, display: "flex", flexDirection: "column", gap: `${gap}px` }}>
        {children}
      </div>
    </div>
  )
}

/** A panel inside a screen, like the hologram's sections: title bar with status dot, hex pattern behind */
export function HudPanel({ title, right, tone = "cyan", pattern = true, gap = 4, children }: {
  title: string
  /** Space between lines inside, in px */
  gap?: number
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
        fontFamily: "var(--font-mono)"
      }}>
        <span>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {right}
          <StatusIndicator color={color} />
        </span>
      </div>
      <div className="hud-text" style={{ position: "relative", padding: `${gap + 2}px 4px ${Math.max(2, gap - 2)}px`, display: "flex", flexDirection: "column", gap: `${gap}px`, fontSize: "9px" }}>
        {children}
      </div>
    </div>
  )
}

/** One LABEL: VALUE line, like STATUS: LIVE in the hologram */
export function HudStat({ label, value, tone = "cyan" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "8px" }}>
      <span style={{ color: "color-mix(in srgb, var(--ink) 60%, transparent)", whiteSpace: "nowrap" }}>{label}:</span>
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
  return <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: hudColor(tone) }}>{">"} {children}</div>
}
