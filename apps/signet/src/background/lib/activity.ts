/**
 * The active account's activity: its transactions with the STX and token transfers in each, newest first (Hiro's
 * transactions_with_transfers). Each transfer says which way it went, relative to this account.
 */
import { hiroClient, hiroFetch } from "./hiro"
import { STX_ID, tokenMeta } from "./tokens"
import * as wallet from "./wallet"
import { WalletError } from "./wallet-error"

export interface ActivityMove {
  direction: "in" | "out"
  /** ".stx" or the token's contract id */
  contractId: string
  /** Smallest units; "1" for an NFT */
  amount: string
  /** An NFT's token id; set only for NFT moves */
  tokenId?: string
  /** Null when the token cache doesn't know the token, and for NFTs: shown raw */
  meta: { symbol: string; decimals: number } | null
}

export interface ActivityRow {
  txId: string
  /** ISO time the transaction was anchored */
  time: string
  status: "success" | "pending" | "failed"
  /** The contract function called, or null for a plain transfer */
  fn: string | null
  moves: ActivityMove[]
}

interface Feed {
  results: {
    tx: {
      tx_id: string
      tx_status: string
      tx_type: string
      block_time_iso: string
      contract_call?: { function_name: string }
    }
    stx_sent: string
    stx_received: string
    ft_transfers: { asset_identifier: string; amount: string; recipient: string }[]
    nft_transfers: { asset_identifier: string; value: { repr: string }; recipient: string }[]
  }[]
}

type Transfer = Omit<ActivityMove, "meta">

/** The STX and token transfers in one transaction, each as it went for this account */
function transfersOf({ stx_sent, stx_received, ft_transfers, nft_transfers }: Feed["results"][number], address: string): Transfer[] {
  return [
    ...(stx_sent !== "0" ? [{ direction: "out" as const, contractId: STX_ID, amount: stx_sent }] : []),
    ...(stx_received !== "0" ? [{ direction: "in" as const, contractId: STX_ID, amount: stx_received }] : []),
    // A token's id is "<contract>::<asset>"; its contract is what the token cache knows
    ...ft_transfers.map(ft => ({
      direction: ft.recipient === address ? "in" as const : "out" as const,
      contractId: ft.asset_identifier.split("::")[0],
      amount: ft.amount,
    })),
    ...nft_transfers.map(nft => ({
      direction: nft.recipient === address ? "in" as const : "out" as const,
      contractId: nft.asset_identifier.split("::")[0],
      amount: "1",
      tokenId: nft.value.repr.replace(/^u/, ""),
    })),
  ]
}

/** One page of the active account's activity, newest first: `limit` transactions from `offset` */
export async function getActivity(offset: number, limit: number): Promise<ActivityRow[]> {
  const account = await wallet.getCurrentAccount()
  if (!account) throw new WalletError("errorNoActiveAccount")

  const res = await hiroFetch(`${hiroClient.baseUrl}/extended/v1/address/${account.stxAddress}/transactions_with_transfers?limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new WalletError("errorActivity", [res.status])
  const { results } = (await res.json()) as Feed

  const transfers = results.map(item => transfersOf(item, account.stxAddress))
  // NFTs have no decimals or symbol to look up: they're named by their contract and token id
  const contractIds = [...new Set(transfers.flat().filter(transfer => !transfer.tokenId).map(transfer => transfer.contractId))]
  const metas = new Map(await Promise.all(contractIds.map(async id => [id, await tokenMeta(id)] as const)))

  return results.map(({ tx }, i) => ({
    txId: tx.tx_id,
    time: tx.block_time_iso,
    status: tx.tx_status === "success" ? "success" : tx.tx_status === "pending" ? "pending" : "failed",
    fn: tx.tx_type === "contract_call" ? tx.contract_call?.function_name ?? null : null,
    moves: transfers[i].map(transfer => ({ ...transfer, meta: metas.get(transfer.contractId) ?? null })),
  }))
}
