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
import { OriginBanner, PermissionLevelIndicator } from "~contents/components/notifications/UIComponents"
import { BannerType, PermissionLevel } from "~contents/components/notifications/types"
import { commonStyles } from "~contents/components/notifications/styles"
import { colors } from "~shared/styles/theme"

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "4px 0", fontSize: "11px" }}>
      <span style={{ color: colors.steel }}>{label}</span>
      <span style={{ color: "#f8f8f2", textAlign: "right", wordBreak: "break-all" }}>{children}</span>
    </div>
  )
}

const box = {
  margin: "10px 0",
  padding: "6px 10px",
  background: "rgba(125, 249, 255, 0.05)",
  border: "1px solid rgba(125, 249, 255, 0.2)",
  borderRadius: "4px",
} as const

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
    <div style={commonStyles.contentContainer}>
      <PermissionLevelIndicator level={PermissionLevel.CRITICAL} />
      <OriginBanner origin={origin} type={BannerType.CRITICAL} message={isTransfer ? "wants you to send STX" : "wants you to run a transaction"} />

      <div style={box}>
        {isTransfer ? (
          <>
            <Row label="Send">{stx(params.amount)}</Row>
            <Row label="To">{params.recipient}</Row>
            {params.memo && <Row label="Memo">{params.memo}</Row>}
          </>
        ) : (
          <>
            <Row label="Contract">{params.contract.split(".")[1]} ({short(params.contract.split(".")[0])})</Row>
            <Row label="Function">{params.functionName}</Row>
            <div className="signet-scrollbar" style={{ maxHeight: "90px", overflowY: "auto" }}>
              {((params.functionArgs ?? []) as string[]).map((arg, i) => (
                <Row key={i} label={`Arg ${i + 1}`}>{Cl.prettyPrint(Cl.deserialize(arg))}</Row>
              ))}
            </div>
          </>
        )}
      </div>

      {!isTransfer && (
        <div style={{ ...box, borderColor: allowMode ? colors.neonRed : "rgba(54, 199, 88, 0.4)" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: allowMode ? colors.neonRed : colors.neonGreen, marginBottom: "4px" }}>
            {allowMode
              ? "⚠ Any of your tokens could move (allow mode)"
              : postConditions.length ? "Only these transfers can happen:" : "No tokens can leave your wallet"}
          </div>
          {postConditions.map((pc, i) => (
            <div key={i} style={{ fontSize: "11px", padding: "2px 0" }}>• {describe(pc, address)}</div>
          ))}
        </div>
      )}

      <div style={{ fontSize: "11px", color: colors.steel }}>
        {address ? `Sent from ${short(address)}. ` : ""}Network fee is set automatically.
      </div>
    </div>
  )
}
