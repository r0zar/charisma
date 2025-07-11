/**
 * Example Bot Strategy for Sandbox Execution
 * 
 * This demonstrates the expected format for bot strategy code.
 * The bot object now has access to the @stacks/transactions library via bot.stxTx
 * and the bot's wallet credentials for real blockchain interactions.
 */

// Example strategy: Simple STX transfer
console.log('🚀 Starting custom strategy for bot:', bot.name);
console.log('📊 Bot context keys:', Object.keys(bot));

try {
  // Check if we have stxTx library available
  if (!bot.stxTx) {
    console.error('❌ stxTx library not available');
    return;
  }

  // Check if we have wallet credentials
  if (!bot.walletCredentials?.privateKey) {
    console.error('❌ Bot wallet credentials not available');
    return;
  }

  console.log('✅ Bot has stxTx library and wallet credentials');

  // Example: Create a private key object from the bot's credentials
  const privateKey = bot.stxTx.createStacksPrivateKey(bot.walletCredentials.privateKey);
  const senderAddress = bot.stxTx.getAddressFromPrivateKey(privateKey.data, bot.stxTx.TransactionVersion.Mainnet);
  
  console.log('📍 Bot address:', senderAddress);

  // Example: Create a simple STX transfer transaction (not broadcasted)
  const recipientAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Example address
  const amount = bot.stxTx.uintCV(1000000); // 1 STX in microSTX
  
  console.log(`💸 Creating STX transfer of 1 STX to ${recipientAddress}`);
  
  const txOptions = {
    recipient: recipientAddress,
    amount: amount,
    senderKey: privateKey,
    network: new bot.stxTx.StacksMainnet(),
    memo: 'Bot strategy test transaction',
    nonce: bot.stxTx.uintCV(0), // In real usage, you'd need to fetch the correct nonce
    fee: bot.stxTx.uintCV(1000), // 0.001 STX fee
    anchorMode: bot.stxTx.AnchorMode.Any
  };

  const transaction = await bot.stxTx.makeSTXTokenTransfer(txOptions);
  
  console.log('✅ Transaction created successfully');
  console.log('🔗 Transaction ID would be:', transaction.txid());
  console.log('📄 Transaction size:', transaction.serialize().length, 'bytes');
  
  // Note: In a real strategy, you would broadcast the transaction like this:
  // const broadcastResult = await bot.stxTx.broadcastTransaction(transaction, network);
  // console.log('🚀 Transaction broadcast result:', broadcastResult);
  
  console.log('📈 Strategy execution completed successfully');

} catch (error) {
  console.error('❌ Strategy execution error:', error.message);
  console.error('Stack trace:', error.stack);
}

// Simple example showing access to stxTx library
console.log('🔧 Available stxTx functions:');
console.log('- makeSTXTokenTransfer:', typeof bot.stxTx?.makeSTXTokenTransfer);
console.log('- makeContractCall:', typeof bot.stxTx?.makeContractCall);
console.log('- broadcastTransaction:', typeof bot.stxTx?.broadcastTransaction);
console.log('- uintCV:', typeof bot.stxTx?.uintCV);
console.log('- stringAsciiCV:', typeof bot.stxTx?.stringAsciiCV);