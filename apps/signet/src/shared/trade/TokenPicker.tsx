/**
 * Pick a token for the Trade screen: searchable, with the amount the wallet holds of each one.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { t } from '~shared/i18n';
import { listAmount } from '~shared/home/balances';
import type { TokenBalance, TradeToken } from '~background/lib/tokens';

export function TokenPicker({ tokens, balances, onPick, onCancel }: {
  tokens: TradeToken[];
  balances: TokenBalance[] | null;
  onPick: (contractId: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const shown = tokens.filter(token =>
    !search || [token.symbol, token.name, token.contractId].some(text => text.toLowerCase().includes(search)));

  return (
    <div className="w-stack">
      <div className="w-actions">
        <button type="button" className="cx-btn w-btn-sm" onClick={onCancel}>
          <ArrowLeft size={14} aria-hidden /> {t('back')}
        </button>
      </div>
      <input
        className="w-input"
        placeholder={t('tradeSearch')}
        aria-label={t('tradeSearch')}
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus
      />
      <div className="w-token-list">
        {shown.map(token => {
          const held = balances?.find(balance => balance.contractId === token.contractId);
          return (
            <button key={token.contractId} type="button" className="w-token-option" onClick={() => onPick(token.contractId)}>
              <span className="cx-token">{token.symbol.charAt(0).toUpperCase()}</span>
              <span className="w-token-option-name">
                <strong>{token.symbol}</strong>
                <span>{token.name}</span>
              </span>
              {held && held.balance !== '0' && <span className="w-mono">{listAmount(held.balance, token.decimals)}</span>}
            </button>
          );
        })}
        {shown.length === 0 && <p className="w-note">{t('tradeNoTokens')}</p>}
      </div>
    </div>
  );
}
