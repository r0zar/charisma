/**
 * The active account's balances and prices for Home: a fresh read on each load, then pushed live by the balance
 * service while the wallet is open (no polling). Also the money math the total and the token list share.
 */
import { useEffect, useState } from "react";
import { useSignetContext } from "~shared/context/SignetContext";
import { sendMessage } from "~shared/context/utils";
import { asError } from "~shared/errors";
import { count, locale, plural, t } from "~shared/i18n";
import { decimalMark, formatUnits } from "~shared/ui";
import { BALANCE_SERVICE } from "~shared/balance-service";
import type { TokenBalance } from "~background/lib/tokens";
import type { BalanceSheet } from "blaze-sdk";

export type Prices = Record<string, { usd: number; change24h: number | null }>;

/** Stacks and Blaze together, smallest units: the token's one balance */
export const totalOf = (token: TokenBalance) => (BigInt(token.balance) + BigInt(token.blaze)).toString();

/** Whole-token amount of the whole balance (for pricing; display uses formatUnits) */
export const units = (token: TokenBalance) => Number(totalOf(token)) / 10 ** token.meta!.decimals;

export const label = (token: TokenBalance) => token.meta?.symbol ?? token.contractId.split(".")[1];

/** Smallest units as the token list shows them: at most 6 decimals, cut (not rounded) */
export const listAmount = (raw: string, decimals: number) => formatUnits(BigInt(raw), decimals, 6);

export const usd = (value: number) =>
  value.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 4 : 2 });

/** What someone typed, as raw smallest units, exactly (no floating point): only this language's decimal mark */
export function parseUnits(text: string, decimals: number) {
  // NFKC: a Japanese or Chinese input method in full-width mode types １．５ for 1.5. Its ideographic full stop 。
  // means the same where the decimal mark is a point.
  const normalized = text.normalize("NFKC");
  const parts = (decimalMark === "." ? normalized.replaceAll("。", ".") : normalized).trim().split(decimalMark);
  if (parts.length > 2 || !parts.every(part => /^\d*$/.test(part)) || !parts.some(Boolean)) throw new Error(t("errorAmountLike", `1${decimalMark}5`));
  const [whole, frac = ""] = parts;
  if (frac.length > decimals) throw new Error(plural("errorMaxDecimals", decimals, count(decimals)));
  return (BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0")).toString();
}

/**
 * The listed tokens' total value in USD, and their change over 24h: each token's change is taken off its price
 * now, so the change is in dollars and percent of what the balances were worth a day ago. Tokens the price feed
 * has no 24h change for count in the total but not in the change.
 */
export function portfolioOf(balances: TokenBalance[], prices: Prices) {
  let total = 0;
  let now = 0;
  let before = 0;
  for (const token of balances) {
    const price = prices[token.contractId];
    if (!token.listed || !token.meta || !price) continue;
    const value = units(token) * price.usd;
    total += value;
    if (price.change24h !== null) {
      now += value;
      before += value / (1 + price.change24h / 100);
    }
  }
  return { total, change: now - before, changePercent: before > 0 ? ((now - before) / before) * 100 : null };
}

export function useBalances() {
  const { currentAccount } = useSignetContext();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [priceError, setPriceError] = useState<Error | null>(null);

  const load = () => {
    setError(null);
    setBalances(null);
    setPriceError(null);
    sendMessage<TokenBalance[]>("getWalletBalances")
      .then(setBalances)
      .catch(err => setError(asError(err)));
    // Prices are separate: balances still show if the price feed is down
    sendMessage<Prices>("getUsdPrices")
      .then(setPrices)
      .catch(err => setPriceError(asError(err)));
  };

  useEffect(load, [currentAccount?.stxAddress]);

  // While the wallet is open, balances are pushed the moment anything changes; the browser reconnects itself
  useEffect(() => {
    const address = currentAccount?.stxAddress;
    if (!address) return;
    const stream = new EventSource(`${BALANCE_SERVICE}/api/v1/balances/${address}/stream`);
    stream.addEventListener("sheet", event => {
      const sheet = JSON.parse((event as MessageEvent<string>).data) as BalanceSheet;
      sendMessage<TokenBalance[]>("getWalletBalances", { sheet }).then(setBalances).catch(err => setError(asError(err)));
    });
    return () => stream.close();
  }, [currentAccount?.stxAddress]);

  return { balances, prices, error, priceError, load };
}
