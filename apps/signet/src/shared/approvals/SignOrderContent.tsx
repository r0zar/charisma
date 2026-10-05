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
import { formatUnits, Kv } from "~shared/ui"

/** Routers and what they allow once they hold a signed order */
const ROUTERS: Record<string, { text: string; tone: "success" | "danger" }> = {
  [MULTIHOP_CONTRACT_ID]: { text: "Only to you", tone: "success" },
  [MULTIHOP_V1_CONTRACT_ID]: { text: "Only to you", tone: "success" },
  [LEGACY_MULTIHOP_CONTRACT_ID]: { text: "Wherever the submitter chooses", tone: "danger" },
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
      <Kv label="Action">{Cl.prettyPrint(fields.intent).replace(/"/g, "")}</Kv>
      <Kv label="Token">{token ? `${token.symbol} on Blaze` : shortName(contract)}</Kv>
      {amount?.type === "uint" && (
        <Kv label={token === null ? "Amount (smallest units)" : "Amount"}>
          {token ? `${formatUnits(BigInt(amount.value), token.decimals)} ${token.symbol}` : token === undefined ? "…" : amount.value.toString()}
        </Kv>
      )}
      {targetId && sendsTo && <Kv label="Sends to" tone="danger">{targetId}</Kv>}
      {targetId && !sendsTo && (
        <Kv label="Payout" tone={router?.tone ?? "warning"}>
          {router ? `${router.text} (${shortName(targetId)})` : `Handled by ${shortName(targetId)}`}
        </Kv>
      )}
      <Kv label="Order ID">{Cl.prettyPrint(fields.uuid).replace(/"/g, "")}</Kv>
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
      <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} message={isBlaze ? "wants you to sign a subnet order" : `wants you to sign data for ${appName}`} />

      <div className="cx-pane">
        {isBlaze
          ? <BlazeOrder fields={(data as TupleCV).value} />
          : data.type === "tuple"
            ? Object.entries((data as TupleCV).value).map(([key, value]) => <Kv key={key} label={key}>{Cl.prettyPrint(value)}</Kv>)
            : <Kv label="Data">{Cl.prettyPrint(data)}</Kv>}
      </div>

      <p className="w-note">
        {address ? `Signs as ${address.slice(0, 6)}…${address.slice(-4)}. ` : ""}
        {isBlaze ? "Anyone holding this signature can run this order once." : "Only sign data you recognize."}
      </p>
    </div>
  )
}
