// Minimal Example - Just a few lines!
// The 'bot' variable is available globally with polyglot library access

console.log('Hello from', bot.name);
console.log('Bot has polyglot library:', !!bot.polyglot);
console.log('Bot has wallet credentials:', !!bot.walletCredentials?.privateKey);

// Example: Test polyglot library access
if (bot.polyglot && bot.walletCredentials?.privateKey) {
  console.log('Polyglot library keys:', Object.keys(bot.polyglot));
}

console.log('Minimal strategy completed!');