/**
 * Check current prices being used in calculation
 */

import { logger } from './logger';

async function checkCurrentPrices() {
  logger.info('Checking current prices');

  try {
    const { listPrices } = await import('@repo/tokens');
    const priceData = await listPrices({
      strategy: 'fallback',
      sources: { kraxel: false, stxtools: true, internal: true }
    });
    
    const aeUSDCContract = 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc';
    const chaContract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    
    logger.info('Current token prices', {
      aeUSDC: priceData[aeUSDCContract] ? `$${priceData[aeUSDCContract]}` : 'Not found',
      CHA: priceData[chaContract] ? `$${priceData[chaContract]}` : 'Not found',
      entryPriceCalculated: '$0.336580 per CHA',
      comparison: priceData[chaContract] ? 
        `Current price is ${((priceData[chaContract] / 0.336580) * 100).toFixed(1)}% of entry price` : 
        'Cannot compare'
    });

    // Calculate what the real P&L should be if CHA is actually worth ~$0.003
    const realChaPrice = 0.003; // Estimated from previous observations
    const entryPrice = 0.336580;
    const realPriceChange = ((realChaPrice - entryPrice) / entryPrice) * 100;
    
    logger.info('Expected vs actual P&L', {
      expectedChaPrice: `$${realChaPrice}`,
      calculatedEntryPrice: `$${entryPrice}`,
      expectedPriceChange: `${realPriceChange.toFixed(2)}%`,
      actualSystemPriceChange: priceData[chaContract] ? 
        `${(((priceData[chaContract] - entryPrice) / entryPrice) * 100).toFixed(2)}%` : 
        'Unknown',
      note: realPriceChange < -90 ? 'Should show massive loss (~99%)' : 'Normal movement'
    });

  } catch (error) {
    logger.error('Error checking prices', { error: error.message });
  }
}

checkCurrentPrices().then(() => {
  logger.info('Price check completed');
}).catch(error => {
  logger.error('Price check failed', { error: error.message });
});