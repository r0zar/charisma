/**
 * Simple Test Strategy
 * 
 * Minimal example for testing console.log output and stxTx library access
 */

console.log('🚀 Starting custom strategy...');
console.log('Bot ID:', bot.id);
console.log('Bot Name:', bot.name);
console.log('Bot context keys:', Object.keys(bot));

// Test polyglot library access
if (!bot.polyglot) {
  console.error('❌ polyglot library not available');
  return;
}

if (!bot.walletCredentials?.privateKey) {
  console.error('❌ Bot wallet credentials not available');
  return;
}

console.log('✅ Bot has polyglot library and wallet credentials');

// Test basic polyglot functionality
console.log('🧪 Testing polyglot library functions...');

try {
  // Test polyglot package access
  console.log('✅ Polyglot package available');
  console.log('  - Polyglot keys:', Object.keys(bot.polyglot));
  
  // Test if polyglot has expected functions
  if (bot.polyglot.createStacksPrivateKey) {
    console.log('✅ createStacksPrivateKey function available');
  }
  
  if (bot.polyglot.getAddressFromPrivateKey) {
    console.log('✅ getAddressFromPrivateKey function available');
  }
  
  if (bot.polyglot.uintCV) {
    console.log('✅ Clarity value functions available');
  }
  
} catch (error) {
  console.error('❌ polyglot library test failed:', error.message);
  console.error('Stack trace:', error.stack);
}

console.log('✅ Strategy execution completed successfully!');