/**
 * Standard Stacks wallet requests (JSON-RPC, as sent by @stacks/connect) from web pages.
 *
 * The site is taken from Chrome (`sender.origin`), never from the request. Anything that needs the user
 * opens the sealed approval frame in that tab; only Signet's own extension pages may read or answer
 * an approval.
 */
import { hashMessage } from "@stacks/encryption"
import {
  Cl,
  broadcastTransaction,
  deserializePostConditionWire,
  makeContractCall,
  makeSTXTokenTransfer,
  signMessageHashRsv,
  signStructuredData
} from "@stacks/transactions"
import * as wallet from "./wallet"

/** JSON-RPC error codes used by @stacks/connect */
const MethodNotFound = -32601
const InvalidParams = -32602
const UserRejection = -32000
const InternalError = -32603

export interface ApprovalRequest {
  origin: string
  method: string
  params?: unknown
}

interface Pending extends ApprovalRequest {
  tabId: number
  frameId: number
  decide: (approved: boolean) => void
}

const pending = new Map<string, Pending>()

const CONNECT_METHODS = ["getAddresses", "stx_getAddresses", "wallet_connect"]
const TX_METHODS = ["stx_transferStx", "stx_callContract"]

/** Transaction params as @stacks/connect sends them: Clarity args and post conditions hex-serialized */
interface TxParams {
  network?: string
  fee?: string | number
  nonce?: string | number
  sponsored?: boolean
  recipient?: string
  amount?: string | number
  memo?: string
  contract?: string
  functionName?: string
  functionArgs?: string[]
  postConditions?: string[]
  postConditionMode?: "allow" | "deny"
}

/** Read and check transaction params before asking the user; throws a descriptive error */
function readTx(method: string, p: TxParams) {
  if (p.network && p.network !== "mainnet") throw new Error("Blaze Wallet only works on mainnet for now")
  if (p.sponsored) throw new Error("Blaze Wallet doesn't support sponsored transactions yet")
  const postConditions = (p.postConditions ?? []).map(pc => {
    if (typeof pc !== "string") throw new Error("Post conditions must be hex-serialized")
    return deserializePostConditionWire(pc)
  })
  if (method === "stx_transferStx") {
    if (typeof p.recipient !== "string" || p.amount === undefined) throw new Error("stx_transferStx needs a recipient and an amount")
    return { kind: "transfer" as const, recipient: p.recipient, amount: BigInt(p.amount), memo: p.memo ?? "" }
  }
  const [contractAddress, contractName] = (p.contract ?? "").split(".")
  if (!contractAddress || !contractName || typeof p.functionName !== "string") throw new Error("stx_callContract needs a contract (ADDRESS.name) and a functionName")
  const functionArgs = (p.functionArgs ?? []).map(arg => {
    if (typeof arg !== "string") throw new Error("Function arguments must be hex-serialized Clarity values")
    return Cl.deserialize(arg)
  })
  return {
    kind: "call" as const,
    contractAddress,
    contractName,
    functionName: p.functionName,
    functionArgs,
    postConditions,
    // Deny unless the app asks otherwise: only the listed transfers may happen
    postConditionMode: p.postConditionMode ?? ("deny" as const)
  }
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")

/** Ask the user in the tab that made the request; resolves with their answer. */
function askUser(request: ApprovalRequest, sender: chrome.runtime.MessageSender): Promise<boolean> {
  const requestId = crypto.randomUUID()
  const tabId = sender.tab!.id!
  const frameId = sender.frameId ?? 0
  return new Promise(resolve => {
    pending.set(requestId, { ...request, tabId, frameId, decide: resolve })
    chrome.tabs.sendMessage(tabId, { type: "signet-show-approval", requestId }, { frameId })
  })
}

async function handleRpc(message: { id: string; method: string; params?: unknown }, sender: chrome.runtime.MessageSender) {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: message.id, result })
  const fail = (code: number, text: string) => ({ jsonrpc: "2.0", id: message.id, error: { code, message: text } })

  if (!sender.tab?.id || !sender.origin) return fail(InternalError, "Blaze Wallet can only answer requests from a browser tab")
  const request: ApprovalRequest = { origin: sender.origin, method: message.method, params: message.params }

  if (CONNECT_METHODS.includes(message.method)) {
    if (!(await askUser(request, sender))) return fail(UserRejection, "User rejected the connection")
    const account = await wallet.getCurrentAccount()
    if (!account) return fail(InternalError, "Blaze Wallet has no active account")
    return reply({ addresses: [{ symbol: "STX", address: account.stxAddress, publicKey: account.publicKey }] })
  }

  if (TX_METHODS.includes(message.method)) {
    const params = (message.params ?? {}) as TxParams
    let tx: ReturnType<typeof readTx>
    try {
      tx = readTx(message.method, params)
    } catch (error) {
      return fail(InvalidParams, (error as Error).message)
    }
    if (!(await askUser(request, sender))) return fail(UserRejection, "User rejected the transaction")
    const account = await wallet.getCurrentAccount()
    if (!account) return fail(InternalError, "Blaze Wallet has no active account")

    const common = {
      senderKey: account.privateKey,
      network: "mainnet" as const,
      ...(params.fee !== undefined && { fee: BigInt(params.fee) }),
      ...(params.nonce !== undefined && { nonce: BigInt(params.nonce) })
    }
    const transaction = tx.kind === "transfer"
      ? await makeSTXTokenTransfer({ ...common, recipient: tx.recipient, amount: tx.amount, memo: tx.memo })
      : await makeContractCall({
          ...common,
          contractAddress: tx.contractAddress,
          contractName: tx.contractName,
          functionName: tx.functionName,
          functionArgs: tx.functionArgs,
          // The builder accepts wire post conditions as well as objects
          postConditions: tx.postConditions as never,
          postConditionMode: tx.postConditionMode
        })
    const result = await broadcastTransaction({ transaction, network: "mainnet" })
    if ("error" in result) return fail(InternalError, `The network rejected the transaction: ${result.reason ?? result.error}`)
    return reply({ txid: result.txid, transaction: transaction.serialize() })
  }

  if (message.method === "stx_signMessage") {
    const text = (message.params as { message?: unknown } | undefined)?.message
    if (typeof text !== "string") return fail(InvalidParams, "stx_signMessage needs a message string")
    if (!(await askUser(request, sender))) return fail(UserRejection, "User rejected the signature")
    const account = await wallet.getCurrentAccount()
    if (!account) return fail(InternalError, "Blaze Wallet has no active account")
    // Stacks signed-message format (verifyMessageSignatureRsv checks it)
    const signature = signMessageHashRsv({ messageHash: toHex(hashMessage(text)), privateKey: account.privateKey })
    return reply({ signature, publicKey: account.publicKey })
  }

  if (message.method === "stx_signStructuredMessage") {
    // @stacks/connect sends both as hex-serialized Clarity values
    const { message: data, domain } = (message.params ?? {}) as { message?: unknown; domain?: unknown }
    if (typeof data !== "string" || typeof domain !== "string") {
      return fail(InvalidParams, "stx_signStructuredMessage needs hex-serialized message and domain")
    }
    let parsed: { message: ReturnType<typeof Cl.deserialize>; domain: ReturnType<typeof Cl.deserialize> }
    try {
      parsed = { message: Cl.deserialize(data), domain: Cl.deserialize(domain) }
    } catch (error) {
      return fail(InvalidParams, `Could not read the structured message: ${(error as Error).message}`)
    }
    if (!(await askUser(request, sender))) return fail(UserRejection, "User rejected the signature")
    const account = await wallet.getCurrentAccount()
    if (!account) return fail(InternalError, "Blaze Wallet has no active account")
    // SIP-018 structured data, the format blaze-v1 recovers signers from
    const signature = signStructuredData({ ...parsed, privateKey: account.privateKey })
    return reply({ signature, publicKey: account.publicKey })
  }

  return fail(MethodNotFound, `Blaze Wallet does not support ${message.method} yet`)
}

