/**
 * Trade: swap one token for another at the best route Charisma's swap service finds. Review shows exactly what the
 * swap does before anything is signed. Swap is the first trade style; DCA and the advanced controls join it on the
 * pill row as they're built.
 */
import { useEffect, useState } from 'react';
import { ArrowDownUp, ChevronDown, ExternalLink, RefreshCw } from 'lucide-react';
import { defaultConfig } from 'dexterity-sdk';
import { useSignetContext } from '~shared/context/SignetContext';
import { sendMessage } from '~shared/context/utils';
import { asError } from '~shared/errors';
import { t } from '~shared/i18n';
import { Card, ErrorText, Kv, decimalMark, editableUnits, formatUnits } from '~shared/ui';
import type { TokenBalance, TradeToken } from '~background/lib/tokens';
import { listAmount, parseUnits, useBalances } from '~shared/home/balances';
import { STX, buildSwap, getQuote, verifyRoute, type Route } from './swap';
import { TokenPicker } from './TokenPicker';
import { TokenPicture } from './TokenPicture';

/** The trade styles, in pill order. Swap is the first; the rest join here. */
const MODES = [{ key: 'swap', label: 'tradeSwap' }] as const;

type Side = 'from' | 'to';

export function TradeTab() {
  const { currentAccount } = useSignetContext();
  const { balances } = useBalances();
  const [tokens, setTokens] = useState<TradeToken[] | null>(null);
  const [tokenError, setTokenError] = useState<Error | null>(null);
  const [mode, setMode] = useState<'swap'>('swap');
  const [from, setFrom] = useState(STX);
  const [to, setTo] = useState<string | null>(null);
  // Standard or Blaze, per side: only for a token with a Blaze subnet (the derived values below say what applies)
  const [fromBlaze, setFromBlaze] = useState(false);
  const [toBlaze, setToBlaze] = useState(false);
  const [amount, setAmount] = useState('');
  const [picker, setPicker] = useState<Side | null>(null);
  const [quote, setQuote] = useState<Route | null>(null);
  const [quoteError, setQuoteError] = useState<Error | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    sendMessage<TradeToken[]>('getTokenList').then(setTokens).catch(err => setTokenError(asError(err)));
  }, []);

  const fromToken = tokens?.find(token => token.contractId === from);
  const toToken = tokens?.find(token => token.contractId === to);
  const fromHeld: TokenBalance | undefined = balances?.find(balance => balance.contractId === from);
  // Standard to Blaze isn't built yet, so a Blaze To needs a Blaze From
  const fromOnBlaze = fromBlaze && !!fromToken?.blaze;
  const toOnBlaze = toBlaze && fromOnBlaze && !!toToken?.blaze;
  // What the swap service sees: a Blaze side is its subnet, a Standard side is the token
  const fromId = fromOnBlaze && fromToken?.blaze ? fromToken.blaze : from;
  const toId = to && toOnBlaze && toToken?.blaze ? toToken.blaze : to;
  // What the chosen side holds: Standard or Blaze
  const fromAvailable = fromHeld && (fromOnBlaze ? fromHeld.blaze : fromHeld.balance);

  // The amount in smallest units, or why it isn't one. Nothing typed or zero is no amount yet.
  let micro: string | null = null;
  let amountError: Error | null = null;
  if (fromToken && amount.trim()) {
    try {
      const raw = parseUnits(amount, fromToken.decimals);
      if (BigInt(raw) > 0n) micro = raw;
    } catch (err) {
      amountError = asError(err);
    }
  }

  // More than the chosen side holds: a Blaze order for it would never fill, and a Standard swap would fail on chain
  const overBalance = !!micro && fromAvailable !== undefined && BigInt(micro) > BigInt(fromAvailable);

  // Quote once the amount settles, and only the latest request lands. A refresh quotes the same trade again.
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    setQuoting(false);
    if (!micro || !toId) return;
    const amountIn = micro;
    const tokenOut = toId;
    let current = true;
    const timer = setTimeout(() => {
      setQuoting(true);
      getQuote(fromId, tokenOut, amountIn)
        .then(route => { if (current) setQuote(route); })
        .catch(err => { if (current) setQuoteError(asError(err)); })
        .finally(() => { if (current) setQuoting(false); });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [fromId, toId, micro, refresh]);

  const out = quote && toToken ? formatUnits(BigInt(Math.floor(quote.amountOut)), toToken.decimals, 6) : null;
  // The least the swap may return: the router's default slippage below the quote
  const minOut = quote && toToken
    ? formatUnits(BigInt(Math.floor(quote.amountOut * (1 - defaultConfig.defaultSlippage))), toToken.decimals, 6)
    : null;
  // The route's tokens: a Blaze side's subnet is the same token as its base, so it isn't listed again
  const routePath = quote ? quote.path.filter(token => token.type !== 'SUBNET').map(token => token.symbol).join(' → ') : '';

  const flip = () => {
    if (!to) return;
    setFrom(to);
    setTo(from);
    setFromBlaze(toBlaze);
    setToBlaze(fromBlaze);
    setAmount('');
  };

  const max = () => {
    if (fromToken && fromAvailable) setAmount(editableUnits(BigInt(fromAvailable), fromToken.decimals));
  };

  /** Picking the token already on the other side swaps the two */
  const pick = (side: Side, contractId: string) => {
    setPicker(null);
    if (side === 'from') {
      if (contractId === to) setTo(from);
      setFrom(contractId);
    } else if (contractId !== from) {
      setTo(contractId);
    } else if (to) {
      setFrom(to);
      setTo(from);
    }
  };

  /**
   * Checks the quote is for this exact trade, then sends it. A Blaze trade is a signed order a solver fills; a Standard
   * trade is the router's swap, built, signed and sent by the wallet.
   */
  const swap = async () => {
    if (!quote || !micro || !currentAccount || !fromId || !toId) return;
    setSending(true);
    setSendError(null);
    try {
      const first = quote.path[0]?.contractId;
      const last = quote.path[quote.path.length - 1]?.contractId;
      if (quote.amountIn !== Number(micro) || first !== fromId || last !== toId) {
        throw new Error('The quote is for a different trade. Refresh it and review again.');
      }
      if (fromOnBlaze) {
        await sendMessage<{ uuid: string }>('placeBlazeOrder', { inputSubnet: fromId, outputToken: toId, amountIn: micro });
        setPlaced(true);
        return;
      }
      await verifyRoute(quote);
      const call = await buildSwap(quote, currentAccount.stxAddress);
      const result = await sendMessage<{ txid: string }>('sendSwap', call);
      setTxid(result.txid);
    } catch (err) {
      setSendError(asError(err));
    } finally {
      setSending(false);
    }
  };

  const done = () => {
    setTxid(null);
    setPlaced(false);
    setReviewing(false);
    setAmount('');
  };

  const form = (
    <>
      <Card title={t('tradeFrom')}>
        <div className="w-stack">
          <div className="w-trade-row">
            <button type="button" className="w-token-select" onClick={() => setPicker('from')}>
              {fromToken && <TokenPicture image={fromToken.image} symbol={fromToken.symbol} className="w-token-icon" />}{fromToken ? fromToken.symbol : t('tradeSelectToken')} <ChevronDown size={16} aria-hidden />
            </button>
            <input
              className="w-input w-mono w-amount-input"
              inputMode="decimal"
              placeholder={`0${decimalMark}0`}
              aria-label={t('amount')}
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          {fromToken?.blaze && <NetworkChoice blaze={fromOnBlaze} onChange={setFromBlaze} />}
          <div className="w-trade-meta">
            <span>{fromAvailable !== undefined && fromToken ? t('tradeBalance', `${listAmount(fromAvailable, fromToken.decimals)} ${fromToken.symbol}`) : ''}</span>
            {fromAvailable && fromAvailable !== '0' && <button type="button" className="cx-chip" onClick={max}>{t('max')}</button>}
          </div>
          <ErrorText error={amountError ?? (overBalance ? new Error(t('tradeOverBalance')) : null)} />
        </div>
      </Card>

      <div className="w-flip-row">
        <button type="button" className="w-flip" onClick={flip} disabled={!to} aria-label={t('tradeFlip')} title={t('tradeFlip')}>
          <ArrowDownUp size={18} aria-hidden />
        </button>
      </div>

      <Card title={t('tradeTo')}>
        <div className="w-stack">
          <div className="w-trade-row">
            <button type="button" className="w-token-select" onClick={() => setPicker('to')}>
              {toToken && <TokenPicture image={toToken.image} symbol={toToken.symbol} className="w-token-icon" />}{toToken ? toToken.symbol : t('tradeSelectToken')} <ChevronDown size={16} aria-hidden />
            </button>
            <output className="w-trade-out">{quoting ? '…' : out ?? '—'}</output>
          </div>
          {toToken?.blaze && (
            <NetworkChoice
              blaze={toOnBlaze}
              onChange={setToBlaze}
              blazeDisabled={!fromOnBlaze}
              blazeDisabledTitle={t('tradeBlazeNeedsFrom')}
            />
          )}
          {quote && <p className="w-note">{t('tradeRoute', routePath)}</p>}
          <ErrorText error={quoteError} />
        </div>
      </Card>

      <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={() => setReviewing(true)} disabled={!quote || quoting || overBalance}>
        {t('tradeReview')}
      </button>
    </>
  );

  const review = (
    <Card title={t('tradeReviewTitle')}>
      <div className="w-stack">
        <Kv label={t('tradeYouSend')}>{micro && fromToken ? `${formatUnits(BigInt(micro), fromToken.decimals)} ${fromToken.symbol}` : '…'}</Kv>
        <Kv label={t('tradeYouGet')}>{out && toToken ? `${out} ${toToken.symbol}` : '…'}</Kv>
        {/* A Blaze order has no minimum: its price is only the quote's, so the review doesn't promise one */}
        {!fromOnBlaze && <Kv label={t('tradeAtLeast')}>{minOut && toToken ? `${minOut} ${toToken.symbol}` : '…'}</Kv>}
        <Kv label={t('tradeRouteLabel')}><span className="w-address">{routePath || '…'}</span></Kv>
        <Kv label={t('tradeNetworks')}>{`${networkName(fromOnBlaze)} → ${networkName(toOnBlaze)}`}</Kv>
        <Kv label={t('networkFee')}>{fromOnBlaze ? t('tradeOrderNoFee') : t('feeAutomatic')}</Kv>
        {fromOnBlaze
          ? <Kv label={t('safety')}>{t('tradeOrderNote')}</Kv>
          : <Kv label={t('safety')} tone="success">{t('tradePoolsChecked')}</Kv>}
        <div className="w-stack" style={{ marginTop: '12px' }}>
          <ErrorText error={sendError} />
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => setReviewing(false)} disabled={sending}>{t('back')}</button>
            <button type="button" className="cx-btn w-btn-sm" onClick={() => setRefresh(n => n + 1)} disabled={sending || quoting}>
              <RefreshCw size={14} aria-hidden /> {t('tradeRefresh')}
            </button>
          </div>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={swap} disabled={!quote || quoting || sending}>
            {sending && <span className="cx-spinner" aria-hidden />} {sending ? t('sending') : fromOnBlaze ? t('tradePlaceOrder') : t('tradeSwapButton')}
          </button>
        </div>
      </div>
    </Card>
  );

  const sent = (id: string) => {
    const hash = id.startsWith('0x') ? id : `0x${id}`;
    return (
      <Card title={t('tradeSwapSent')}>
        <div className="w-stack">
          <p className="w-note">{t('sentNote')}</p>
          <a className="cx-btn" href={`https://explorer.hiro.so/txid/${hash}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
            {t('viewOnExplorer')} <ExternalLink size={14} aria-hidden />
          </a>
          <button type="button" className="cx-btn cx-btn-primary" onClick={done}>{t('done')}</button>
        </div>
      </Card>
    );
  };

  const placedCard = (
    <Card title={t('tradeOrderPlaced')}>
      <div className="w-stack">
        <p className="w-note">{t('tradeOrderSent')}</p>
        <button type="button" className="cx-btn cx-btn-primary" onClick={done}>{t('done')}</button>
      </div>
    </Card>
  );

  return (
    <div className="w-page">
      <div className="w-pills" role="tablist">
        {MODES.map(({ key, label }) => (
          <button key={key} type="button" role="tab" className="w-pill" aria-selected={mode === key} onClick={() => setMode(key)}>
            {t(label)}
          </button>
        ))}
      </div>

      <ErrorText error={tokenError} />

      {txid ? sent(txid) : placed ? placedCard : picker && tokens ? (
        <TokenPicker tokens={tokens} balances={balances} onPick={contractId => pick(picker, contractId)} onCancel={() => setPicker(null)} />
      ) : reviewing ? review : form}
    </div>
  );
}

/** A side's network, as the review names it */
function networkName(blaze: boolean) {
  return blaze ? t('tradeBlaze') : t('tradeStandard');
}

/** Standard or Blaze for one side of the trade; shown only for a token with a Blaze subnet */
function NetworkChoice({ blaze, onChange, blazeDisabled = false, blazeDisabledTitle }: {
  blaze: boolean;
  onChange: (blaze: boolean) => void;
  blazeDisabled?: boolean;
  blazeDisabledTitle?: string;
}) {
  return (
    <div className="w-pills" role="tablist">
      <button type="button" role="tab" className="w-pill" aria-selected={!blaze} onClick={() => onChange(false)}>
        {t('tradeStandard')}
      </button>
      <button
        type="button"
        role="tab"
        className="w-pill"
        aria-selected={blaze}
        disabled={blazeDisabled}
        title={blazeDisabled ? blazeDisabledTitle : undefined}
        onClick={() => onChange(true)}
      >
        {t('tradeBlaze')}
      </button>
    </div>
  );
}
