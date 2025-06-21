'use client';

import './rpg-styles.css';
import { BlazeProvider } from 'blaze-sdk/realtime';
import { WalletProvider } from './contexts/wallet-context';
import PriceTheater from './price-theater';

const WrappedPriceTheater = () => (
  <WalletProvider>
    <BlazeProvider>
      <PriceTheater />
    </BlazeProvider>
  </WalletProvider>
);

export default WrappedPriceTheater;