/** Only Signet's own pages (the approval frame or window) may read or answer approvals. */
const isSignetPage = (sender: chrome.runtime.MessageSender) => sender.origin === new URL(chrome.runtime.getURL("")).origin

async function handleApproval(message: { action: string; requestId: string; approved?: boolean }) {
  const request = pending.get(message.requestId)
  if (!request) throw new Error("This request is no longer waiting")

  switch (message.action) {
    case "get": {
      const unlocked = await wallet.checkWalletInitialized()
      const account = unlocked ? await wallet.getCurrentAccount() : null
      return { origin: request.origin, method: request.method, params: request.params, unlocked, address: account?.stxAddress ?? null }
    }
    case "decide":
      pending.delete(message.requestId)
      request.decide(!!message.approved)
      chrome.tabs.sendMessage(request.tabId, { type: "signet-hide-approval", requestId: message.requestId }, { frameId: request.frameId })
      return true
    case "window":
      // Something covered the in-page frame: continue in Signet's own window instead
      chrome.tabs.sendMessage(request.tabId, { type: "signet-hide-approval", requestId: message.requestId }, { frameId: request.frameId })
      await chrome.windows.create({ url: `${chrome.runtime.getURL("tabs/approve.html")}#${message.requestId}&window`, type: "popup", width: 480, height: 620 })
      return true
    default:
      throw new Error(`Unknown approval action: ${message.action}`)
  }
}

export function listenForProviderRequests() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "signet-rpc") {
      handleRpc(message, sender).then(sendResponse, error =>
        sendResponse({ jsonrpc: "2.0", id: message.id, error: { code: InternalError, message: error.message } }))
      return true
    }
    if (message?.type === "signet-approval" && isSignetPage(sender)) {
      handleApproval(message).then(result => sendResponse({ result }), error => sendResponse({ error: error.message }))
      return true
    }
  })
}
