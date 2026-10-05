/**
 * Send a transaction (stx_transferStx, stx_callContract): what it does and exactly what can leave the wallet.
 */
import {
  Cl,
  FungibleConditionCode,
  NonFungibleConditionCode,
  PostConditionPrincipalId,
  PostConditionType,
  addressToString,
  deserializePostConditionWire,
  type PostConditionPrincipalWire,
  type PostConditionWire
} from "@stacks/transactions"
import { RequestHeader } from "./parts/UIComponents"
import { PermissionLevel } from "./parts/types"
import { Kv } from "~shared/ui"

const short = (text: string) => (text.length > 16 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text)
const stx = (micro: bigint | string | number) => `${(Number(micro) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 })} STX`

const FUNGIBLE_CODE: Record<FungibleConditionCode, string> = {
  [FungibleConditionCode.Equal]: "exactly",
  [FungibleConditionCode.Greater]: "more than",
  [FungibleConditionCode.GreaterEqual]: "at least",
  [FungibleConditionCode.Less]: "less than",
  [FungibleConditionCode.LessEqual]: "at most",
}

function who(principal: PostConditionPrincipalWire, signer: string | null) {
  if (principal.prefix === PostConditionPrincipalId.Origin) return "You"
  const address = addressToString(principal.address)
  if (principal.prefix === PostConditionPrincipalId.Contract) return principal.contractName.content
  return address === signer ? "You" : short(address)
}

/** One post condition as a sentence, e.g. "You send at most 10 STX" */
function describe(pc: PostConditionWire, signer: string | null) {
  const sender = who(pc.principal, signer)
  const verb = sender === "You" ? "send" : "sends"
  if (pc.conditionType === PostConditionType.STX) return `${sender} ${verb} ${FUNGIBLE_CODE[pc.conditionCode]} ${stx(pc.amount)}`
  if (pc.conditionType === PostConditionType.Fungible) {
    return `${sender} ${verb} ${FUNGIBLE_CODE[pc.conditionCode]} ${pc.amount.toString()} ${pc.asset.assetName.content} (smallest units)`
  }
  if (pc.conditionType !== PostConditionType.NonFungible) return `${sender}: stacking condition`
  const sends = pc.conditionCode === NonFungibleConditionCode.Sends
  return `${sender} ${sends ? verb : sender === "You" ? "keep" : "keeps"} ${pc.asset.assetName.content} ${Cl.prettyPrint(pc.assetName)}`
}


export function TransactionContent({ origin, address, method, params }: {
  origin: string
  address: string | null
  method: string
  params: Record<string, any>
}) {
  const isTransfer = method === "stx_transferStx"
  const postConditions = ((params.postConditions ?? []) as string[]).map(pc => deserializePostConditionWire(pc))
  const allowMode = !isTransfer && params.postConditionMode === "allow"

  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.CRITICAL} origin={origin} message={isTransfer ? "wants you to send STX" : "wants you to run a transaction"} />

      <div className="cx-pane">
        {isTransfer ? (
          <>
            <Kv label="Send">{stx(params.amount)}</Kv>
            <Kv label="To">{params.recipient}</Kv>
            {params.memo && <Kv label="Memo">{params.memo}</Kv>}
          </>
        ) : (
          <>
            <Kv label="Contract">{params.contract.split(".")[1]} ({short(params.contract.split(".")[0])})</Kv>
            <Kv label="Function">{params.functionName}</Kv>
            <div style={{ maxHeight: "90px", overflowY: "auto" }}>
              {((params.functionArgs ?? []) as string[]).map((arg, i) => (
                <Kv key={i} label={`Arg ${i + 1}`}>{Cl.prettyPrint(Cl.deserialize(arg))}</Kv>
              ))}
            </div>
          </>
        )}
      </div>

      {!isTransfer && (
        <div className="cx-pane" style={{ background: `var(--${allowMode ? "danger" : "success"}-soft)`, borderColor: "transparent" }}>
          <div style={{ fontWeight: 700, color: `var(--${allowMode ? "danger" : "success"})`, marginBottom: postConditions.length ? "4px" : 0 }}>
            {allowMode
              ? "⚠ Any of your tokens could move (allow mode)"
              : postConditions.length ? "Only these transfers can happen:" : "No tokens can leave your wallet"}
          </div>
          {postConditions.map((pc, i) => (
            <div key={i} style={{ padding: "2px 0", color: "var(--ink-body)" }}>• {describe(pc, address)}</div>
          ))}
        </div>
      )}

      <p className="w-note">
        {address ? `Sent from ${short(address)}. ` : ""}Network fee is set automatically.
      </p>
    </div>
  )
}
