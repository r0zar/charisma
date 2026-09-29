# Signet Signer Chrome Extension

A secure wallet Chrome extension for connecting to decentralized applications and signing blockchain transactions.

## Features

- 🔐 **Secure Wallet**: Securely store and manage your cryptocurrency wallets
- 🌐 **Web3 Integration**: Connect seamlessly with dApps and Web3 applications
- 📝 **Transaction Signing**: Sign and verify transactions across multiple blockchains
- 🔑 **Key Management**: Generate and import seed phrases and private keys
- 🤝 **Signet Protocol**: Native support for the Signet messaging protocol
- 🖥️ **3D Visualizations**: Interactive holographic interface for transaction monitoring

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dev
   ```
4. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-dev` directory

### Building for Production

```bash
pnpm build
pnpm package
```

## Architecture

The extension is built using:

- Plasmo Framework for Chrome extension development
- React and TailwindCSS for UI
- Three.js for 3D visualizations
- Stacks SDK for blockchain integrations
- Signet SDK for cross-app messaging

## Security

This extension follows best practices for wallet security:

- No remote key storage
- Encrypted local storage
- Content script isolation
- Permission-based access control
- Secure messaging protocol

## Integration Guide

This section explains how to integrate your dapp with the Signet Chrome extension notification and event system.

> **Important Update**: The extension uses CSS isolation techniques to prevent styles from leaking onto the page content. This ensures that extension styles do not interfere with your web application's appearance.
>
> The isolation approach includes:
> 1. Prefixing all CSS classes with `signet-` to avoid collisions
> 2. Using a full-page container with pointer-events set to none (so clicks pass through to the page)
> 3. Applying pointer-events: auto only to interactive components
> 4. Using inline styles for critical elements to avoid global style leakage

### Overview

Signet extension provides a seamless way for dapps to:
- Request transaction signatures
- Request OP_PREDICT operations  
- Display notifications to users
- Receive responses from user interactions

### Sending Events to Signet

Dapps communicate with Signet using the `window.postMessage` API.

#### Basic Usage

```javascript
window.postMessage({
  type: 'SHOW_NOTIFICATION',
  title: 'TRANSACTION CONFIRMATION',
  message: 'Please confirm this transaction',
  details: 'Transfer 0.5 sBTC to SP...',
  notificationType: 'OP_TRANSFER',
  duration: 10000 // Optional auto-dismiss after 10 seconds
}, '*');
```

### Supported Event Types

#### UI Control Events
```javascript
// Toggle extension visibility
window.postMessage({ type: 'TOGGLE_EXTENSION' }, '*');

// Show 3D cube notification
window.postMessage({
  type: 'SHOW_3D',
  color: 'rgb(255, 100, 200)', // Optional
  duration: 5000 // Optional auto-dismiss after 5 seconds
}, '*');

// Hide 3D cube notification
window.postMessage({ type: 'HIDE_3D' }, '*');

// Change UI color
window.postMessage({
  type: 'CHANGE_COLOR',
  color: 'rgb(125, 249, 255)'
}, '*');
```

#### Notification Events

##### Basic Notification
```javascript
// Show notification
window.postMessage({
  type: 'SHOW_NOTIFICATION',
  title: 'NOTIFICATION TITLE',
  message: 'Notification message here',
  details: 'Additional details here', // Optional
  color: 'rgb(125, 249, 255)', // Optional
  duration: 5000, // Optional auto-dismiss after 5 seconds
  notificationType: 'OP_TRANSFER' // Optional, defaults to 'SYSTEM'
}, '*');

// Hide current notification
window.postMessage({ type: 'HIDE_NOTIFICATION' }, '*');
```

### Receiving Responses from Signet

To receive responses from Signet (especially important for OP_PREDICT operations), add a message event listener:

```javascript
window.addEventListener('message', (event) => {
  // Validate the message is from Signet
  if (!event.data || typeof event.data !== 'object') return;
  
  // Handle notification responses
  if (event.data.type === 'NOTIFICATION_RESPONSE') {
    const { id, notificationType, approved, result } = event.data;
    
    if (notificationType === 'OP_PREDICT') {
      if (approved) {
        // User approved the prediction market operation
        console.log('User approved prediction:', id);
        
        // Access the detailed result data
        const { transactionHash, signature, receiptId, metadata } = event.data.result;
        
        console.log('Transaction Hash:', transactionHash);
        console.log('Receipt ID:', receiptId);
        
        if (metadata) {
          console.log('Market:', metadata.marketName);
          console.log('Outcome:', metadata.outcomeName);
          console.log('Amount:', metadata.amount);
          console.log('Odds:', metadata.odds);
          console.log('Potential Payout:', metadata.potentialPayout);
        }
        
        // Issue NFT receipt or update UI
      } else {
        // User rejected the prediction market operation
        console.log('User rejected prediction:', id);
        
        // Access the rejection reason
        const { code, message, details } = event.data.rejectionReason || {};
        
        console.log('Rejection Code:', code);
        console.log('Rejection Reason:', message);
        console.log('Details:', details);
        
        // Handle rejection based on reason
      }
    }
  }
  
  // Handle enhanced wallet balance updates
  if (event.data.type === 'WALLET_UPDATE') {
    const { 
      address, 
      balance, 
      previousBalance, 
      delta, 
      reason,
      relatedTransaction 
    } = event.data;
    
    console.log(`Wallet ${address} balance updated: ${balance}`);
    
    if (delta && reason) {
      console.log(`Change: ${delta} due to: ${reason}`);
    }
    
    if (relatedTransaction) {
      console.log(`Related to transaction: ${relatedTransaction.id}`);
      console.log(`Market: ${relatedTransaction.marketName}`);
    }
    
    // Update UI with new balance data
  }
});
```

## Best Practices

1. **Use unique IDs** for each notification to track responses
2. **Set appropriate durations** based on notification importance
3. **Don't auto-dismiss** notifications that require user action
4. **Check for extension presence** before sending messages
5. **Provide clear details** in notification messages
6. **Handle response errors** gracefully

## Contact and Support

If you have questions or encounter issues while integrating with Signet, reach out to the Signet team through:
- [GitHub Issues](https://github.com/charisma/signet/issues)
- Discord: [Join our server](https://discord.gg/signet)

## License

MIT