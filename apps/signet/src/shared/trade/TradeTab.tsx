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

  useEffect(() => {
    sendMessage<TradeToken[]>('getTokenList').then(setTokens).catch(err => setTokenError(asError(err)));
  }, []);

  const fromToken = tokens?.find(token => token.contractId === from);
  const toToken = tokens?.find(token => token.contractId === to);
  const fromHeld: TokenBalance | undefined = balances?.find(balance => balance.contractId === from);

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

  // Quote once the amount settles, and only the latest request lands. A refresh quotes the same trade again.
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    setQuoting(false);
    if (!micro || !to) return;
    const amountIn = micro;
    const tokenOut = to;
    let current = true;
    const timer = setTimeout(() => {
      setQuoting(true);
      getQuote(from, tokenOut, amountIn)
        .then(route => { if (current) setQuote(route); })
        .catch(err => { if (current) setQuoteError(asError(err)); })
        .finally(() => { if (current) setQuoting(false); });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [from, to, micro, refresh]);

  const out = quote && toToken ? formatUnits(BigInt(Math.floor(quote.amountOut)), toToken.decimals, 6) : null;
  // The least the swap may return: the router's default slippage below the quote
  const minOut = quote && toToken
    ? formatUnits(BigInt(Math.floor(quote.amountOut * (1 - defaultConfig.defaultSlippage))), toToken.decimals, 6)
    : null;
  const routePath = quote ? quote.path.map(token => token.symbol).join(' → ') : '';

  const flip = () => {
    if (!to) return;
    setFrom(to);
    setTo(from);
    setAmount('');
  };

  const max = () => {
    if (fromToken && fromHeld) setAmount(editableUnits(BigInt(fromHeld.balance), fromToken.decimals));
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

  /** Checks the quote is for this exact trade, then has the wallet build, sign and send the router's swap */
  const swap = async () => {
    if (!quote || !micro || !currentAccount) return;
    setSending(true);
    setSendError(null);
    try {
      const first = quote.path[0]?.contractId;
      const last = quote.path[quote.path.length - 1]?.contractId;
      if (quote.amountIn !== Number(micro) || first !== from || last !== to) {
        throw new Error('The quote is for a different trade. Refresh it and review again.');
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
    setReviewing(false);
    setAmount('');
  };

  const form = (
    <>
      <Card title={t('tradeFrom')}>
        <div className="w-stack">
          <div className="w-trade-row">
            <button type="button" className="w-token-select" onClick={() => setPicker('from')}>
              {fromToken ? fromToken.symbol : t('tradeSelectToken')} <ChevronDown size={16} aria-hidden />
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
          <div className="w-trade-meta">
            <span>{fromHeld && fromToken ? t('tradeBalance', `${listAmount(fromHeld.balance, fromToken.decimals)} ${fromToken.symbol}`) : ''}</span>
            {fromHeld && fromHeld.balance !== '0' && <button type="button" className="cx-chip" onClick={max}>{t('max')}</button>}
          </div>
          <ErrorText error={amountError} />
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
              {toToken ? toToken.symbol : t('tradeSelectToken')} <ChevronDown size={16} aria-hidden />
            </button>
            <output className="w-trade-out">{quoting ? '…' : out ?? '—'}</output>
          </div>
          {quote && <p className="w-note">{t('tradeRoute', routePath)}</p>}
          <ErrorText error={quoteError} />
        </div>
      </Card>

      <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={() => setReviewing(true)} disabled={!quote || quoting}>
        {t('tradeReview')}
      </button>
    </>
  );

  const review = (
    <Card title={t('tradeReviewTitle')}>
      <div className="w-stack">
        <Kv label={t('tradeYouSend')}>{micro && fromToken ? `${formatUnits(BigInt(micro), fromToken.decimals)} ${fromToken.symbol}` : '…'}</Kv>
        <Kv label={t('tradeYouGet')}>{out && toToken ? `${out} ${toToken.symbol}` : '…'}</Kv>
        <Kv label={t('tradeAtLeast')}>{minOut && toToken ? `${minOut} ${toToken.symbol}` : '…'}</Kv>
        <Kv label={t('tradeRouteLabel')}><span className="w-address">{routePath || '…'}</span></Kv>
        <Kv label={t('networkFee')}>{t('feeAutomatic')}</Kv>
        <Kv label={t('safety')} tone="success">{t('tradePoolsChecked')}</Kv>
        <div className="w-stack" style={{ marginTop: '12px' }}>
          <ErrorText error={sendError} />
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => setReviewing(false)} disabled={sending}>{t('back')}</button>
            <button type="button" className="cx-btn w-btn-sm" onClick={() => setRefresh(n => n + 1)} disabled={sending || quoting}>
              <RefreshCw size={14} aria-hidden /> {t('tradeRefresh')}
            </button>
          </div>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={swap} disabled={!quote || quoting || sending}>
            {sending && <span className="cx-spinner" aria-hidden />} {sending ? t('sending') : t('tradeSwapButton')}
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

      {txid ? sent(txid) : picker && tokens ? (
        <TokenPicker tokens={tokens} balances={balances} onPick={contractId => pick(picker, contractId)} onCancel={() => setPicker(null)} />
      ) : reviewing ? review : form}
    </div>
  );
}
