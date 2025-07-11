/**
 * Strategy wrapper template
 * 
 * Generates minimal wrapper code that injects bot context and executes strategy code directly.
 * Users import packages directly using require() or import statements.
 */

export interface StrategyWrapperParams {
  botContext: string; // Serialized bot context JSON
  strategyCode: string;
}

export const strategyWrapperTemplate = (params: StrategyWrapperParams) => `
console.log('=== STRATEGY WRAPPER STARTING ===');

// Injected bot context as global variable
const bot = ${params.botContext};
console.log('Bot context loaded:', bot.name);

// Execute strategy code directly - users handle their own imports
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