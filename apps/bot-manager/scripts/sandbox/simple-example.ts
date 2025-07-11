// Simple Strategy Example - No functions, exports, or returns needed!
// The 'bot' variable is available globally with stxTx library access

console.log('🚀 Starting strategy for', bot.name);
console.log('📊 Bot ID:', bot.id);
console.log('📊 Bot context keys:', Object.keys(bot));

// Check if we have stxTx library and wallet credentials
if (!bot.stxTx) {
  console.error('❌ stxTx library not available');
  return;
}

if (!bot.walletCredentials?.privateKey) {
  console.error('❌ Bot wallet credentials not available');
  return;
}

console.log('✅ Bot has stxTx library and wallet credentials');

// Example: Get bot address from private key
const privateKey = bot.stxTx.createStacksPrivateKey(bot.walletCredentials.privateKey);
const botAddress = bot.stxTx.getAddressFromPrivateKey(privateKey.data, bot.stxTx.TransactionVersion.Mainnet);

console.log('📍 Bot address:', botAddress);

// Example: Create a contract call transaction (not broadcasted)
console.log('🔧 Creating example contract call...');

try {
  const contractAddress = 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR';
  const contractName = 'arkadiko-swap-v2-1';
  const functionName = 'get-pair-details';
  
  const functionArgs = [
    bot.stxTx.standardPrincipalCV('SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-stx-token'),
    bot.stxTx.standardPrincipalCV('SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token')
  ];

  const txOptions = {
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    senderKey: privateKey,
    network: new bot.stxTx.StacksMainnet(),
    anchorMode: bot.stxTx.AnchorMode.Any,
    fee: bot.stxTx.uintCV(1000)
  };

  const transaction = await bot.stxTx.makeContractCall(txOptions);
  
  console.log('✅ Contract call created successfully');
  console.log('🔗 Transaction ID would be:', transaction.txid());
  console.log('📄 Transaction size:', transaction.serialize().length, 'bytes');
  
  // Note: In a real strategy, you would broadcast the transaction like this:
  // const broadcastResult = await bot.stxTx.broadcastTransaction(transaction, new bot.stxTx.StacksMainnet());
  // console.log('🚀 Transaction broadcast result:', broadcastResult);

} catch (error) {
  console.error('❌ Contract call creation failed:', error.message);
}

// Example: Show available Clarity value builders
console.log('🔧 Available Clarity value builders:');
console.log('- uintCV:', typeof bot.stxTx.uintCV);
console.log('- stringAsciiCV:', typeof bot.stxTx.stringAsciiCV);
console.log('- standardPrincipalCV:', typeof bot.stxTx.standardPrincipalCV);
console.log('- contractPrincipalCV:', typeof bot.stxTx.contractPrincipalCV);
console.log('- listCV:', typeof bot.stxTx.listCV);
console.log('- tupleCV:', typeof bot.stxTx.tupleCV);

console.log('🏁 Strategy execution completed');