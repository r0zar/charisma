/**
 * Simple price check with console output
 */

import { logger } from './logger';

async function simplePriceCheck() {
  try {
    const { listPrices } = await import('@repo/tokens');
    const priceData = await listPrices({
      strategy: 'fallback',
      sources: { kraxel: false, stxtools: true, internal: true }
    });
    
    const aeUSDCContract = 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc';
    const chaContract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    
    console.log('=== CURRENT PRICES ===');
    console.log(`aeUSDC: ${priceData[aeUSDCContract] ? `$${priceData[aeUSDCContract]}` : 'Not found'}`);
    console.log(`CHA: ${priceData[chaContract] ? `$${priceData[chaContract]}` : 'Not found'}`);
    console.log(`Entry price calculated: $0.336580 per CHA`);
    
    if (priceData[chaContract]) {
      const currentPrice = priceData[chaContract];
      const entryPrice = 0.336580;
      const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      console.log(`\n=== ANALYSIS ===`);
      console.log(`Current CHA price: $${currentPrice}`);
      console.log(`Entry price: $${entryPrice}`);
      console.log(`Price change: ${priceChange.toFixed(2)}%`);
      console.log(`Current price is ${((currentPrice / entryPrice) * 100).toFixed(1)}% of entry price`);
      
      if (priceChange < -90) {
        console.log(`🚨 This should show a MASSIVE LOSS (~${priceChange.toFixed(0)}%)`);
      } else {
        console.log(`📊 This explains the small P&L we're seeing`);
      }
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

simplePriceCheck();