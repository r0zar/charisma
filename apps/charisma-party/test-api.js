// Simple test to verify API integration
const { tokenRankingService } = require('./src/services/token-ranking.ts');

async function testAPI() {
    console.log('Testing token ranking service...');
    
    try {
        const result = await tokenRankingService.getBulkTokenData(10);
        console.log('API Response:', {
            totalTokens: result.tokens.length,
            firstToken: result.tokens[0],
            tokenSymbols: result.tokens.map(t => t.metadata?.symbol || 'No symbol')
        });
        
        const activeTokens = await tokenRankingService.getTopTokensByActivity(10);
        console.log('Active tokens:', activeTokens.length);
        
        const marketCapTokens = await tokenRankingService.getTopTokensByMarketCap(10);
        console.log('Market cap tokens:', marketCapTokens.length);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAPI();