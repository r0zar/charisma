/**
 * Home: the account's total and its 24h change, Send and Receive, then the tokens or the activity.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { locale, t } from '~shared/i18n';
import { Card, ErrorText } from '~shared/ui';
import { CopyButton } from '~shared/wallet/WalletTab';
import { portfolioOf, usd, useBalances } from './balances';
import { TokenList } from './TokenList';
import { ActivityList } from './ActivityList';
import { NftList } from './NftList';

type Section = 'tokens' | 'activity' | 'nfts';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'tokens', label: 'tabTokens' },
  { key: 'activity', label: 'tabActivity' },
  { key: 'nfts', label: 'tabNfts' },
];

export function HomeTab({ address }: { address: string }) {
  const { balances, prices, error, priceError, load } = useBalances();
  const [section, setSection] = useState<Section>('tokens');
  const [receiving, setReceiving] = useState(false);

  const portfolio = balances && prices ? portfolioOf(balances, prices) : null;
  const rising = portfolio !== null && portfolio.change >= 0;

  return (
    <div className="w-page">
      <section className="w-hero">
        <span className="cx-label">{t('totalValue')}</span>
        <div className="w-total">{portfolio ? usd(portfolio.total) : '…'}</div>
        {portfolio?.changePercent != null && (
          <div className={`w-change ${rising ? 'up' : 'down'}`}>
            {rising ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />}
            <span>{usd(Math.abs(portfolio.change))} ({Math.abs(portfolio.changePercent).toLocaleString(locale, { maximumFractionDigits: 2 })}%)</span>
            <span className="w-change-period">{t('change24hLabel')}</span>
          </div>
        )}
      </section>

      <div className="w-actions-row">
        <button type="button" className="w-action" onClick={() => { setReceiving(false); setSection('tokens'); }}>
          <span className="w-action-icon"><ArrowUp size={22} aria-hidden /></span>
          {t('send')}
        </button>
        <button type="button" className="w-action" aria-pressed={receiving} onClick={() => setReceiving(open => !open)}>
          <span className="w-action-icon"><ArrowDown size={22} aria-hidden /></span>
          {t('receive')}
        </button>
      </div>

      {receiving && (
        <Card title={t('receive')}>
          <div className="w-stack">
            <p className="w-note">{t('receiveNote')}</p>
            <div className="w-row" style={{ paddingTop: 0 }}>
              <span className="w-address" style={{ flex: 1 }}>{address}</span>
              <CopyButton text={address} />
            </div>
          </div>
        </Card>
      )}

      <div className="w-pills" role="tablist">
        {SECTIONS.map(({ key, label }) => (
          <button key={key} type="button" role="tab" className="w-pill" aria-selected={section === key} onClick={() => setSection(key)}>
            {t(label)}
          </button>
        ))}
      </div>

      <ErrorText error={error} />
      {error && (
        <button type="button" className="cx-btn w-btn-sm" onClick={load} title={t('refreshTitle')}>
          <RefreshCw size={14} aria-hidden /> {t('refresh')}
        </button>
      )}
      {/* Its own lead-in, so the raw message: never "Prices unavailable: Something went wrong: …" */}
      {priceError && <p className="w-warning" role="alert">{t('pricesUnavailable', priceError.message)}</p>}
      {section === 'tokens' && !error && <TokenList balances={balances} prices={prices} reload={load} />}
      {section === 'activity' && <ActivityList address={address} />}
      {section === 'nfts' && <NftList address={address} />}
    </div>
  );
}
