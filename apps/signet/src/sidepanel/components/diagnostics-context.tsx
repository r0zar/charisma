/**
 * Real Diagnostics data for the hologram, loaded from the background and refreshed every minute (about 20 Hiro reads each).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { sendMessage } from "~shared/context/utils"
import type { Diagnostics } from "~background/lib/diagnostics"

const REFRESH_MS = 60_000

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
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  return <DiagnosticsContext.Provider value={{ diag, error, loading, refresh }}>{children}</DiagnosticsContext.Provider>
}

export function useDiagnostics() {
  const context = useContext(DiagnosticsContext)
  if (!context) throw new Error("useDiagnostics must be used within a DiagnosticsProvider")
  return context
}
