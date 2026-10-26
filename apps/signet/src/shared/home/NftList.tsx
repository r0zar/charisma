/**
 * NFTs on Home: the NFTs the active account holds, a page at a time. Each shows its picture and name, read from its
 * own contract. One whose details can't load still shows, with its id and why it has no picture.
 */
import { useEffect, useState } from 'react';
import { sendMessage } from '~shared/context/utils';
import { asError } from '~shared/errors';
import { t } from '~shared/i18n';
import { ErrorText } from '~shared/ui';
import type { NftItem, NftPage } from '~background/lib/nfts';

const PAGE = 12;

function NftCard({ nft }: { nft: NftItem }) {
  const [broken, setBroken] = useState(false);
  const collection = nft.contractId.split('.')[1];
  return (
    <a
      className="w-nft"
      href={`https://explorer.hiro.so/address/${nft.contractId}?chain=mainnet`}
      target="_blank"
      rel="noopener noreferrer"
      title={nft.error ?? collection}
    >
      <span className="w-nft-image">
        {nft.image && !broken
          ? <img src={nft.image} alt="" loading="lazy" onError={() => setBroken(true)} />
          : collection.charAt(0).toUpperCase()}
      </span>
      <span className="w-nft-text">
        <strong>{nft.name ?? `#${nft.tokenId}`}</strong>
        <span>{nft.error ? t('nftNoDetails') : collection}</span>
      </span>
    </a>
  );
}

export function NftList({ address }: { address: string }) {
  const [items, setItems] = useState<NftItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPage = (offset: number) => {
    setBusy(true);
    setError(null);
    sendMessage<NftPage>('getNfts', { offset, limit: PAGE })
      .then(page => {
        setItems(current => (offset === 0 ? page.items : [...(current ?? []), ...page.items]));
        setTotal(page.total);
      })
      .catch(err => setError(asError(err)))
      .finally(() => setBusy(false));
  };

  // Another account starts from its own first page
  useEffect(() => {
    setItems(null);
    fetchPage(0);
  }, [address]);

  const loaded = items?.length ?? 0;
  return (
    <div className="w-stack">
      <ErrorText error={error} />
      {!items && !error && <p className="w-note">{t('loadingNfts')}</p>}
      {items?.length === 0 && <p className="w-note">{t('nftEmpty')}</p>}
      {items && items.length > 0 && (
        <div className="w-nft-grid">
          {items.map(nft => <NftCard key={`${nft.contractId}::${nft.tokenId}`} nft={nft} />)}
        </div>
      )}
      {items && loaded < total && (
        <button type="button" className="cx-btn" onClick={() => fetchPage(loaded)} disabled={busy}>{t('showMore')}</button>
      )}
    </div>
  );
}
