import React from 'react';

// Common permission icons
export const PermissionIcons = {
  status: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8V13" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 16.01L12.01 15.9989" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  wallet: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 12V8H6C3.79086 8 2 6.20914 2 4V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V16" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 4C2 5.10457 2.89543 6 4 6H16V2H4C2.89543 2 2 2.89543 2 4Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 12C22 13.1046 21.1046 14 20 14C18.8954 14 18 13.1046 18 12C18 10.8954 18.8954 10 20 10C21.1046 10 22 10.8954 22 12Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  subnet: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 18L5 21L2 18" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 17V11" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 6L19 3L16 6" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 13V7" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 16L12 19L9 16" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17V3" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  balance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8.5H14.5" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 16.5H8" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 16.5H14.5" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 12.5H16C14.8954 12.5 14 13.3954 14 14.5V19.5C14 20.6046 14.8954 21.5 16 21.5H22C23.1046 21.5 24 20.6046 24 19.5V14.5C24 13.3954 23.1046 12.5 22 12.5Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12.5V5.5C2 4.39543 2.89543 3.5 4 3.5H18C19.1046 3.5 20 4.39543 20 5.5V12.5" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  transfer: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 17L17 7" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7H17V17" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  swap: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3L20 7L16 11" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7H20" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 21L4 17L8 13" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H4" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  dexterity: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 9H20M4 15H20" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4L9 20M15 4L15 20" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 9V14" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17.01L12.01 16.9989" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};

// Custom icons for permission notification headers
export const CustomIcons = {
  checkExtension: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 11.0801V12.0001C21.9988 14.1565 21.3005 16.2548 20.0093 17.9819C18.7182 19.7091 16.9033 20.9726 14.8354 21.584C12.7674 22.1954 10.5573 22.122 8.53447 21.3747C6.51168 20.6274 4.78465 19.2462 3.61096 17.4371C2.43727 15.628 1.87979 13.4882 2.02168 11.3364C2.16356 9.18467 2.99721 7.13643 4.39828 5.49718C5.79935 3.85793 7.69279 2.71549 9.79619 2.24025C11.8996 1.76502 14.1003 1.98245 16.07 2.86011" stroke="#7DF9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 4L12 14.01L9 11.01" stroke="#7DF9FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  getStatus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4H12.01M12 20H12.01M4 12H4.01M20 12H20.01M17.657 6.343H17.667M6.343 17.657H6.353M6.343 6.343H6.353M17.657 17.657H17.667" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  getBalance: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8.5H14.5" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 16.5H8" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 16.5H14.5" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 12.5H16C14.8954 12.5 14 13.3954 14 14.5V19.5C14 20.6046 14.8954 21.5 16 21.5H22C23.1046 21.5 24 20.6046 24 19.5V14.5C24 13.3954 23.1046 12.5 22 12.5Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12.5V5.5C2 4.39543 2.89543 3.5 4 3.5H18C19.1046 3.5 20 4.39543 20 5.5V12.5" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  getBalances: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4H20V16H4V4Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 8H20" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8V16" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20H15" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 16V20" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  createTransfer: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 17L17 7" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7H17V17" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  createSwap: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3L20 7L16 11" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7H20" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 21L4 17L8 13" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H4" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  signPrediction: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 12L11 15L16 9" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 5.5L15 5.5" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 19L8 17" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 19L16 17" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  claimRewards: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 15C15.866 15 19 11.866 19 8C19 4.13401 15.866 1 12 1C8.13401 1 5 4.13401 5 8C5 11.866 8.13401 15 12 15Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.21 13.89L7 23L12 20L17 23L15.79 13.88" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8L13 6.5L12 5L11 6.5L12 8Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  searchMempool: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 15L21 21" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10H12" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 8V12" stroke="#7DF9FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  defaultPermission: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 9V14" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17.01L12.01 16.9989" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};