/**
 * Strategy wrapper template
 * 
 * Generates the complete wrapper code that injects bot context and contract caller utility.
 */

export interface StrategyWrapperParams {
  botContext: string; // Serialized bot context JSON
  strategyCode: string;
  hasRepository?: boolean; // Whether a custom repository is being used
}

export const strategyWrapperTemplate = (params: StrategyWrapperParams) => `
console.log('=== STRATEGY WRAPPER STARTING ===');
console.log('Execution mode:', ${params.hasRepository ? '"Custom Repository"' : '"Clean Node.js"'});

${params.hasRepository ? `
// Import polyglot package from custom repository
let polyglot;
try {
  console.log('Attempting to require polyglot package...');
  polyglot = require('./packages/polyglot');
  console.log('Polyglot package loaded successfully');
  console.log('Polyglot keys:', Object.keys(polyglot));
  console.log('Polyglot type:', typeof polyglot);
} catch (error) {
  console.error('Failed to load polyglot package:', error.message);
  polyglot = null;
}
` : `
// Clean Node.js environment - no external dependencies available
console.log('Running in clean Node.js environment without external dependencies');
const polyglot = null;
`}

// Injected bot context as global variable
const bot = ${params.botContext};
console.log('Bot context loaded:', bot.name);

${params.hasRepository ? `
// Import @bots/basic from custom repository
let basic;
try {
  console.log('Attempting to require @bots/basic package...');
  basic = require('@bots/basic');
  console.log('@bots/basic package loaded successfully');
  console.log('@bots/basic keys:', Object.keys(basic));
  
  // Create contract caller with bot credentials
  if (basic.createContractCaller && bot.walletCredentials.privateKey) {
    bot.basic = basic.createContractCaller({ privateKey: bot.walletCredentials.privateKey });
    console.log('Contract caller created and attached to bot.basic');
  } else {
    console.warn('Unable to create contract caller - missing createContractCaller or privateKey');
    bot.basic = null;
  }
} catch (error) {
  console.error('Failed to load @bots/basic package:', error.message);
  bot.basic = null;
}
` : `
// Clean Node.js environment - @bots/basic not available
console.log('Running in clean Node.js environment without @bots/basic package');
bot.basic = null;
`}

// Attach polyglot to bot context
bot.polyglot = polyglot;
console.log('Polyglot attached to bot context');

// Execute raw strategy code directly
(async function() {
  try {
    console.log('=== EXECUTING STRATEGY CODE ===');
    ${params.strategyCode}
    
    // Strategy execution completed successfully
    console.log('STRATEGY_EXECUTION_COMPLETE');
    
  } catch (error) {
    console.error('Strategy execution error:', error.message);
    console.log('STRATEGY_EXECUTION_ERROR:' + error.message);
  }
})();
`;