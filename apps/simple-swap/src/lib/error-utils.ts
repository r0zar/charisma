/**
 * Utility functions for handling errors in a user-friendly way
 * Differentiates between user cancellations and real errors
 */

/**
 * Determines if an error represents a user cancellation rather than a real error
 */
export function isUserCancellation(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.error || String(error);
  const cancellationKeywords = [
    'User rejected',
    'user rejected',
    'User denied',
    'user denied',
    'User cancelled',
    'user cancelled',
    'Transaction rejected',
    'cancelled by user',
    'User canceled',
    'user canceled',
    'Canceled by user',
    'canceled by user'
  ];
  
  return cancellationKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Determines if an error should show a toast notification to the user
 * Returns false for user cancellations, true for real errors
 */
export function shouldShowErrorToast(error: any): boolean {
  return !isUserCancellation(error);
}

/**
 * Gets a user-friendly error message from an error object
 */
export function getErrorMessage(error: any, defaultMessage: string = 'An error occurred'): string {
  if (!error) return defaultMessage;
  
  // Extract message from various error formats
  if (error.message) return error.message;
  if (error.error) return error.error;
  if (typeof error === 'string') return error;
  
  return defaultMessage;
}