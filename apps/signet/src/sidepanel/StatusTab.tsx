/**
 * Status: is everything working? The Stacks network, Charisma's token list, every Blaze subnet with this
 * account's balance on it, and the auto-lock timer, from real checks in the background (diagnostics).
 */
import { RefreshCw } from "lucide-react"
import { useDiagnostics } from "./components/diagnostics-context"
import { Card, ErrorText, Kv, short } from "~shared/ui"

/** Smallest units → short readable amount */
const formatUnits = (raw: string, decimals: number) =>
  (Number(raw) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: 4 })

/** Instant is full, 2 seconds or slower is empty */
const healthOf = (ms: number) => Math.max(4, Math.min(100, 100 - ms / 20))
const speedTone = (ms: number) => (ms < 600 ? "success" : ms < 1500 ? "warning" : "danger")

function Speed({ ms }: { ms: number }) {
  return (
    <>
      <Kv label="Response" tone={speedTone(ms)}>{ms.toLocaleString("en-US")} ms</Kv>
      <div className="cx-progress"><span style={{ width: `${healthOf(ms)}%`, background: `var(--${speedTone(ms)})` }} /></div>
    </>
  )
}

export function StatusTab() {
  const { diag, loading, error, refresh } = useDiagnostics()
  const held = diag?.subnets.filter(subnet => subnet.balance && subnet.balance !== "0") ?? []
  const lockMinutes = diag?.account.lockExpiresAt ? Math.max(0, Math.ceil((diag.account.lockExpiresAt - Date.now()) / 60000)) : null
  const state = error ? { text: "Error", tone: "danger" } : !diag ? { text: "Checking", tone: "warning" } : { text: "Live", tone: "success" }

  return (
    <div className="w-page">
      <div className="w-card-head" style={{ margin: 0 }}>
        <p className="w-note">
          {diag ? `Checked at ${new Date(diag.checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Checking…"}
        </p>
        <button type="button" className="cx-btn w-btn-sm" onClick={refresh} disabled={loading}>
          {loading ? <span className="cx-spinner" aria-hidden /> : <RefreshCw size={14} aria-hidden />} {loading ? "Checking" : "Check again"}
        </button>
      </div>

      {error && (
        <Card title="Something isn't working">
          <ErrorText error={error} />
        </Card>
      )}

      <Card title="Stacks network" right={<span className={`cx-pill cx-pill-${state.tone}`}>{state.text}</span>}>
        <Kv label="Block">{diag ? diag.network.blockHeight.toLocaleString("en-US") : "—"}</Kv>
        {diag && <Speed ms={diag.network.latencyMs} />}
      </Card>

      <Card title="Charisma token list">
        <Kv label="Tokens">{diag ? diag.tokenCache.tokens.toLocaleString("en-US") : "—"}</Kv>
        {diag && <Speed ms={diag.tokenCache.latencyMs} />}
      </Card>

      <Card title="Blaze subnets" right={diag && <span className="cx-pill cx-pill-plain">{diag.subnets.length}</span>}>
        <Kv label="Holding your funds">{diag ? held.length : "—"}</Kv>
        {diag && (
          held.length > 0 ? (
            <div style={{ marginTop: "8px" }}>
              {held.map(subnet => (
                <div key={subnet.contractId} className="w-row">
                  <div className="w-row-main">
                    <strong>{subnet.symbol}</strong>
                    <span>{subnet.contractId.split(".")[1]}</span>
                  </div>
                  <span className="w-mono">{formatUnits(subnet.balance!, subnet.decimals)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="w-note" style={{ marginTop: "8px" }}>No funds on any of the {diag.subnets.length} subnets.</p>
          )
        )}
      </Card>

      <Card title="This wallet">
        <Kv label="Address">{diag ? short(diag.account.address) : "—"}</Kv>
        <Kv label="Auto-lock">{lockMinutes === null ? "—" : `In ${lockMinutes} min`}</Kv>
        {lockMinutes !== null && <div className="cx-progress"><span style={{ width: `${(lockMinutes / 15) * 100}%` }} /></div>}
      </Card>
    </div>
  )
}
