/**
 * TransferTab (Tokens) - the active account's tokens (STX and every SIP-10 it holds), and sending them.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Flame, RefreshCw } from 'lucide-react';
import { useSignetContext } from '~shared/context/SignetContext';
import { sendMessage } from '~shared/context/utils';
import { Card, ErrorText, Kv } from '~shared/ui';
import type { TokenBalance } from '~background/lib/tokens';
import { BALANCE_SERVICE } from '~shared/balance-service';
import { AnimatedAmount } from '~shared/AnimatedAmount';
import type { BalanceSheet } from 'blaze-sdk';

/** Raw smallest units → "1,234.5678" */
function formatUnits(raw: string, decimals: number): string {
  const value = BigInt(raw);
  // Instant balances go below zero when signed orders promise more than the wallet holds
  if (value < 0n) return `-${formatUnits((-value).toString(), decimals)}`;
  const whole = value / 10n ** BigInt(decimals);
  const frac = (value % 10n ** BigInt(decimals)).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toLocaleString('en-US')}${frac ? `.${frac.slice(0, 6)}` : ''}`;
}

/** "1.5" → raw smallest units, exactly (no floating point); throws on bad input */
function parseUnits(text: string, decimals: number) {
  if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') throw new Error('Enter an amount like 1.5');
  const [whole, frac = ''] = text.split('.');
  if (frac.length > decimals) throw new Error(`At most ${decimals} decimal places`);
  return (BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0')).toString();
}

const usd = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 2 });

/** Stacks and Blaze together, smallest units: the token's one balance */
const totalOf = (token: TokenBalance) => (BigInt(token.balance) + BigInt(token.blaze)).toString();

/** Whole-token amount of the whole balance (for pricing; display uses formatUnits) */
const units = (token: TokenBalance) => Number(totalOf(token)) / 10 ** token.meta!.decimals;

const label = (token: TokenBalance) => token.meta?.symbol ?? token.contractId.split('.')[1];

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
    <div className="cx-list" aria-label="Loading balances">
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
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const toReview = () => {
    setError(null);
    try {
      if (!/^S[PM][0-9A-Z]{38,40}(\.[a-zA-Z][\w-]*)?$/.test(recipient.trim())) throw new Error('Enter a Stacks address (SP…)');
      const raw = parseUnits(amount, decimals);
      if (BigInt(raw) <= 0n) throw new Error('Amount must be more than zero');
      if (BigInt(raw) > BigInt(token.balance)) throw new Error(`You have ${formatUnits(token.balance, decimals)} ${label(token)}`);
      setReview(raw);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await sendMessage<{ txid: string }>('sendToken', { contractId: token.contractId, asset: token.asset, recipient: recipient.trim(), amount: review });
      setTxid(result.txid);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (txid) {
    const id = txid.startsWith('0x') ? txid : `0x${txid}`;
    return (
      <Card title={`${label(token)} sent`}>
        <div className="w-stack">
          <p className="w-note">It confirms on Stacks in a few minutes.</p>
          <a className="cx-btn" href={`https://explorer.hiro.so/txid/${id}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
            View on explorer <ExternalLink size={14} aria-hidden />
          </a>
          <button type="button" className="cx-btn cx-btn-primary" onClick={onDone}>Done</button>
        </div>
      </Card>
    );
  }

  if (review) {
    return (
      <Card title={`Send ${label(token)}`}>
        <Kv label="Send">{formatUnits(review, decimals)} {label(token)}</Kv>
        <Kv label="To"><span className="w-address">{recipient.trim()}</span></Kv>
        <Kv label="Network fee">Set automatically</Kv>
        {token.contractId !== '.stx' && <Kv label="Safety" tone="success">Exactly this amount, nothing else</Kv>}
        <div className="w-stack" style={{ marginTop: '12px' }}>
          <ErrorText error={error} />
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => setReview(null)} disabled={busy}>Back</button>
            <button type="button" className="cx-btn cx-btn-primary" onClick={send} disabled={busy}>
              {busy && <span className="cx-spinner" aria-hidden />} {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title={`Send ${label(token)}`}>
      <div className="w-stack">
        <label className="w-field" htmlFor="send-to">
          <span>Recipient</span>
          <input id="send-to" className="w-input w-mono" placeholder="SP…" value={recipient} onChange={e => setRecipient(e.target.value)} spellCheck={false} />
        </label>
        <label className="w-field" htmlFor="send-amount">
          <span>Amount</span>
          <div className="w-input-wrap">
            <input id="send-amount" className="w-input w-mono" placeholder={`0.0 ${label(token)}`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
            <button type="button" className="cx-chip" onClick={() => setAmount(formatUnits(token.balance, decimals).replace(/,/g, ''))}>Max</button>
          </div>
        </label>
        {token.blaze !== '0' && (
          <p className="w-note">Sends use your {formatUnits(token.balance, decimals)} {label(token)} on Stacks. Your {formatUnits(token.blaze, decimals)} on Blaze stays in its subnet; move it with Charisma Swap.</p>
        )}
        <ErrorText error={error} />
        <div className="w-actions">
          <button type="button" className="cx-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="cx-btn cx-btn-primary" onClick={toReview}>Review</button>
        </div>
      </div>
    </Card>
  );
}

export function TransferTab() {
  const { currentAccount } = useSignetContext();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [showUnlisted, setShowUnlisted] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setBalances(null);
    setPriceError(null);
    sendMessage<TokenBalance[]>('getWalletBalances')
      .then(setBalances)
      .catch(err => setError(err.message));
    // Prices are separate: balances still show if the price feed is down
    sendMessage<Record<string, number>>('getUsdPrices')
      .then(setPrices)
      .catch(err => setPriceError(err.message));
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
      sendMessage<TokenBalance[]>('getWalletBalances', { sheet }).then(setBalances).catch(err => setError(err.message));
    });
    return () => stream.close();
  }, [currentAccount?.stxAddress]);

  /** One token row; unlisted and unknown tokens can't be opened for sending */
  const row = (token: TokenBalance) => {
    const key = `${token.contractId}::${token.asset}`;
    const open = selected === key;
    // Sends spend the Stacks balance; a token held only on Blaze has nothing here to send
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
          title={!token.listed ? 'Not on Charisma\'s token list: hidden from sends' : !token.meta ? 'Unknown token: shown in smallest units, not sendable here' : sendable ? `Send ${label(token)}` : `${label(token)} is all on Blaze: move it with Charisma Swap`}
        >
          <TokenIcon token={token} />
          <div className="cx-token-row-name">
            <strong>{label(token)}</strong>
            {token.blaze !== '0' && token.meta ? (
              <span className="w-blaze-line"><Flame size={11} aria-hidden /> {formatUnits(token.blaze, token.meta.decimals)} on Blaze</span>
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.meta?.name ?? token.contractId}</span>
            )}
          </div>
          <div className="cx-token-row-bal">
            {token.meta
              // Rolls through approximate values, then rests on the exact amount
              ? <AnimatedAmount key={key} value={Number(totalOf(token))} format={n => formatUnits(n === Number(totalOf(token)) ? totalOf(token) : String(Math.round(n)), token.meta!.decimals)} />
              : `${totalOf(token)} units`}
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
          <button type="button" className="cx-btn w-btn-sm" onClick={load} title="Refresh balances">
            <RefreshCw size={14} aria-hidden /> Refresh
          </button>
        }
        title="Tokens"
      >
        <div className="cx-label">Total value</div>
        <div className="w-total">{balances && prices ? usd(total) : '…'}</div>
        <p className="w-note">
          {balances ? `${listed.length} token${listed.length === 1 ? '' : 's'}` : 'Loading balances…'}
          {balances && prices && priced.length < listed.length ? ` · ${listed.length - priced.length} without a price` : ''}
        </p>
      </Card>

      <ErrorText error={error} />
      {priceError && <p className="w-warning" role="alert">Prices unavailable: {priceError}</p>}
      {!balances && !error && <TokenSkeletons />}
      {balances && (
        <div className="cx-list">
          {listed.map(row)}
          {unlisted.length > 0 && (
            <button type="button" className="cx-btn cx-btn-quiet" style={{ justifyContent: 'flex-start', height: 'auto', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setShowUnlisted(open => !open)} aria-expanded={showUnlisted}>
              {showUnlisted ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
              <span>{unlisted.length} unlisted · not on Charisma's token list, may be scams</span>
            </button>
          )}
          {showUnlisted && unlisted.map(row)}
        </div>
      )}
    </div>
  );
}
