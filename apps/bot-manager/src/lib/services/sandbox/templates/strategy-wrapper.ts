/**
 * Strategy wrapper template
 * 
 * Generates the complete wrapper code that injects bot context and @stacks/transactions library.
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