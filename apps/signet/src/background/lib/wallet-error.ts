/**
 * A failure the wallet's own pages show to the person: a message key and its fill-ins, so each page words it in
 * its own language. `message` is the English text, for everything else that reads it (logs, and the JSON-RPC
 * errors websites get, which stay English for developers).
 */
import { format, type Fill } from "~shared/i18n-core"

export class WalletError extends Error {
  constructor(readonly key: string, readonly fills: Fill[] = []) {
    super(format("en", key, fills))
    this.name = "WalletError"
  }
}

/** What crosses from the background to a page: a key to word, or a message from a library or a server */
export type WireError = { key: string; fills: Fill[] } | { message: string }

export const toWire = (error: unknown): WireError =>
  error instanceof WalletError ? { key: error.key, fills: error.fills } : { message: error instanceof Error ? error.message : String(error) }
