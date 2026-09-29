/**
 * TransferTab - the active account's tokens (STX and every SIP-10 it holds), and sending them.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSignetContext } from '~shared/context/SignetContext';
import { sendMessage } from '~shared/context/utils';
import { colors, tint } from '~shared/styles/theme';
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

const label = (token: TokenBalance) => token.meta?.symbol ?? token.contractId.split('.')[1];

function TokenIcon({ token }: { token: TokenBalance }) {
  const [broken, setBroken] = useState(false);
  if (token.meta?.image && !broken) {
    return <img src={token.meta.image} alt="" width={28} height={28} onError={() => setBroken(true)} style={{ borderRadius: '50%', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(125, 249, 255, 0.1)', border: '1px solid rgba(125, 249, 255, 0.3)', color: colors.cyber, fontSize: '12px', fontWeight: 'bold' }}>
      {label(token).charAt(0).toUpperCase()}
    </div>
  );
}

/** A shimmering bar standing in for text or an icon while balances load */
function Bone({ width, height, round }: { width: number | string; height: number; round?: boolean }) {
  return (
    <div style={{
      width, height, flexShrink: 0,
      borderRadius: round ? '50%' : '4px',
      background: 'linear-gradient(90deg, rgba(125, 249, 255, 0.06) 25%, rgba(125, 249, 255, 0.16) 50%, rgba(125, 249, 255, 0.06) 75%)',
      backgroundSize: '200% 100%',
      animation: 'signet-shimmer 1.4s ease-in-out infinite'
    }} />
  );
}

/** Placeholder rows shaped like token rows */
function TokenSkeletons() {
  return (
    <>
      <style>{'@keyframes signet-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }'}</style>
      {[64, 48, 56, 40].map((nameWidth, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid rgba(125, 249, 255, 0.15)', borderRadius: '6px', background: 'rgba(1, 4, 9, 0.5)' }}>
          <Bone width={28} height={28} round />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Bone width={nameWidth} height={12} />
            <Bone width={nameWidth * 1.6} height={9} />
          </div>
          <Bone width={70} height={12} />
        </div>
      ))}
    </>
  );
}

const input = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '10px 12px',
  background: 'rgba(1, 4, 9, 0.8)',
  border: '1px solid rgba(125, 249, 255, 0.4)',
  borderRadius: '6px',
  color: colors.cyber,
  fontSize: '13px',
  fontFamily: 'monospace'
};

function Button({ children, onClick, disabled, color = colors.cyber, grow = true }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; color?: string; grow?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02, boxShadow: `0 0 8px ${tint(color, 0.4)}` }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      style={{ flex: grow ? 1 : 'none', padding: '10px 14px', background: `${tint(color, 0.1)}`, border: `1px solid ${tint(color, 0.4)}`, borderRadius: '4px', color, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.08em' }}
    >
      {children}
    </motion.button>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
        <div style={{ color: colors.neonGreen, fontWeight: 'bold' }}>✓ Sent. It confirms in a few minutes.</div>
        <a href={`https://explorer.hiro.so/txid/${id}?chain=mainnet`} target="_blank" rel="noopener noreferrer" style={{ color: colors.cyber }}>View on explorer ↗</a>
        <Button onClick={onDone}>DONE</Button>
      </div>
    );
  }

  if (review) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
        <div style={{ color: colors.steel }}>Review</div>
        <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>{formatUnits(review, decimals)} {label(token)}</div>
        <div style={{ color: colors.steel, wordBreak: 'break-all' }}>to {recipient.trim()}</div>
        {token.contractId !== '.stx' && <div style={{ color: colors.neonGreen }}>🛡️ Exactly this amount can leave your wallet</div>}
        <div style={{ color: colors.steel }}>Network fee is set automatically.</div>
        {error && <div role="alert" style={{ color: colors.neonRed }}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={() => setReview(null)} disabled={busy} color={colors.steel}>BACK</Button>
          <Button onClick={send} disabled={busy} color={colors.neonGreen}>{busy ? 'SENDING…' : 'SEND'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <input style={input} placeholder="Recipient address (SP…)" value={recipient} onChange={e => setRecipient(e.target.value)} aria-label="Recipient address" />
      <div style={{ display: 'flex', gap: '8px' }}>
        <input style={input} placeholder={`Amount of ${label(token)}`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" />
        <Button grow={false} onClick={() => setAmount(formatUnits(token.balance, decimals).replace(/,/g, ''))}>MAX</Button>
      </div>
      {error && <div role="alert" style={{ color: colors.neonRed, fontSize: '12px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button onClick={onCancel} color={colors.steel}>CANCEL</Button>
        <Button onClick={toReview}>REVIEW</Button>
      </div>
    </div>
  );
}

export function TransferTab() {
  const { currentAccount } = useSignetContext();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setBalances(null);
    sendMessage<TokenBalance[]>('getWalletBalances')
      .then(setBalances)
      .catch(err => setError(err.message));
  };

  useEffect(load, [currentAccount?.stxAddress]);

  return (
    <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: colors.cyber, fontWeight: 'bold' }}>TOKENS</span>
        <button type="button" onClick={load} style={{ background: 'none', border: 'none', color: colors.steel, cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
      </div>

      {error && <div role="alert" style={{ color: colors.neonRed, fontSize: '12px' }}>{error}</div>}
      {!balances && !error && <TokenSkeletons />}

      {balances?.map(token => {
        const key = `${token.contractId}::${token.asset}`;
        const open = selected === key;
        return (
          <div key={key} style={{ border: `1px solid ${open ? 'rgba(125, 249, 255, 0.5)' : 'rgba(125, 249, 255, 0.15)'}`, borderRadius: '6px', background: 'rgba(1, 4, 9, 0.5)' }}>
            <button
              type="button"
              onClick={() => token.meta && setSelected(open ? null : key)}
              title={token.meta ? `Send ${label(token)}` : 'Unknown token: shown in smallest units, not sendable here'}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'none', border: 'none', cursor: token.meta ? 'pointer' : 'default', color: '#fff', textAlign: 'left' }}
            >
              <TokenIcon token={token} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{label(token)}</div>
                <div style={{ fontSize: '11px', color: colors.steel, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.meta?.name ?? token.contractId}</div>
              </div>
              <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                {token.meta ? formatUnits(token.balance, token.meta.decimals) : `${token.balance} units`}
              </div>
            </button>
            {open && (
              <div style={{ padding: '0 12px 12px' }}>
                <SendForm token={token} onCancel={() => setSelected(null)} onDone={() => { setSelected(null); load(); }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
