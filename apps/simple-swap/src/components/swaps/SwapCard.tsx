"use client";

import React, { useState } from 'react';
import { SwapRecord } from '@/lib/swaps/types';
import TokenLogo from '../TokenLogo';
import { Copy, Check, ExternalLink, RotateCcw, X, Clock, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Badge } from '../ui/badge';

interface SwapCardProps {
  swap: SwapRecord;
  formatTokenAmount: (amount: string, decimals?: number, symbol?: string) => string;
  onCopyToClipboard?: (text: string, id: string) => void;
  copiedId?: string;
}

export const SwapCard: React.FC<SwapCardProps> = ({
  swap,
  formatTokenAmount,
  onCopyToClipboard,
  copiedId
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get status badge configuration
  const getStatusConfig = () => {
    switch (swap.status) {
      case 'completed':
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          text: 'Completed',
          className: 'bg-success/10 text-success border-success/20'
        };
      case 'pending':
        return {
          icon: <Clock className="w-3 h-3 animate-pulse" />,
          text: 'Pending',
          className: 'bg-warning/10 text-warning border-warning/20'
        };
      case 'failed':
        return {
          icon: <X className="w-3 h-3" />,
          text: 'Failed',
          className: 'bg-danger/10 text-danger border-danger/20'
        };
      default:
        return {
          icon: <Clock className="w-3 h-3" />,
          text: 'Unknown',
          className: 'bg-surface-hover text-ink-muted border-line'
        };
    }
  };

  const statusConfig = getStatusConfig();

  // Format timestamps
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Get input/output token info (simplified - would need token metadata in real implementation)
  const getTokenSymbol = (contractId: string) => {
    // Extract symbol from contract ID as fallback
    const parts = contractId.split('.');
    const tokenName = parts[parts.length - 1];
    return tokenName.replace('token-', '').replace('-token', '').toUpperCase();
  };

  const inputSymbol = getTokenSymbol(swap.inputToken);
  const outputSymbol = getTokenSymbol(swap.outputToken);

  const handleCopyTxId = () => {
    if (swap.txid && onCopyToClipboard) {
      onCopyToClipboard(swap.txid, swap.id);
    }
  };

  const openExplorer = () => {
    if (swap.txid) {
      window.open(`https://explorer.hiro.so/txid/${swap.txid}?chain=mainnet`, '_blank');
    }
  };

  return (
    <div className="bg-surface-sunken border border-line-soft rounded-xl p-4 backdrop-blur-sm hover:bg-surface-hover transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {/* Swap Icon */}
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent-text">
            <RotateCcw className="w-4 h-4" />
          </div>
          
          {/* Swap Info */}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-ink font-medium">Instant Swap</span>
              <Badge className={`text-xs ${statusConfig.className}`}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.text}</span>
              </Badge>
            </div>
            <div className="text-ink-muted text-sm">
              {formatTime(swap.timestamp)}
            </div>
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-ink-muted hover:text-ink transition-colors"
        >
          <svg 
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Token Flow */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <TokenLogo contractId={swap.inputToken} size="sm" />
          <div>
            <div className="text-ink font-medium">
              {formatTokenAmount(swap.inputAmount, 6, inputSymbol)}
            </div>
            <div className="text-ink-muted text-xs">{inputSymbol}</div>
          </div>
        </div>

        <div className="text-ink-muted">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>

        <div className="flex items-center space-x-2">
          <TokenLogo contractId={swap.outputToken} size="sm" />
          <div>
            <div className="text-ink font-medium">
              {swap.outputAmount ? 
                formatTokenAmount(swap.outputAmount, 6, outputSymbol) : 
                '—'
              }
            </div>
            <div className="text-ink-muted text-xs">{outputSymbol}</div>
          </div>
        </div>
      </div>

      {/* Price Impact */}
      {swap.priceImpact !== undefined && (
        <div className="flex justify-center mb-3">
          <div className={`text-xs px-2 py-1 rounded-lg ${
            Math.abs(swap.priceImpact) < 1 
              ? 'bg-success/10 text-success' 
              : Math.abs(swap.priceImpact) < 3
              ? 'bg-warning/10 text-warning'
              : 'bg-danger/10 text-danger'
          }`}>
            Price Impact: {swap.priceImpact > 0 ? '+' : ''}{swap.priceImpact.toFixed(2)}%
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-line pt-3 space-y-3">
          {/* Transaction ID */}
          {swap.txid && (
            <div className="flex items-center justify-between">
              <span className="text-ink-muted text-sm">Transaction ID</span>
              <div className="flex items-center space-x-2">
                <span className="text-ink text-sm font-mono">
                  {swap.txid.slice(0, 8)}...{swap.txid.slice(-8)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCopyTxId}
                      className="text-ink-muted hover:text-ink transition-colors"
                    >
                      {copiedId === swap.id ? (
                        <Check className="w-3 h-3 text-success" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copy Transaction ID</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={openExplorer}
                      className="text-ink-muted hover:text-ink transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>View on Explorer</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Route Path */}
          {swap.routePath && swap.routePath.length > 2 && (
            <div>
              <span className="text-ink-muted text-sm">Route</span>
              <div className="text-ink text-sm mt-1">
                {swap.routePath.map((token, index) => (
                  <span key={index}>
                    {getTokenSymbol(token)}
                    {index < swap.routePath!.length - 1 && ' → '}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Completion Time */}
          {swap.completedAt && (
            <div className="flex items-center justify-between">
              <span className="text-ink-muted text-sm">Completed</span>
              <span className="text-ink text-sm">
                {formatTime(swap.completedAt)}
              </span>
            </div>
          )}

          {/* Metadata */}
          {swap.metadata?.isSubnetShift && (
            <div className="flex items-center space-x-2">
              <Badge className="bg-blaze/10 text-blaze border-blaze/20 text-xs">
                Subnet Operation
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
};