import { ActivityItem, ActivityType, ActivityStatus, TokenInfo } from './types';

export interface ActivityTypeInfo {
  label: string;
  color: string;
  icon: string;
  description: string;
}

export interface ActivityStatusInfo {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}

export interface ActivityActionConfig {
  label: string;
  action: string;
  icon: string;
  color: string;
  disabled?: boolean;
}

export function getActivityTypeInfo(type: ActivityType): ActivityTypeInfo {
  const typeMap: Record<ActivityType, ActivityTypeInfo> = {
    instant_swap: {
      label: 'Instant Swap',
      color: 'text-blue-400',
      icon: 'arrows-updown',
      description: 'Immediate token exchange'
    },
    order_filled: {
      label: 'Order Filled',
      color: 'text-green-400',
      icon: 'check-circle',
      description: 'Limit order successfully executed'
    },
    order_cancelled: {
      label: 'Order Cancelled',
      color: 'text-red-400',
      icon: 'x-circle',
      description: 'Order was cancelled'
    },
    dca_update: {
      label: 'DCA Update',
      color: 'text-purple-400',
      icon: 'trending-up',
      description: 'Dollar cost averaging execution'
    },
    twitter_trigger: {
      label: 'Twitter Trigger',
      color: 'text-cyan-400',
      icon: 'twitter',
      description: 'Order triggered by Twitter activity'
    }
  };

  return typeMap[type] || {
    label: 'Unknown',
    color: 'text-gray-400',
    icon: 'question-mark',
    description: 'Unknown activity type'
  };
}

export function getStatusInfo(status: ActivityStatus): ActivityStatusInfo {
  const statusMap: Record<ActivityStatus, ActivityStatusInfo> = {
    completed: {
      label: 'Completed',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      icon: 'CheckCircle',
      description: 'Successfully completed'
    },
    pending: {
      label: 'Pending',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      icon: 'Clock',
      description: 'Awaiting confirmation'
    },
    failed: {
      label: 'Failed',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      icon: 'AlertCircle',
      description: 'Transaction failed'
    },
    cancelled: {
      label: 'Cancelled',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      icon: 'XCircle',
      description: 'Transaction was cancelled'
    },
    processing: {
      label: 'Processing',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      icon: 'Loader',
      description: 'Currently processing'
    }
  };

  return statusMap[status] || {
    label: 'Unknown',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    icon: 'HelpCircle',
    description: 'Unknown status'
  };
}

export function formatTokenAmount(amount: string, decimals: number = 6): string {
  const rawAmount = parseFloat(amount);
  if (isNaN(rawAmount)) return '0';
  
  // Convert from raw amount to human-readable amount using decimals
  const formattedAmount = rawAmount / Math.pow(10, decimals);
  
  if (formattedAmount >= 1000000) {
    return (formattedAmount / 1000000).toFixed(2) + 'M';
  } else if (formattedAmount >= 1000) {
    return (formattedAmount / 1000).toFixed(2) + 'K';
  } else if (formattedAmount >= 1) {
    return formattedAmount.toFixed(2);
  } else {
    return formattedAmount.toFixed(Math.min(decimals, 6)); // Cap display decimals at 6
  }
}

export function formatUsdValue(value?: number): string {
  if (!value) return '';
  
  // USD values are already in human-readable format, so format directly
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  } else if (value >= 1) {
    return `$${value.toFixed(2)}`;
  } else {
    return `$${value.toFixed(6)}`;
  }
}

export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'now';
  }
}

export function getFullTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function getProminentDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = today.getTime() - inputDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function getActivityActions(activity: ActivityItem): ActivityActionConfig[] {
  const actions: ActivityActionConfig[] = [];
  
  // Common actions
  actions.push({
    label: 'View on Explorer',
    action: 'view_explorer',
    icon: 'external-link',
    color: 'text-blue-400',
    disabled: !activity.txid
  });
  
  // Status-specific actions
  if (activity.status === 'pending') {
    actions.push({
      label: 'Cancel',
      action: 'cancel',
      icon: 'x-circle',
      color: 'text-red-400'
    });
  }
  
  if (activity.status === 'failed') {
    actions.push({
      label: 'Retry',
      action: 'retry',
      icon: 'refresh',
      color: 'text-green-400'
    });
  }
  
  return actions;
}

export function getPriceImpactColor(impact?: number): string {
  if (!impact) return 'text-gray-400';
  
  const absImpact = Math.abs(impact);
  if (absImpact < 0.1) return 'text-green-400';
  if (absImpact < 0.5) return 'text-yellow-400';
  if (absImpact < 1) return 'text-orange-400';
  return 'text-red-400';
}

export function getActivityDescription(activity: ActivityItem): string {
  const typeInfo = getActivityTypeInfo(activity.type);
  return `${typeInfo.label}: ${activity.fromToken.symbol} -> ${activity.toToken.symbol}`;
}

/**
 * Enriches token info with metadata from Blaze SDK
 */
export function enrichTokenWithMetadata(
  token: TokenInfo,
  metadata: any,
  getPrice: (contractId: string) => number | undefined
): TokenInfo {
  const tokenMetadata = metadata[token.contractId];
  const currentPrice = getPrice(token.contractId);
  
  // Use metadata decimals if available, fallback to token decimals
  const correctDecimals = tokenMetadata?.decimals || token.decimals || 6;
  
  // Calculate USD value using correct decimals from metadata
  let usdValue = token.usdValue;
  if (currentPrice && token.amount) {
    const formattedAmount = parseFloat(token.amount) / Math.pow(10, correctDecimals);
    usdValue = formattedAmount * currentPrice;
  }
  
  return {
    ...token,
    // Use proper metadata structure from useBlaze
    name: tokenMetadata?.name || token.symbol,
    symbol: tokenMetadata?.symbol || token.symbol,
    decimals: correctDecimals, // Use the correct decimals
    image: tokenMetadata?.image || undefined,
    description: tokenMetadata?.description || undefined,
    price: currentPrice,
    change24h: tokenMetadata?.change24h || undefined,
    marketCap: tokenMetadata?.marketCap || undefined,
    verified: tokenMetadata?.verified || false,
    usdValue
  };
}

export function getUserAvatarLetter(owner: string, displayName?: string): string {
  if (displayName) {
    return displayName.charAt(0).toUpperCase();
  }
  
  // Use the first character of the wallet address
  if (owner && owner.length > 0) {
    return owner.charAt(0).toUpperCase();
  }
  
  return '?';
}

export function formatUserName(owner: string, displayName?: string): string {
  if (displayName) {
    return displayName;
  }
  
  // Format wallet address to show first 6 and last 4 characters
  if (owner && owner.length > 10) {
    return `${owner.slice(0, 6)}...${owner.slice(-4)}`;
  }
  
  return owner || 'Unknown';
}

export function getStatusIcon(iconName: string) {
  // Return the actual icon component based on the name
  switch (iconName) {
    case 'CheckCircle':
      return 'CheckCircle';
    case 'Clock':
      return 'Clock';
    case 'AlertCircle':
      return 'AlertCircle';
    case 'XCircle':
      return 'XCircle';
    case 'Loader':
      return 'Loader';
    case 'HelpCircle':
      return 'HelpCircle';
    default:
      return 'HelpCircle';
  }
}

export function formatRouteWithTokens(route: string[], metadata: any): string {
  if (!route || route.length <= 2) return '';
  
  return route.map(contractId => {
    const tokenMetadata = metadata[contractId];
    return tokenMetadata?.symbol || contractId.split('.').pop()?.slice(0, 8) || contractId.slice(0, 8);
  }).join(' → ');
}