/**
 * TransferTab (Tokens) - the active account's tokens (STX and every SIP-10 it holds), and sending them.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Flame, RefreshCw } from 'lucide-react';
import { useSignetContext } from '~shared/context/SignetContext';
import { sendMessage } from '~shared/context/utils';
import { asError } from '~shared/errors';
import { count, locale, plural, t } from '~shared/i18n';
import { Card, ErrorText, Kv, decimalMark, editableUnits, formatUnits } from '~shared/ui';
import type { TokenBalance } from '~background/lib/tokens';
import { BALANCE_SERVICE } from '~shared/balance-service';
import { AnimatedAmount } from '~shared/AnimatedAmount';
import type { BalanceSheet } from 'blaze-sdk';

/** The token list shows at most this many decimals, cut (not rounded) */
const LIST_DECIMALS = 6;

/** What someone typed, as raw smallest units, exactly (no floating point): only this language's decimal mark */
function parseUnits(text: string, decimals: number) {
  // NFKC: a Japanese or Chinese input method in full-width mode types １．５ for 1.5
  const parts = text.normalize('NFKC').trim().split(decimalMark);
  if (parts.length > 2 || !parts.every(part => /^\d*$/.test(part)) || !parts.some(Boolean)) throw new Error(t('errorAmountLike', `1${decimalMark}5`));
  const [whole, frac = ''] = parts;
  if (frac.length > decimals) throw new Error(plural('errorMaxDecimals', decimals, count(decimals)));
  return (BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0')).toString();
}

const usd = (value: number) =>
  value.toLocaleString(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 2 });

/** Stacks and Blaze together, smallest units: the token's one balance */
const totalOf = (token: TokenBalance) => (BigInt(token.balance) + BigInt(token.blaze)).toString();

/** Whole-token amount of the whole balance (for pricing; display uses formatUnits) */
const units = (token: TokenBalance) => Number(totalOf(token)) / 10 ** token.meta!.decimals;

const label = (token: TokenBalance) => token.meta?.symbol ?? token.contractId.split('.')[1];

/** The token list's amount: at most 6 decimals */
const listAmount = (raw: string, decimals: number) => formatUnits(BigInt(raw), decimals, LIST_DECIMALS);

function TokenIcon({ token }: { token: TokenBalance }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="cx-token">
      {token.meta?.image && !broken
        ? <img src={token.meta.image} alt="" onError={() => setBroken(true)} />
        : label(token).charAt(0).toUpperCase()}
    </span>
  );
}

/** Placeholder rows shaped like token rows, while balances load */
function TokenSkeletons() {
  return (
    <div className="cx-list" aria-label={t('loadingBalances')}>
      {[48, 36, 42].map((nameWidth, i) => (
        <div key={i} className="cx-token-row" style={{ cursor: 'default' }}>
          <span className="cx-skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          <div className="cx-token-row-name" style={{ gap: 6 }}>
            <span className="cx-skeleton" style={{ width: nameWidth, height: 12 }} />
            <span className="cx-skeleton" style={{ width: nameWidth * 1.8, height: 10 }} />
          </div>
          <span className="cx-skeleton" style={{ width: 64, height: 12 }} />
        </div>
      ))}
    </div>
  );
}

