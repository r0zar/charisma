/**
 * Golden test vectors for the iOS app's StacksKit, made with the extension's own libraries (@stacks/wallet-sdk,
 * @stacks/transactions, @scure/bip39) at the versions pnpm-lock.yaml gives apps/signet. StacksKit must match every byte.
 *
 * Run from the repo root: node apps/signet/scripts/ios-vectors.mjs
 * It needs @stacks/transactions 7.6.0, @stacks/wallet-sdk 7.1.2, @stacks/network 7.6.0 and @scure/bip39 1.6.0 to
 * resolve from apps/signet (its own node_modules, or a throwaway install linked there).
 * Writes two committed files:
 *   apps/blaze-ios/BlazeKit/Tests/StacksKitTests/vectors.json
 *   apps/blaze-ios/BlazeKit/Sources/StacksKit/BIP39English.swift
 * The seed phrases are public BIP39 test phrases: never send funds to their addresses.
 */
import { writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english"
import { STACKS_MAINNET } from "@stacks/network"
import {
  AuthType,
  Cl,
  Pc,
  addressFromVersionHash,
  addressToString,
  createAddress,
  estimateTransactionByteLength,
  makeContractCall,
  makeSTXTokenTransfer,
  privateKeyToPublic,
  serializePayload,
  sigHashPreSign
} from "@stacks/transactions"
import { generateNewAccount, generateWallet, getStxAddress } from "@stacks/wallet-sdk"

const kit = join(dirname(fileURLToPath(import.meta.url)), "../../blaze-ios/BlazeKit")

/** The versions pnpm-lock.yaml gives apps/signet: the vectors must come from what the extension ships */
const LOCKED = { "@stacks/transactions": "7.6.0", "@stacks/wallet-sdk": "7.1.2", "@stacks/network": "7.6.0", "@scure/bip39": "1.6.0" }
const require = createRequire(import.meta.url)
for (const [name, version] of Object.entries(LOCKED)) {
  const found = require(`../node_modules/${name}/package.json`).version
  if (found !== version) throw new Error(`${name} is ${found} here, but the extension ships ${version}. Install the locked version.`)
}

/** All-zero entropy at every BIP39 length: 12, 15, 18, 21 and 24 words ("abandon … about" to "abandon … art") */
const PHRASES = [16, 20, 24, 28, 32].map(bytes => entropyToMnemonic(new Uint8Array(bytes), wordlist))

/** Accounts 0–4 of a phrase, exactly as the extension creates them (background/lib/wallet/seed.ts) */
async function accountsOf(phrase) {
  let wallet = await generateWallet({ secretKey: phrase, password: "" })
  while (wallet.accounts.length < 5) wallet = generateNewAccount(wallet)
  return wallet.accounts.map(account => ({
    index: account.index,
    privateKey: account.stxPrivateKey,
    publicKey: privateKeyToPublic(account.stxPrivateKey),
    address: getStxAddress(account, STACKS_MAINNET)
  }))
}

const phrases = []
for (const phrase of PHRASES) {
  phrases.push({ phrase, seed: Buffer.from(mnemonicToSeedSync(phrase)).toString("hex"), accounts: await accountsOf(phrase) })
}

const sender = phrases[0].accounts[0]
const STANDARD = phrases[0].accounts[1].address
const CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2"
const TOKEN = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"
const ASSET = "charisma"
const NONCE = 7n
const FEE = 180n

/** Everything StacksKit has to reproduce for one transaction, intermediate hashes included for debugging */
function vector(name, fields, tx) {
  const sighash = tx.signBegin()
  return {
    name,
    ...fields,
    senderKey: sender.privateKey,
    nonce: NONCE.toString(),
    fee: FEE.toString(),
    payload: serializePayload(tx.payload),
    estimatedLength: estimateTransactionByteLength(tx),
    sighash,
    presign: sigHashPreSign(sighash, AuthType.Standard, FEE, NONCE),
    serialized: tx.serialize(),
    txid: tx.txid()
  }
}

/** As background/lib/tokens.ts sendToken builds an STX send */
async function stxTransfer(name, recipient, amount) {
  const tx = await makeSTXTokenTransfer({ recipient, amount, memo: "", senderKey: sender.privateKey, network: "mainnet", nonce: NONCE, fee: FEE })
  return vector(name, { kind: "stx", recipient, amount: amount.toString() }, tx)
}

/** As background/lib/tokens.ts sendToken builds a SIP-010 send */
async function sip10Transfer(name, recipient, amount) {
  const [contractAddress, contractName] = TOKEN.split(".")
  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName: "transfer",
    functionArgs: [Cl.uint(amount), Cl.principal(sender.address), Cl.principal(recipient), Cl.none()],
    postConditions: [Pc.principal(sender.address).willSendEq(amount).ft(TOKEN, ASSET)],
    postConditionMode: "deny",
    senderKey: sender.privateKey,
    network: "mainnet",
    nonce: NONCE,
    fee: FEE
  })
  return vector(name, { kind: "sip10", contract: TOKEN, asset: ASSET, recipient, amount: amount.toString() }, tx)
}

const transactions = [
  await stxTransfer("stx-to-standard", STANDARD, 1_000_000n),
  await stxTransfer("stx-to-contract", CONTRACT, 2_500_000n),
  await sip10Transfer("sip10-to-standard", STANDARD, 123_456_789n),
  await sip10Transfer("sip10-to-contract", CONTRACT, 42n)
]

const addresses = [
  "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
  addressToString(addressFromVersionHash(20, "a46ff88886c2ef9762d970b4d2c63678835bd39d")),
  addressToString(addressFromVersionHash(22, "0000000000000000000000000000000000000000"))
].map(address => {
  const { version, hash160 } = createAddress(address)
  return { address, version, hash160 }
})

const UINT_MAX = 2n ** 128n - 1n
const clarity = [
  { name: "uint", hex: Cl.serialize(Cl.uint(123_456_789n)), value: "123456789" },
  { name: "uint-max", hex: Cl.serialize(Cl.uint(UINT_MAX)), value: UINT_MAX.toString() },
  { name: "ok-uint", hex: Cl.serialize(Cl.ok(Cl.uint(42n))), value: "42" },
  { name: "none", hex: Cl.serialize(Cl.none()) },
  { name: "principal-standard", hex: Cl.serialize(Cl.principal(sender.address)), value: sender.address },
  { name: "principal-contract", hex: Cl.serialize(Cl.principal(CONTRACT)), value: CONTRACT }
]

writeFileSync(join(kit, "Tests/StacksKitTests/vectors.json"), `${JSON.stringify({ phrases, transactions, addresses, clarity }, null, 2)}\n`)
writeFileSync(
  join(kit, "Sources/StacksKit/BIP39English.swift"),
  "// Generated by apps/signet/scripts/ios-vectors.mjs from @scure/bip39's English list. Don't edit by hand.\n\n" +
    "/// The 2048 BIP39 English words, in order\n" +
    `let bip39English: [String] = [\n${wordlist.map(word => `    "${word}",`).join("\n")}\n]\n`
)
console.log(`Wrote ${phrases.length} phrases, ${transactions.length} transactions, ${addresses.length} addresses, ${clarity.length} Clarity values, ${wordlist.length} words`)
