/**
 * Activity on Home: the active account's transactions, newest first, a page at a time. Each says what it moved for
 * this account, and opens on the explorer.
 */
import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Repeat } from 'lucide-react';
import { sendMessage } from '~shared/context/utils';
import { asError } from '~shared/errors';
import { locale, t } from '~shared/i18n';
import { ErrorText, formatUnits } from '~shared/ui';
import type { ActivityMove, ActivityRow } from '~background/lib/activity';

const PAGE = 20;

/**
 * "1.5 STX", "stdao #867" for an NFT, or the raw amount and the contract's name when the token cache doesn't know
 * the token
 */
const amountOf = (move: ActivityMove) => {
  const name = move.contractId.split('.').pop();
  if (move.tokenId) return `${name} #${move.tokenId}`;
  return move.meta ? `${formatUnits(BigInt(move.amount), move.meta.decimals, 6)} ${move.meta.symbol}` : `${move.amount} ${name}`;
};

/** What the transaction moved for this account: "Sent 1.5 STX · Received 2 sBTC", or the function it called */
const titleOf = ({ moves, fn }: ActivityRow) => {
  const parts = [
    ...moves.filter(move => move.direction === 'out').map(move => t('activitySent', amountOf(move))),
    ...moves.filter(move => move.direction === 'in').map(move => t('activityReceived', amountOf(move))),
  ];
  if (parts.length) return parts.join(' · ');
  return fn ? t('activityContract', fn) : '—';
};

const iconOf = ({ moves }: ActivityRow) =>
  moves.some(move => move.direction === 'out') ? <ArrowUpRight size={18} aria-hidden />
    : moves.length ? <ArrowDownLeft size={18} aria-hidden />
    : <Repeat size={18} aria-hidden />;

function ActivityItem({ row }: { row: ActivityRow }) {
  const when = new Date(row.time).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const status = row.status === 'pending' ? ` · ${t('activityPending')}` : row.status === 'failed' ? ` · ${t('activityFailed')}` : '';
  return (
    <a className="w-activity-row" href={`https://explorer.hiro.so/txid/${row.txId}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
      <span className="w-activity-icon">{iconOf(row)}</span>
      <span className="w-activity-main">
        <strong>{titleOf(row)}</strong>
        <span>{when}{status}</span>
      </span>
      <ExternalLink size={14} aria-hidden />
    </a>
  );
}

export function ActivityList({ address }: { address: string }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPage = (offset: number) => {
    setBusy(true);
    setError(null);
    sendMessage<ActivityRow[]>('getActivity', { offset, limit: PAGE })
      .then(page => {
        setRows(current => (offset === 0 ? page : [...(current ?? []), ...page]));
        setMore(page.length === PAGE);
      })
      .catch(err => setError(asError(err)))
      .finally(() => setBusy(false));
  };

  // Another account starts from its own first page
  useEffect(() => {
    setRows(null);
    fetchPage(0);
  }, [address]);

  return (
    <div className="w-activity">
      <ErrorText error={error} />
      {!rows && !error && <p className="w-note">{t('loadingActivity')}</p>}
      {rows?.length === 0 && <p className="w-note">{t('activityEmpty')}</p>}
      {rows?.map(row => <ActivityItem key={row.txId} row={row} />)}
      {more && (
        <button type="button" className="cx-btn" onClick={() => fetchPage(rows?.length ?? 0)} disabled={busy}>{t('showMore')}</button>
      )}
    </div>
  );
}
