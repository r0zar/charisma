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
import { t } from "~shared/i18n"
import { Kv, formatUnits } from "~shared/ui"

const short = (text: string) => (text.length > 16 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text)
/** Micro-STX as STX, exactly: an approval never hides part of an amount */
const stx = (micro: bigint | string | number) => `${formatUnits(BigInt(micro), 6)} STX`

/**
 * Each condition code's sentence, for "you" (`who` is null) and for someone else: whole sentences, so word order can
 * change. Keys are written out so the locale check sees every one.
 */
const FUNGIBLE: Record<FungibleConditionCode, (who: string | null, amount: string) => string> = {
  [FungibleConditionCode.Equal]: (who, amount) => (who === null ? t("pcYouSendExactly", amount) : t("pcTheySendExactly", who, amount)),
  [FungibleConditionCode.Greater]: (who, amount) => (who === null ? t("pcYouSendMoreThan", amount) : t("pcTheySendMoreThan", who, amount)),
  [FungibleConditionCode.GreaterEqual]: (who, amount) => (who === null ? t("pcYouSendAtLeast", amount) : t("pcTheySendAtLeast", who, amount)),
  [FungibleConditionCode.Less]: (who, amount) => (who === null ? t("pcYouSendLessThan", amount) : t("pcTheySendLessThan", who, amount)),
  [FungibleConditionCode.LessEqual]: (who, amount) => (who === null ? t("pcYouSendAtMost", amount) : t("pcTheySendAtMost", who, amount)),
}

/** Who a condition is about: null for the signer ("you"), otherwise an address or contract name */
function who(principal: PostConditionPrincipalWire, signer: string | null): string | null {
  if (principal.prefix === PostConditionPrincipalId.Origin) return null
  const address = addressToString(principal.address)
  if (principal.prefix === PostConditionPrincipalId.Contract) return principal.contractName.content
  return address === signer ? null : short(address)
}

/** One post condition as a sentence, e.g. "You send at most 10 STX" */
function describe(pc: PostConditionWire, signer: string | null) {
  const sender = who(pc.principal, signer)
  if (pc.conditionType === PostConditionType.STX || pc.conditionType === PostConditionType.Fungible) {
    const amount = pc.conditionType === PostConditionType.STX
      ? stx(pc.amount)
      : t("tokenSmallestUnits", pc.amount.toString(), pc.asset.assetName.content)
    return FUNGIBLE[pc.conditionCode](sender, amount)
  }
  if (pc.conditionType !== PostConditionType.NonFungible) return t("pcStacking", sender ?? t("pcYou"))
  const asset = pc.asset.assetName.content
  const id = Cl.prettyPrint(pc.assetName)
  if (pc.conditionCode === NonFungibleConditionCode.Sends) {
    return sender === null ? t("pcYouSendNft", asset, id) : t("pcTheySendNft", sender, asset, id)
  }
  return sender === null ? t("pcYouKeepNft", asset, id) : t("pcTheyKeepNft", sender, asset, id)
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
      {isTransfer
        ? <RequestHeader level={PermissionLevel.CRITICAL} origin={origin} ask="askSendStx" />
        : <RequestHeader level={PermissionLevel.CRITICAL} origin={origin} ask="askRunTransaction" />}

      <div className="cx-pane">
        {isTransfer ? (
          <>
            <Kv label={t("send")}>{stx(params.amount)}</Kv>
            <Kv label={t("to")}>{params.recipient}</Kv>
            {params.memo && <Kv label={t("memo")}>{params.memo}</Kv>}
          </>
        ) : (
          <>
            <Kv label={t("contract")}>{params.contract.split(".")[1]} ({short(params.contract.split(".")[0])})</Kv>
            <Kv label={t("function")}>{params.functionName}</Kv>
            <div style={{ maxHeight: "90px", overflowY: "auto" }}>
              {((params.functionArgs ?? []) as string[]).map((arg, i) => (
                <Kv key={i} label={t("argument", i + 1)}>{Cl.prettyPrint(Cl.deserialize(arg))}</Kv>
              ))}
            </div>
          </>
        )}
      </div>

      {!isTransfer && (
        <div className="cx-pane" style={{ background: `var(--${allowMode ? "danger" : "success"}-soft)`, borderColor: "transparent" }}>
          <div style={{ fontWeight: 700, color: `var(--${allowMode ? "danger" : "success"})`, marginBottom: postConditions.length ? "4px" : 0 }}>
            {allowMode ? t("allowMode") : postConditions.length ? t("onlyTheseTransfers") : t("noTokensLeave")}
          </div>
          {postConditions.map((pc, i) => (
            <div key={i} style={{ padding: "2px 0", color: "var(--ink-body)" }}>• {describe(pc, address)}</div>
          ))}
        </div>
      )}

      <p className="w-note">
        {address ? `${t("sentFrom", short(address))} ` : ""}{t("feeSetAutomatically")}
      </p>
    </div>
  )
}