function SendForm({ token, onDone, onCancel }: { token: TokenBalance; onDone: () => void; onCancel: () => void }) {
  const decimals = token.meta!.decimals;
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const toReview = () => {
    setError(null);
    try {
      if (!/^S[PM][0-9A-Z]{38,40}(\.[a-zA-Z][\w-]*)?$/.test(recipient.trim())) throw new Error(t('errorRecipient'));
      const raw = parseUnits(amount, decimals);
      if (BigInt(raw) <= 0n) throw new Error(t('errorAmountPositive'));
      if (BigInt(raw) > BigInt(token.balance)) throw new Error(t('errorYouHave', formatUnits(BigInt(token.balance), decimals), label(token)));
      setReview(raw);
    } catch (err) {
      setError(asError(err));
    }
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await sendMessage<{ txid: string }>('sendToken', { contractId: token.contractId, asset: token.asset, recipient: recipient.trim(), amount: review });
      setTxid(result.txid);
    } catch (err) {
      setError(asError(err));
    } finally {
      setBusy(false);
    }
  };

  if (txid) {
    const id = txid.startsWith('0x') ? txid : `0x${txid}`;
    return (
      <Card title={t('sentTitle', label(token))}>
        <div className="w-stack">
          <p className="w-note">{t('sentNote')}</p>
          <a className="cx-btn" href={`https://explorer.hiro.so/txid/${id}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
            {t('viewOnExplorer')} <ExternalLink size={14} aria-hidden />
          </a>
          <button type="button" className="cx-btn cx-btn-primary" onClick={onDone}>{t('done')}</button>
        </div>
      </Card>
    );
  }

  if (review) {
    return (
      <Card title={t('sendTitle', label(token))}>
        {/* The review shows the exact amount, every decimal: what leaves is never hidden by rounding */}
        <Kv label={t('send')}>{formatUnits(BigInt(review), decimals)} {label(token)}</Kv>
        <Kv label={t('to')}><span className="w-address">{recipient.trim()}</span></Kv>
        <Kv label={t('networkFee')}>{t('feeAutomatic')}</Kv>
        {token.contractId !== '.stx' && <Kv label={t('safety')} tone="success">{t('safetyExact')}</Kv>}
        <div className="w-stack" style={{ marginTop: '12px' }}>
          <ErrorText error={error} />
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => setReview(null)} disabled={busy}>{t('back')}</button>
            <button type="button" className="cx-btn cx-btn-primary" onClick={send} disabled={busy}>
              {busy && <span className="cx-spinner" aria-hidden />} {busy ? t('sending') : t('send')}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('sendTitle', label(token))}>
      <div className="w-stack">
        <label className="w-field" htmlFor="send-to">
          <span>{t('recipientLabel')}</span>
          <input id="send-to" className="w-input w-mono" placeholder="SP…" value={recipient} onChange={e => setRecipient(e.target.value)} spellCheck={false} />
        </label>
        <label className="w-field" htmlFor="send-amount">
          <span>{t('amount')}</span>
          <div className="w-input-wrap">
            <input id="send-amount" className="w-input w-mono" placeholder={`0${decimalMark}0 ${label(token)}`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
            {/* Max is the exact balance, every decimal, with this language's decimal mark and no grouping */}
            <button type="button" className="cx-chip" onClick={() => setAmount(editableUnits(BigInt(token.balance), decimals))}>{t('max')}</button>
          </div>
        </label>
        {token.blaze !== '0' && (
          <p className="w-note">{t('blazeNote', listAmount(token.balance, decimals), label(token), listAmount(token.blaze, decimals))}</p>
        )}
        <ErrorText error={error} />
        <div className="w-actions">
          <button type="button" className="cx-btn" onClick={onCancel}>{t('cancel')}</button>
          <button type="button" className="cx-btn cx-btn-primary" onClick={toReview}>{t('review')}</button>
        </div>
      </div>
    </Card>
  );
}

export function TransferTab() {
  const { currentAccount } = useSignetContext();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [showUnlisted, setShowUnlisted] = useState(false);
  const [priceError, setPriceError] = useState<Error | null>(null);

  const load = () => {
    setError(null);
    setBalances(null);
    setPriceError(null);
    sendMessage<TokenBalance[]>('getWalletBalances')
      .then(setBalances)
      .catch(err => setError(asError(err)));
    // Prices are separate: balances still show if the price feed is down
    sendMessage<Record<string, number>>('getUsdPrices')
      .then(setPrices)
      .catch(err => setPriceError(asError(err)));
  };

  /** USD value of a balance, or null when the feed has no price for it */
  const valueOf = (token: TokenBalance) => {
    const price = prices?.[token.contractId];
    return token.meta && price !== undefined ? units(token) * price : null;
  };
  const listed = balances?.filter(token => token.listed) ?? [];
  const unlisted = balances?.filter(token => !token.listed) ?? [];
  const priced = listed.map(valueOf).filter((value): value is number => value !== null);
  const total = priced.reduce((sum, value) => sum + value, 0);

  useEffect(load, [currentAccount?.stxAddress]);

  // While the tab is open, balances are pushed the moment anything changes (no polling); the browser reconnects itself
  useEffect(() => {
    const address = currentAccount?.stxAddress;
    if (!address) return;
    const stream = new EventSource(`${BALANCE_SERVICE}/api/v1/balances/${address}/stream`);
    stream.addEventListener('sheet', event => {
      const sheet = JSON.parse((event as MessageEvent<string>).data) as BalanceSheet;
      sendMessage<TokenBalance[]>('getWalletBalances', { sheet }).then(setBalances).catch(err => setError(asError(err)));
    });
    return () => stream.close();
  }, [currentAccount?.stxAddress]);

  /** One token row; unlisted and unknown tokens can't be opened for sending */
  const row = (token: TokenBalance) => {
    const key = `${token.contractId}::${token.asset}`;
    const open = selected === key;
    // Sends spend the Standard balance; a token held only on Blaze has nothing here to send
    const sendable = !!token.meta && token.listed && token.balance !== '0';
    const value = valueOf(token);
    return (
      <div key={key} className="w-stack" style={{ gap: '8px' }}>
        <div
          className="cx-token-row"
          role={sendable ? 'button' : undefined}
          tabIndex={sendable ? 0 : undefined}
          aria-selected={open}
          style={sendable ? undefined : { cursor: 'default' }}
          onClick={() => sendable && setSelected(open ? null : key)}
          onKeyDown={e => { if (sendable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelected(open ? null : key); } }}
          title={!token.listed ? t('rowUnlisted') : !token.meta ? t('rowUnknown') : sendable ? t('rowSend', label(token)) : t('rowAllOnBlaze', label(token))}
        >
          <TokenIcon token={token} />
          <div className="cx-token-row-name">
            <strong>{label(token)}</strong>
            {token.blaze !== '0' && token.meta ? (
              <span className="w-blaze-line"><Flame size={11} aria-hidden /> {t('onBlaze', listAmount(token.blaze, token.meta.decimals))}</span>
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.meta?.name ?? token.contractId}</span>
            )}
          </div>
          <div className="cx-token-row-bal">
            {token.meta
              // Rolls through approximate values, then rests on the exact amount
              ? <AnimatedAmount key={key} value={Number(totalOf(token))} format={n => listAmount(n === Number(totalOf(token)) ? totalOf(token) : String(Math.round(n)), token.meta!.decimals)} />
              : t('units', totalOf(token))}
            <span>{prices ? (value === null ? '—' : usd(value)) : ''}</span>
          </div>
        </div>
        {open && token.meta && <SendForm token={token} onCancel={() => setSelected(null)} onDone={() => { setSelected(null); load(); }} />}
      </div>
    );
  };

  return (
    <div className="w-page">
      <Card
        right={
          <button type="button" className="cx-btn w-btn-sm" onClick={load} title={t('refreshTitle')}>
            <RefreshCw size={14} aria-hidden /> {t('refresh')}
          </button>
        }
        title={t('tokensTitle')}
      >
        <div className="cx-label">{t('totalValue')}</div>
        <div className="w-total">{balances && prices ? usd(total) : '…'}</div>
        <p className="w-note">
          {balances ? plural('tokenCount', listed.length, count(listed.length)) : t('loadingBalances')}
          {balances && prices && priced.length < listed.length ? ` · ${plural('withoutPrice', listed.length - priced.length, count(listed.length - priced.length))}` : ''}
        </p>
      </Card>

      <ErrorText error={error} />
      {/* Its own lead-in, so the raw message: never "Prices unavailable: Something went wrong: …" */}
      {priceError && <p className="w-warning" role="alert">{t('pricesUnavailable', priceError.message)}</p>}
      {!balances && !error && <TokenSkeletons />}
      {balances && (
        <div className="cx-list">
          {listed.map(row)}
          {unlisted.length > 0 && (
            <button type="button" className="cx-btn cx-btn-quiet" style={{ justifyContent: 'flex-start', height: 'auto', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setShowUnlisted(open => !open)} aria-expanded={showUnlisted}>
              {showUnlisted ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
              <span>{plural('unlisted', unlisted.length, count(unlisted.length))}</span>
            </button>
          )}
          {showUnlisted && unlisted.map(row)}
        </div>
      )}
    </div>
  );
}
