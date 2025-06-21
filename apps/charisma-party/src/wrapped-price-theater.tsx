'use client';

import './rpg-styles.css';
import { BlazeProvider } from 'blaze-sdk/realtime';
import PriceTheater from './price-theater';

const WrappedPriceTheater = () => (
  <BlazeProvider>
    <PriceTheater />
  </BlazeProvider>
);

export default WrappedPriceTheater;