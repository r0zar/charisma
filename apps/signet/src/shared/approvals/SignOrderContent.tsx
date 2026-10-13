/**
 * Sign structured data (SIP-018): what the order does, in plain words.
 * Blaze orders (Charisma subnets) get a readable summary, including who the funds can be paid out to.
 */
import { useEffect, useState } from "react"
import { Cl, type ClarityValue, type TupleCV } from "@stacks/transactions"
import { getTokenMetadataStrict } from "@repo/tokens"
import { RequestHeader } from "./parts/UIComponents"
import { PermissionLevel } from "./parts/types"
import { BLAZE_V1_DOMAIN, LEGACY_MULTIHOP_CONTRACT_ID, MULTIHOP_CONTRACT_ID, MULTIHOP_V1_CONTRACT_ID } from "blaze-sdk"
import { t } from "~shared/i18n"
import { formatUnits, Kv, short } from "~shared/ui"

/** Routers and what they allow once they hold a signed order */
const ROUTERS: Record<string, { text: string; tone: "success" | "danger" }> = {
  [MULTIHOP_CONTRACT_ID]: { text: "payoutOnlyYou", tone: "success" },
  [MULTIHOP_V1_CONTRACT_ID]: { text: "payoutOnlyYou", tone: "success" },
  [LEGACY_MULTIHOP_CONTRACT_ID]: { text: "payoutSubmitter", tone: "danger" },
}

const BLAZE_NAME = Cl.prettyPrint(BLAZE_V1_DOMAIN.value.name).replace(/"/g, "")

const shortName = (principal: string) => principal.split(".").pop() ?? principal

/** The value inside an optional, or null for none */
function optional(value: ClarityValue | undefined): ClarityValue | null {
  if (!value || value.type === "none") return null
  return value.type === "some" ? value.value : value
}


function BlazeOrder({ fields }: { fields: Record<string, ClarityValue> }) {
  const contract = Cl.prettyPrint(fields.contract).replace(/^'/, "")
  const amount = optional(fields.amount)
  // Symbol and decimals from Charisma's token list; an unknown token stays in smallest units, never guessed
  const [token, setToken] = useState<{ symbol: string; decimals: number } | null | undefined>(undefined)
  useEffect(() => {
    getTokenMetadataStrict(contract)
      .then(data => setToken({ symbol: data.symbol, decimals: data.decimals }))
      .catch(() => setToken(null))
  }, [contract])
  const target = optional(fields.target)
  const targetId = target ? Cl.prettyPrint(target).replace(/^'/, "") : null
  const router = targetId ? ROUTERS[targetId] : null
  // A plain address, not a router contract: the funds go straight to it
  const sendsTo = target?.type === "address"
  return (
    <>
      <Kv label={t("orderAction")}>{Cl.prettyPrint(fields.intent).replace(/"/g, "")}</Kv>
      <Kv label={t("orderToken")}>{token ? t("onBlaze", token.symbol) : shortName(contract)}</Kv>
      {amount?.type === "uint" && (
        <Kv label={token === null ? t("amountSmallestUnits") : t("amount")}>
          {token ? `${formatUnits(BigInt(amount.value), token.decimals)} ${token.symbol}` : token === undefined ? "…" : amount.value.toString()}
        </Kv>
      )}
      {targetId && sendsTo && <Kv label={t("sendsTo")} tone="danger">{targetId}</Kv>}
      {targetId && !sendsTo && (
        <Kv label={t("payout")} tone={router?.tone ?? "warning"}>
          {router ? `${t(router.text)} (${shortName(targetId)})` : t("handledBy", shortName(targetId))}
        </Kv>
      )}
      <Kv label={t("orderId")}>{Cl.prettyPrint(fields.uuid).replace(/"/g, "")}</Kv>
    </>
  )
}

export function SignOrderContent({ origin, address, message, domain }: {
  origin: string
  address: string | null
  message: string
  domain: string
}) {
  const data = Cl.deserialize(message)
  const domainFields = (Cl.deserialize(domain) as TupleCV).value
  const appName = Cl.prettyPrint(domainFields.name).replace(/"/g, "")
  const isBlaze = appName === BLAZE_NAME && data.type === "tuple"

  return (
    <div className="w-approval">
      {isBlaze
        ? <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} ask="askSignOrder" />
        : <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} ask="askSignData" fills={[appName]} />}

      <div className="cx-pane">
        {isBlaze
          ? <BlazeOrder fields={(data as TupleCV).value} />
          : data.type === "tuple"
            ? Object.entries((data as TupleCV).value).map(([key, value]) => <Kv key={key} label={key}>{Cl.prettyPrint(value)}</Kv>)
            : <Kv label={t("orderData")}>{Cl.prettyPrint(data)}</Kv>}
      </div>

      <p className="w-note">
        {address ? `${t("signsAsSentence", short(address))} ` : ""}
        {isBlaze ? t("orderRunsOnce") : t("signOnlyRecognized")}
      </p>
    </div>
  )
}
