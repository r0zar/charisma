/**
 * Errors as the wallet's pages hold and show them. Pages keep the Error itself (not its message), so ErrorText can
 * tell the background's worded errors from unexpected ones, which get the "Something went wrong:" lead-in.
 */
import type { WireError } from "~background/lib/wallet-error"
import { t } from "./i18n"

/** Text from a library or a server, shown as-is after a translated lead-in */
export class UnexpectedError extends Error {
  readonly unexpected = true
}

/** A background error, worded in the page's language */
export const fromWire = (error: WireError | undefined): Error =>
  !error ? new UnexpectedError(t("errorNoAnswer")) : "key" in error ? new Error(t(error.key, ...error.fills)) : new UnexpectedError(error.message)

/** Anything caught, as an Error */
export const asError = (error: unknown): Error =>
  error instanceof Error ? error : new UnexpectedError(String(error))

/** An error as one line: unexpected ones lead in with "Something went wrong:" */
export const describeError = (error: Error) => (error instanceof UnexpectedError ? t("errorUnexpected", error.message) : error.message)
