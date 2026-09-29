/**
 * TransferTab - the active account's tokens (STX and every SIP-10 it holds), and sending them.
 */
import { useEffect, useState } from 'react';
import { useSignetContext } from '~shared/context/SignetContext';
import { sendMessage } from '~shared/context/utils';
import { colors } from '~shared/styles/theme';
import { HudButton, HudLabel, HudLine, HudPanel, HudScreen, HudStat } from '~shared/hud';
import type { TokenBalance } from '~background/lib/tokens';

/** Raw smallest units → "1,234.5678" */
function formatUnits(raw: string, decimals: number) {
  const value = BigInt(raw);
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

/** Whole-token amount of a balance (for pricing; display uses formatUnits) */
const units = (token: TokenBalance) => Number(token.balance) / 10 ** token.meta!.decimals;

const label = (token: TokenBalance) => token.meta?.symbol ?? token.contractId.split('.')[1];

function TokenIcon({ token }: { token: TokenBalance }) {
  const [broken, setBroken] = useState(false);
  if (token.meta?.image && !broken) {
    return <img src={token.meta.image} alt="" width={24} height={24} onError={() => setBroken(true)} style={{ borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 6px rgba(125, 249, 255, 0.35)' }} />;
  }
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(125, 249, 255, 0.5)', color: colors.cyber, fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>
      {label(token).charAt(0).toUpperCase()}
    </div>
  );
}

/** A shimmering bar standing in for text or an icon while balances load */
function Bone({ width, height, round }: { width: number | string; height: number; round?: boolean }) {
  return (
    <div style={{
      width, height, flexShrink: 0,
      borderRadius: round ? '50%' : '2px',
      background: 'linear-gradient(90deg, rgba(125, 249, 255, 0.06) 25%, rgba(125, 249, 255, 0.16) 50%, rgba(125, 249, 255, 0.06) 75%)',
      backgroundSize: '200% 100%',
      animation: 'signet-bone 1.4s ease-in-out infinite'
    }} />
  );
}

/** Placeholder rows shaped like token rows */
function TokenSkeletons() {
  return (
    <>
      <style>{'@keyframes signet-bone { from { background-position: 200% 0 } to { background-position: -200% 0 } }'}</style>
      {[48, 36, 42, 30].map((nameWidth, i) => (
        <div key={i} className="hud-row" style={{ padding: '10px 6px', gap: '10px' }}>
          <Bone width={24} height={24} round />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <Bone width={nameWidth} height={11} />
            <Bone width={nameWidth * 1.8} height={7} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
            <Bone width={64} height={11} />
            <Bone width={40} height={7} />
          </div>
        </div>
      ))}
    </>
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

  const errorLine = error && <div role="alert"><HudLine tone="red">{error}</HudLine></div>;

  if (txid) {
    const id = txid.startsWith('0x') ? txid : `0x${txid}`;
    return (
      <>
        <HudLine tone="green">SENT · CONFIRMS IN A FEW MINUTES</HudLine>
        <a href={`https://explorer.hiro.so/txid/${id}?chain=mainnet`} target="_blank" rel="noopener noreferrer" style={{ color: colors.cyber, fontFamily: 'monospace', fontSize: '8px' }}>VIEW ON EXPLORER ↗</a>
        <HudButton onClick={onDone}>Done</HudButton>
      </>
    );
  }

  if (review) {
    return (
      <>
        <HudStat label="SEND" value={`${formatUnits(review, decimals)} ${label(token)}`} />
        <HudStat label="TO" value={recipient.trim()} />
        <HudStat label="FEE" value="AUTO" tone="steel" />
        {token.contractId !== '.stx' && <HudStat label="GUARD" value="EXACT AMOUNT ONLY" tone="green" />}
        {errorLine}
        <div style={{ display: 'flex', gap: '6px' }}>
          <HudButton tone="steel" grow onClick={() => setReview(null)} disabled={busy}>Back</HudButton>
          <HudButton tone="green" grow onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send'}</HudButton>
        </div>
      </>
    );
  }

  return (
    <>
      <HudLabel>Recipient</HudLabel>
      <input className="hud-input" placeholder="SP…" value={recipient} onChange={e => setRecipient(e.target.value)} aria-label="Recipient address" />
      <HudLabel>Amount</HudLabel>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input className="hud-input" placeholder={`0.0 ${label(token)}`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" />
        <HudButton onClick={() => setAmount(formatUnits(token.balance, decimals).replace(/,/g, ''))}>Max</HudButton>
      </div>
      {errorLine}
      <div style={{ display: 'flex', gap: '6px' }}>
        <HudButton tone="steel" grow onClick={onCancel}>Cancel</HudButton>
        <HudButton grow onClick={toReview}>Review</HudButton>
      </div>
    </>
  );
}

export function TransferTab() {
  const { currentAccount } = useSignetContext();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
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
  const priced = balances?.map(valueOf).filter((value): value is number => value !== null) ?? [];
  const total = priced.reduce((sum, value) => sum + value, 0);

  useEffect(load, [currentAccount?.stxAddress]);

  const selectedToken = balances?.find(token => `${token.contractId}::${token.asset}` === selected);

  return (
    <div style={{ padding: '8px' }}>
      <HudScreen
        title="TOKENS"
        stats={[
          { label: 'HELD', value: balances ? balances.length : '…' },
          { label: 'VALUE', value: balances && prices ? usd(total) : '…', tone: 'green' }
        ]}
      >
        <HudPanel
          title="BALANCES"
          right={<button type="button" onClick={load} title="Refresh" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'monospace', fontSize: '9px', padding: 0 }}>↻</button>}
        >
          {error && <div role="alert"><HudLine tone="red">{error}</HudLine></div>}
          {priceError && <div role="alert"><HudLine tone="amber">Prices unavailable: {priceError}</HudLine></div>}
          {!balances && !error && <TokenSkeletons />}
          <div>
            {balances?.map(token => {
              const key = `${token.contractId}::${token.asset}`;
              const open = selected === key;
              return (
                <div
                  key={key}
                  className={`hud-row${token.meta ? ' is-clickable' : ''}${open ? ' is-open' : ''}`}
                  style={{ padding: '10px 6px', gap: '10px' }}
                  onClick={() => token.meta && setSelected(open ? null : key)}
                  title={token.meta ? `Send ${label(token)}` : 'Unknown token: shown in smallest units, not sendable here'}
                >
                  <TokenIcon token={token} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: colors.cyber, fontWeight: 'bold', fontSize: '12px' }}>{label(token)}</span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(token.meta?.name ?? token.contractId).toUpperCase()}</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span style={{ color: '#fff', fontSize: '12px' }}>{token.meta ? formatUnits(token.balance, token.meta.decimals) : `${token.balance} U`}</span>
                    <span style={{ color: valueOf(token) === null ? 'rgba(255, 255, 255, 0.3)' : 'rgba(54, 199, 88, 0.85)', fontSize: '9px' }}>
                      {prices ? (valueOf(token) === null ? '—' : usd(valueOf(token)!)) : ''}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          {balances && prices && priced.length < balances.length && (
            <HudLine tone="steel">{balances.length - priced.length} without a price · value covers priced tokens</HudLine>
          )}
        </HudPanel>

        {selectedToken?.meta && (
          <HudPanel key={selected} title={`SEND ${label(selectedToken)}`} tone="amber">
            <SendForm token={selectedToken} onCancel={() => setSelected(null)} onDone={() => { setSelected(null); load(); }} />
          </HudPanel>
        )}
      </HudScreen>
    </div>
  );
}
