import { sendToBackground } from '@plasmohq/messaging'
import type { HandlerResponse, MessageAction } from './types'

// Helper function to send messages to the background service
export async function sendMessage<T>(action: MessageAction, data?: any): Promise<T> {
  try {
    const response = await sendToBackground<{ action: MessageAction, data?: any }, HandlerResponse<T>>({
      name: 'handler',
      body: { action, data }
    });

    if (!response.success) {
      throw new Error(response.error || "Unknown error occurred");
    }

    return response.data as T;
  } catch (error) {
    console.error(`Error in ${action} message:`, error);
    throw error;
  }
}

/**
 * Show a notification message to the user
 */
function showNotification(message: string, isSuccess: boolean = true): void {
  const notification = document.createElement('div');
  notification.innerText = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.padding = '10px 20px';
  notification.style.backgroundColor = isSuccess ? 'rgba(54, 199, 88, 0.9)' : 'rgba(255, 78, 78, 0.9)';
  notification.style.color = 'white';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '999999';
  notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  document.body.appendChild(notification);

  // Remove the message after 3 seconds
  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}

/**
 * Save wallet backup to disk as a JSON file
 */
export async function saveEncryptedWalletBackup(): Promise<boolean> {
  try {
    // Get wallet data from the background script
    // The encrypted vault: it opens only with the wallet password
    const vault = await sendMessage<{ salt: string; iv: string; data: string }>("exportWalletData");
    const walletJsonData = JSON.stringify({ signetVault: 2, ...vault }, null, 2);

    // Current timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `signet-vault-${timestamp}.json`;
    
    // Create a Blob with the JSON data
    const jsonBlob = new Blob([walletJsonData], { type: 'application/json' });
    
    // Create a download URL
    const downloadUrl = URL.createObjectURL(jsonBlob);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    
    // Append to the document
    document.body.appendChild(link);
    
    // Programmatically click the link to trigger the download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    
    // Show success notification
    showNotification('Wallet exported successfully!', true);
    
    return true;
  } catch (error) {
    console.error("Error saving wallet backup:", error);
    showNotification('Failed to export wallet data', false);
    return false;
  }
}