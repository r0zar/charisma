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
  signStructuredData,
  type ClarityValue
} from "@stacks/transactions"
import * as wallet from "./wallet"
import { hiroClient } from "./hiro"

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

/** Most orders one bulk approval may sign (a year of hourly buys is under 9,000) */
const MAX_BULK = 10_000

/**
 * The Blaze protocol's SIP-018 domains, serialized: blaze-sdk's BLAZE_V1_DOMAIN and BLAZE_V2_DOMAIN. Written out
 * here because blaze-sdk's entry pulls in @stacks/connect, which a service worker can't load.
 */
const blazeDomain = (version: string) => Cl.serialize(Cl.tuple({ name: Cl.stringAscii("BLAZE_PROTOCOL"), version: Cl.stringAscii(version), "chain-id": Cl.uint(1) }))
const BLAZE_DOMAINS = [blazeDomain("v1.0"), blazeDomain("v2.0")]

/** blaze-sdk's SIGNER_ONLY_ROUTERS (x-multihop-v2, x-multihop-v1): they pay out only to whoever signed the order */
const SIGNER_ONLY_ROUTERS = [
  "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2",
  "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1"
]

/** A swap order, as blaze-sdk's signTriggeredSwaps makes them: an amount, spent only through a router that pays the signer */
function isSwapOrder(message: ClarityValue) {
  if (message.type !== "tuple") return false
  const { intent, opcode, amount, target } = message.value
  return intent?.type === "ascii" && intent.value === "TRANSFER_TOKENS"
    && opcode?.type === "none"
    && amount?.type === "some" && amount.value.type === "uint"
    && target?.type === "some" && target.value.type === "contract" && SIGNER_ONLY_ROUTERS.includes(target.value.value)
}

const CONNECT_METHODS = ["getAddresses", "stx_getAddresses", "wallet_connect"]
const TX_METHODS = ["stx_transferStx", "stx_callContract"]

/** Transaction params as @stacks/connect sends them: Clarity args and post conditions hex-serialized */
interface TxParams {
  network?: string
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
  // Only the words the card shows: the library also reads other values (e.g. 1) as allow mode
  if (p.postConditionMode !== undefined && p.postConditionMode !== "allow" && p.postConditionMode !== "deny") {
    throw new Error('postConditionMode must be "allow" or "deny"')
  }
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

/**
 * Ask the user in the tab that made the request; resolves with their answer. One card per tab at a time,
 * so a site can't stack them up.
 */
function askUser(request: ApprovalRequest, sender: chrome.runtime.MessageSender): Promise<boolean> {
  const requestId = crypto.randomUUID()
  const tabId = sender.tab!.id!
  const frameId = sender.frameId ?? 0
  if ([...pending.values()].some(p => p.tabId === tabId)) {
    return Promise.reject(new Error("Blaze Wallet is already asking you something in this tab: answer that first"))
  }
  return new Promise((resolve, reject) => {
    pending.set(requestId, { ...request, tabId, frameId, decide: resolve })
    chrome.tabs.sendMessage(tabId, { type: "signet-show-approval", requestId }, { frameId }).catch(error => {
      pending.delete(requestId)
      reject(new Error(`Blaze Wallet couldn't show its approval card in this tab: ${error.message}`))
    })
  })
}

/** A tab that closes or loads a new page with a card open has said no */
function rejectTab(tabId: number) {
  for (const [requestId, request] of pending) {
    if (request.tabId !== tabId) continue
    pending.delete(requestId)
    request.decide(false)
  }
}
chrome.tabs.onRemoved.addListener(rejectTab)
chrome.tabs.onUpdated.addListener((tabId, change) => { if (change.status === "loading") rejectTab(tabId) })

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

    // The wallet sets the fee and nonce itself, as the card says: a site's fee or nonce is ignored
    const common = { senderKey: account.privateKey, network: "mainnet" as const, client: hiroClient }
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
    const result = await broadcastTransaction({ transaction, network: "mainnet", client: hiroClient })
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
    // SIP-018 structured data, the format Blaze recovers signers from
    const signature = signStructuredData({ ...parsed, privateKey: account.privateKey })
    return reply({ signature, publicKey: account.publicKey })
  }

  if (message.method === "blaze_signStructuredMessages") {
    // Many Blaze orders from one approval (WALLET-SPEC.md): hex-serialized like stx_signStructuredMessage
    const { messages, domain } = (message.params ?? {}) as { messages?: unknown; domain?: unknown }
    if (typeof domain !== "string" || !Array.isArray(messages) || messages.length === 0 || messages.some(m => typeof m !== "string")) {
      return fail(InvalidParams, "blaze_signStructuredMessages needs a hex-serialized domain and a list of hex-serialized messages")
    }
    if (messages.length > MAX_BULK) return fail(InvalidParams, `Blaze Wallet signs at most ${MAX_BULK} orders at once`)
    let parsed: { domain: ReturnType<typeof Cl.deserialize>; messages: ReturnType<typeof Cl.deserialize>[] }
    try {
      parsed = { domain: Cl.deserialize(domain), messages: (messages as string[]).map(m => Cl.deserialize(m)) }
    } catch (error) {
      return fail(InvalidParams, `Could not read the orders: ${(error as Error).message}`)
    }
    // Only Blaze swap orders: the card sums what they can spend, and each can pay out only to the signer
    if (!BLAZE_DOMAINS.includes(Cl.serialize(parsed.domain))) {
      return fail(InvalidParams, "blaze_signStructuredMessages only signs Blaze protocol orders")
    }
    if (!parsed.messages.every(isSwapOrder)) {
      return fail(InvalidParams, "blaze_signStructuredMessages only signs swap orders that pay out to the signer (TRANSFER_TOKENS with an amount, through x-multihop-v2 or x-multihop-v1)")
    }
    if (!(await askUser(request, sender))) return fail(UserRejection, "User rejected the signatures")
    const account = await wallet.getCurrentAccount()
    if (!account) return fail(InternalError, "Blaze Wallet has no active account")
    const signatures = parsed.messages.map(data => signStructuredData({ message: data, domain: parsed.domain, privateKey: account.privateKey }))
    return reply({ signatures, publicKey: account.publicKey })
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
      // Approving is activity: it keeps the wallet from locking for another 15 minutes
      if (message.approved) await wallet.keepAwake()
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
