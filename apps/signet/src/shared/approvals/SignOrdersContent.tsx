/**
 * Sign many Blaze orders at once (blaze_signStructuredMessages): one card with the count, how much of
 * each token they can spend in total, and where the funds can be paid out.
 */
import { useEffect, useState, type ReactNode } from "react"
import { Cl, type ClarityValue, type TupleCV } from "@stacks/transactions"
import { getTokenMetadataStrict } from "@repo/tokens"
import { LEGACY_MULTIHOP_CONTRACT_ID, MULTIHOP_CONTRACT_ID } from "blaze-sdk"
import { OriginBanner, PermissionLevelIndicator } from "./parts/UIComponents"
import { BannerType, PermissionLevel } from "./parts/types"
import { commonStyles } from "./parts/styles"
import { colors } from "~shared/styles/theme"

/** Routers and what they allow once they hold a signed order */
const ROUTERS: Record<string, { text: string; color: string }> = {
  [MULTIHOP_CONTRACT_ID]: { text: "Only to you", color: colors.neonGreen },
  [LEGACY_MULTIHOP_CONTRACT_ID]: { text: "Wherever the submitter chooses", color: colors.neonRed },
}

const shortName = (principal: string) => principal.split(".").pop() ?? principal
const principalOf = (value: ClarityValue) => Cl.prettyPrint(value).replace(/^'/, "")

/** The value inside an optional, or null for none */
function optional(value: ClarityValue | undefined): ClarityValue | null {
  if (!value || value.type === "none") return null
  return value.type === "some" ? value.value : value
}

function Row({ label, children, color }: { label: string; children: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "4px 0", fontSize: "11px" }}>
      <span style={{ color: colors.steel }}>{label}</span>
      <span style={{ color: color ?? "#f8f8f2", textAlign: "right", wordBreak: "break-all" }}>{children}</span>
    </div>
  )
}

/** Smallest units as whole tokens */
function formatUnits(raw: bigint, decimals: number): string {
  const text = raw.toString().padStart(decimals + 1, "0")
  const whole = text.slice(0, text.length - decimals)
  const fraction = text.slice(text.length - decimals).replace(/0+$/, "")
  return `${BigInt(whole).toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`
}

export function SignOrdersContent({ origin, address, messages }: { origin: string; address: string | null; messages: string[] }) {
  const orders = messages.map(m => (Cl.deserialize(m) as TupleCV).value)

  // What they can spend in total, per token, and every payout router named
  const totals = new Map<string, bigint>()
  const routers = new Set<string>()
  for (const fields of orders) {
    const contract = principalOf(fields.contract)
    const amount = optional(fields.amount)
    totals.set(contract, (totals.get(contract) ?? 0n) + (amount?.type === "uint" ? BigInt(amount.value) : 0n))
    const target = optional(fields.target)
    if (target) routers.add(principalOf(target))
  }

  // Names and decimals from Charisma's token cache; unknown tokens stay in smallest units, never guessed
  const [meta, setMeta] = useState<Record<string, { symbol: string; decimals: number } | null>>({})
  useEffect(() => {
    for (const contract of totals.keys()) {
      getTokenMetadataStrict(contract)
        .then(data => setMeta(m => ({ ...m, [contract]: { symbol: data.symbol, decimals: data.decimals } })))
        .catch(() => setMeta(m => ({ ...m, [contract]: null })))
    }
  }, [])

  return (
    <div style={commonStyles.contentContainer}>
      <PermissionLevelIndicator level={PermissionLevel.SENSITIVE} />
      <OriginBanner origin={origin} type={BannerType.WARNING} message={`wants you to sign ${orders.length.toLocaleString("en-US")} subnet orders`} />

      <div style={{ margin: "10px 0", padding: "6px 10px", background: "rgba(125, 249, 255, 0.05)", border: "1px solid rgba(125, 249, 255, 0.2)", borderRadius: "4px" }}>
        <Row label="Orders">{orders.length.toLocaleString("en-US")}</Row>
        {[...totals].map(([contract, total]) => {
          const token = meta[contract]
          return (
            <Row key={contract} label="Can spend in total">
              {token ? `${formatUnits(total, token.decimals)} ${token.symbol}` : `${total.toString()} (smallest units of ${shortName(contract)})`}
            </Row>
          )
        })}
        {[...routers].map(id => {
          const router = ROUTERS[id]
          return (
            <Row key={id} label="Payout" color={router?.color ?? colors.neonOrange}>
              {router ? `${router.text} (${shortName(id)})` : `Handled by ${shortName(id)}`}
            </Row>
          )
        })}
      </div>

      <div style={{ fontSize: "11px", color: colors.steel }}>
        {address ? `Signs as ${address.slice(0, 6)}…${address.slice(-4)}. ` : ""}
        Anyone holding these signatures can run each order once.
      </div>
    </div>
  )
}
