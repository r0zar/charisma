/**
 * The active account's NFTs: which ones it holds (Hiro), and each one's details, read from its own contract. The
 * contract's get-token-uri gives where the token's metadata lives; that JSON gives the name and picture. Details are
 * kept for the session. A token whose details can't load still shows, with the reason, rather than being left out.
 */
import { Cl, ClarityType, cvToValue, fetchCallReadOnlyFunction } from "@stacks/transactions"
import { hiroClient, hiroFetch } from "./hiro"
import * as wallet from "./wallet"
import { WalletError } from "./wallet-error"

/** Where ipfs:// pictures and metadata are read from */
export const IPFS_GATEWAY = "https://ipfs.io/ipfs/"

export interface NftItem {
  /** The collection's contract id */
  contractId: string
  tokenId: string
  /** From the token's metadata; null when it couldn't be read */
  name: string | null
  /** The picture's https address; null when the metadata has none or it couldn't be read */
  image: string | null
  /** Why the details couldn't load, in English; null when they did */
  error: string | null
}

export interface NftPage {
  items: NftItem[]
  /** How many NFTs the account holds in all */
  total: number
}

interface Holdings {
  total: number
  results: { asset_identifier: string; value: { repr: string } }[]
}

/** Details by "contract::id". A failed lookup is dropped, so the next load tries again. */
const details = new Map<string, Promise<Pick<NftItem, "name" | "image">>>()

/** Where a token's metadata lives: {id} filled in, or the id added to a base URI that ends in "/" */
function metadataUri(uri: string, tokenId: string) {
  if (uri.includes("{id}")) return uri.replaceAll("{id}", tokenId)
  return uri.endsWith("/") ? uri + tokenId : uri
}

/** An address the extension can fetch: https as it is, ipfs:// through the gateway */
function fetchableUrl(uri: string) {
  if (uri.startsWith("https://") || uri.startsWith("http://")) return uri
  if (uri.startsWith("ipfs://")) return IPFS_GATEWAY + uri.slice("ipfs://".length)
  throw new Error(`Can't read this address: ${uri}`)
}

/** The token URI the contract reports for one token */
async function tokenUri(contractId: string, tokenId: string, sender: string) {
  const [contractAddress, contractName] = contractId.split(".")
  const result = await fetchCallReadOnlyFunction({
    contractAddress, contractName, functionName: "get-token-uri",
    functionArgs: [Cl.uint(BigInt(tokenId))], senderAddress: sender, network: "mainnet", client: hiroClient,
  })
  if (result.type === ClarityType.ResponseErr) throw new Error(`The contract's get-token-uri failed with error ${cvToValue(result.value)}`)
  if (result.type !== ClarityType.ResponseOk || result.value.type !== ClarityType.OptionalSome) {
    throw new Error("The contract has no token URI for this token")
  }
  return cvToValue(result.value.value) as string
}

async function metadataOf(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Its metadata returned HTTP ${res.status}`)
  return (await res.json()) as { name?: unknown; image?: unknown }
}

function detailsOf(contractId: string, tokenId: string, sender: string) {
  const key = `${contractId}::${tokenId}`
  const known = details.get(key)
  if (known) return known
  const lookup = (async () => {
    const json = await metadataOf(fetchableUrl(metadataUri(await tokenUri(contractId, tokenId, sender), tokenId)))
    return {
      name: typeof json.name === "string" ? json.name : null,
      image: typeof json.image === "string" ? fetchableUrl(json.image) : null,
    }
  })()
  details.set(key, lookup)
  lookup.catch(() => details.delete(key))
  return lookup
}

/** One page of the active account's NFTs: `limit` of them from `offset`, each with its details (or why not) */
export async function getNfts(offset: number, limit: number): Promise<NftPage> {
  const account = await wallet.getCurrentAccount()
  if (!account) throw new WalletError("errorNoActiveAccount")

  const res = await hiroFetch(`${hiroClient.baseUrl}/extended/v1/tokens/nft/holdings?principal=${account.stxAddress}&limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new WalletError("errorNfts", [res.status])
  const holdings = (await res.json()) as Holdings

  const items = await Promise.all(holdings.results.map(async ({ asset_identifier, value }): Promise<NftItem> => {
    // An NFT's id is "<contract>::<asset>"; its token id is the value, "u867" for 867
    const contractId = asset_identifier.split("::")[0]
    const tokenId = value.repr.replace(/^u/, "")
    try {
      return { contractId, tokenId, error: null, ...(await detailsOf(contractId, tokenId, account.stxAddress)) }
    } catch (error) {
      return { contractId, tokenId, name: null, image: null, error: (error as Error).message }
    }
  }))
  return { items, total: holdings.total }
}
