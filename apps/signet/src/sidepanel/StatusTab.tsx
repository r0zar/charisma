/**
 * Status: is everything working? The Stacks network, Charisma's token list, every Blaze subnet with this
 * account's balance on it, and the auto-lock timer, from real checks in the background (diagnostics).
 */
import { RefreshCw } from "lucide-react"
import { useDiagnostics } from "./components/diagnostics-context"
import { count, locale, plural, t } from "~shared/i18n"
import { Card, ErrorText, Kv, short } from "~shared/ui"

/** Smallest units → short readable amount, rounded to 4 decimals (Status's precision) */
const formatUnits = (raw: string, decimals: number) =>
  (Number(raw) / 10 ** decimals).toLocaleString(locale, { maximumFractionDigits: 4 })

/** Instant is full, 2 seconds or slower is empty */
const healthOf = (ms: number) => Math.max(4, Math.min(100, 100 - ms / 20))
const speedTone = (ms: number) => (ms < 600 ? "success" : ms < 1500 ? "warning" : "danger")

function Speed({ ms }: { ms: number }) {
  return (
    <>
      <Kv label={t("response")} tone={speedTone(ms)}>{count(ms)} ms</Kv>
      <div className="cx-progress"><span style={{ width: `${healthOf(ms)}%`, background: `var(--${speedTone(ms)})` }} /></div>
    </>
  )
}

export function StatusTab() {
  const { diag, loading, error, refresh } = useDiagnostics()
  const held = diag?.subnets.filter(subnet => subnet.balance && subnet.balance !== "0") ?? []
  const lockMinutes = diag?.account.lockExpiresAt ? Math.max(0, Math.ceil((diag.account.lockExpiresAt - Date.now()) / 60000)) : null
  const state = error ? { text: t("stateError"), tone: "danger" } : !diag ? { text: t("stateChecking"), tone: "warning" } : { text: t("stateLive"), tone: "success" }

  return (
    <div className="w-page">
      <div className="w-card-head" style={{ margin: 0 }}>
        <p className="w-note">
          {diag ? t("checkedAt", new Date(diag.checkedAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })) : t("checking")}
        </p>
        <button type="button" className="cx-btn w-btn-sm" onClick={refresh} disabled={loading}>
          {loading ? <span className="cx-spinner" aria-hidden /> : <RefreshCw size={14} aria-hidden />} {loading ? t("checkingButton") : t("checkAgain")}
        </button>
      </div>

      {error && (
        <Card title={t("somethingWrong")}>
          <ErrorText error={error} />
        </Card>
      )}

      <Card title={t("stacksNetwork")} right={<span className={`cx-pill cx-pill-${state.tone}`}>{state.text}</span>}>
        <Kv label={t("block")}>{diag ? count(diag.network.blockHeight) : "—"}</Kv>
        {diag && <Speed ms={diag.network.latencyMs} />}
      </Card>

      <Card title={t("tokenListTitle")}>
        <Kv label={t("statusTokens")}>{diag ? count(diag.tokenCache.tokens) : "—"}</Kv>
        {diag && <Speed ms={diag.tokenCache.latencyMs} />}
      </Card>

      <Card title={t("blazeSubnets")} right={diag && <span className="cx-pill cx-pill-plain">{count(diag.subnets.length)}</span>}>
        <Kv label={t("holdingFunds")}>{diag ? count(held.length) : "—"}</Kv>
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
            <p className="w-note" style={{ marginTop: "8px" }}>{plural("noFundsOnSubnets", diag.subnets.length, count(diag.subnets.length))}</p>
          )
        )}
      </Card>

      <Card title={t("thisWallet")}>
        <Kv label={t("address")}>{diag ? short(diag.account.address) : "—"}</Kv>
        <Kv label={t("vaultAutoLock")}>{lockMinutes === null ? "—" : plural("autoLockIn", lockMinutes, count(lockMinutes))}</Kv>
        {lockMinutes !== null && <div className="cx-progress"><span style={{ width: `${(lockMinutes / 15) * 100}%` }} /></div>}
      </Card>
    </div>
  )
}
