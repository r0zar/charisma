/**
 * Sign structured data (SIP-018): what the order does, in plain words.
 * Blaze orders (Charisma subnets) get a readable summary, including who the funds can be paid out to.
 */
import type { ReactNode } from "react"
import { Cl, type ClarityValue, type TupleCV } from "@stacks/transactions"
import { OriginBanner, PermissionLevelIndicator } from "./parts/UIComponents"
import { BannerType, PermissionLevel } from "./parts/types"
import { commonStyles } from "./parts/styles"
import { BLAZE_V1_DOMAIN, LEGACY_MULTIHOP_CONTRACT_ID, MULTIHOP_CONTRACT_ID, MULTIHOP_V1_CONTRACT_ID } from "blaze-sdk"
import { colors } from "~shared/styles/theme"

/** Routers and what they allow once they hold a signed order */
const ROUTERS: Record<string, { text: string; color: string }> = {
  [MULTIHOP_CONTRACT_ID]: { text: "Only to you", color: colors.neonGreen },
  [MULTIHOP_V1_CONTRACT_ID]: { text: "Only to you", color: colors.neonGreen },
  [LEGACY_MULTIHOP_CONTRACT_ID]: { text: "Wherever the submitter chooses", color: colors.neonRed },
}

const BLAZE_NAME = Cl.prettyPrint(BLAZE_V1_DOMAIN.value.name).replace(/"/g, "")

const shortName = (principal: string) => principal.split(".").pop() ?? principal

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

function BlazeOrder({ fields }: { fields: Record<string, ClarityValue> }) {
  const contract = Cl.prettyPrint(fields.contract)
  const amount = optional(fields.amount)
  const target = optional(fields.target)
  const targetId = target ? Cl.prettyPrint(target).replace(/^'/, "") : null
  const router = targetId ? ROUTERS[targetId] : null
  return (
    <>
      <Row label="Action">{Cl.prettyPrint(fields.intent).replace(/"/g, "")}</Row>
      <Row label="Token">{shortName(contract.replace(/^'/, ""))}</Row>
      {amount && <Row label="Amount (smallest units)">{Cl.prettyPrint(amount).replace(/^u/, "")}</Row>}
      {targetId && (
        <Row label="Payout" color={router?.color ?? colors.neonOrange}>
          {router ? `${router.text} (${shortName(targetId)})` : `Handled by ${shortName(targetId)}`}
        </Row>
      )}
      <Row label="Order ID">{Cl.prettyPrint(fields.uuid).replace(/"/g, "")}</Row>
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
    <div style={commonStyles.contentContainer}>
      <PermissionLevelIndicator level={PermissionLevel.SENSITIVE} />
      <OriginBanner origin={origin} type={BannerType.WARNING} message={isBlaze ? "wants you to sign a subnet order" : `wants you to sign data for ${appName}`} />

      <div style={{ margin: "10px 0", padding: "6px 10px", background: "rgba(125, 249, 255, 0.05)", border: "1px solid rgba(125, 249, 255, 0.2)", borderRadius: "4px" }}>
        {isBlaze
          ? <BlazeOrder fields={(data as TupleCV).value} />
          : data.type === "tuple"
            ? Object.entries((data as TupleCV).value).map(([key, value]) => <Row key={key} label={key}>{Cl.prettyPrint(value)}</Row>)
            : <Row label="Data">{Cl.prettyPrint(data)}</Row>}
      </div>

      <div style={{ fontSize: "11px", color: colors.steel }}>
        {address ? `Signs as ${address.slice(0, 6)}…${address.slice(-4)}. ` : ""}
        {isBlaze ? "Anyone holding this signature can run this order once." : "Only sign data you recognize."}
      </div>
    </div>
  )
}
