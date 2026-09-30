/**
 * Real Diagnostics data for the header, footer and hologram, loaded from the background. Each check is about
 * 20 Hiro reads, so it refreshes every 5 minutes and only while the side panel is visible (Hiro rate-limits).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { sendMessage } from "~shared/context/utils"
import type { Diagnostics } from "~background/lib/diagnostics"

const REFRESH_MS = 5 * 60_000

interface DiagnosticsState {
  diag: Diagnostics | null
  error: string | null
  loading: boolean
  refresh: () => void
}

const DiagnosticsContext = createContext<DiagnosticsState | null>(null)

export function DiagnosticsProvider({ children }: { children: ReactNode }) {
  const [diag, setDiag] = useState<Diagnostics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = () => {
    setLoading(true)
    sendMessage<Diagnostics>("getDiagnostics")
      .then(next => { setDiag(next); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  return <DiagnosticsContext.Provider value={{ diag, error, loading, refresh }}>{children}</DiagnosticsContext.Provider>
}

export function useDiagnostics() {
  const context = useContext(DiagnosticsContext)
  if (!context) throw new Error("useDiagnostics must be used within a DiagnosticsProvider")
  return context
}
