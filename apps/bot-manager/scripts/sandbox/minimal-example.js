// Minimal Example - Just a few lines!

console.log('Hello from', bot.name);
console.log('Balance:', bot.balance.STX, 'STX');

// Do a simple action
await bot.swap('STX', 'USDA', 100000);
console.log('Trade completed!');