/**
 * Sign many Blaze orders at once (blaze_signStructuredMessages): one card with the count, how much of
 * each token they can spend in total, and where the funds can be paid out.
 */
import { useEffect, useState } from "react"
import { Cl, type ClarityValue, type TupleCV } from "@stacks/transactions"
import { getTokenMetadataStrict } from "@repo/tokens"
import { LEGACY_MULTIHOP_CONTRACT_ID, MULTIHOP_CONTRACT_ID, MULTIHOP_V1_CONTRACT_ID } from "blaze-sdk"
import { RequestHeader } from "./parts/UIComponents"
import { PermissionLevel } from "./parts/types"
import { count, pluralKey, t } from "~shared/i18n"
import { formatUnits, Kv, short } from "~shared/ui"

/** Routers and what they allow once they hold a signed order */
const ROUTERS: Record<string, { text: string; tone: "success" | "danger" }> = {
  [MULTIHOP_CONTRACT_ID]: { text: "payoutOnlyYou", tone: "success" },
  [MULTIHOP_V1_CONTRACT_ID]: { text: "payoutOnlyYou", tone: "success" },
  [LEGACY_MULTIHOP_CONTRACT_ID]: { text: "payoutSubmitter", tone: "danger" },
}

const shortName = (principal: string) => principal.split(".").pop() ?? principal
const principalOf = (value: ClarityValue) => Cl.prettyPrint(value).replace(/^'/, "")

/** The value inside an optional, or null for none */
function optional(value: ClarityValue | undefined): ClarityValue | null {
  if (!value || value.type === "none") return null
  return value.type === "some" ? value.value : value
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
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} ask={pluralKey("askSignOrders", orders.length)} fills={[count(orders.length)]} />

      <div className="cx-pane">
        <Kv label={t("ordersCount")}>{count(orders.length)}</Kv>
        {[...totals].map(([contract, total]) => {
          const token = meta[contract]
          return (
            <Kv key={contract} label={t("canSpendTotal")}>
              {token ? `${formatUnits(total, token.decimals)} ${token.symbol}` : t("smallestUnitsOf", total.toString(), shortName(contract))}
            </Kv>
          )
        })}
        {[...routers].map(id => {
          const router = ROUTERS[id]
          return (
            <Kv key={id} label={t("payout")} tone={router?.tone ?? "warning"}>
              {router ? `${t(router.text)} (${shortName(id)})` : t("handledBy", shortName(id))}
            </Kv>
          )
        })}
      </div>

      <p className="w-note">
        {address ? `${t("signsAsSentence", short(address))} ` : ""}
        {t("ordersRunOnce")}
      </p>
    </div>
  )
}
