// Test script to check if balance client works server-side
import { balanceClient } from '../../packages/tokens/dist/esm/index.mjs';

console.log('Testing balance client server-side...');
console.log('Balance client base URL:', balanceClient.BASE_URL);

// Test a simple call
balanceClient.getAddressBalances('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', true)
  .then(result => {
    console.log('Success! Got result:', result ? 'data returned' : 'null returned');
  })
  .catch(error => {
    console.log('Error:', error.message);
  });