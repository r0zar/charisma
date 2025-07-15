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
          className: 'bg-green-500/10 text-green-400 border-green-500/20'
        };
      case 'pending':
        return {
          icon: <Clock className="w-3 h-3 animate-pulse" />,
          text: 'Pending',
          className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        };
      case 'failed':
        return {
          icon: <X className="w-3 h-3" />,
          text: 'Failed',
          className: 'bg-red-500/10 text-red-400 border-red-500/20'
        };
      default:
        return {
          icon: <Clock className="w-3 h-3" />,
          text: 'Unknown',
          className: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
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
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 backdrop-blur-sm hover:bg-white/[0.04] transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {/* Swap Icon */}
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400">
            <RotateCcw className="w-4 h-4" />
          </div>
          
          {/* Swap Info */}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-white/90 font-medium">Instant Swap</span>
              <Badge className={`text-xs ${statusConfig.className}`}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.text}</span>
              </Badge>
            </div>
            <div className="text-white/60 text-sm">
              {formatTime(swap.timestamp)}
            </div>
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-white/60 hover:text-white/90 transition-colors"
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
            <div className="text-white/90 font-medium">
              {formatTokenAmount(swap.inputAmount, 6, inputSymbol)}
            </div>
            <div className="text-white/50 text-xs">{inputSymbol}</div>
          </div>
        </div>

        <div className="text-white/60">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>

        <div className="flex items-center space-x-2">
          <TokenLogo contractId={swap.outputToken} size="sm" />
          <div>
            <div className="text-white/90 font-medium">
              {swap.outputAmount ? 
                formatTokenAmount(swap.outputAmount, 6, outputSymbol) : 
                '—'
              }
            </div>
            <div className="text-white/50 text-xs">{outputSymbol}</div>
          </div>
        </div>
      </div>

      {/* Price Impact */}
      {swap.priceImpact !== undefined && (
        <div className="flex justify-center mb-3">
          <div className={`text-xs px-2 py-1 rounded-lg ${
            Math.abs(swap.priceImpact) < 1 
              ? 'bg-green-500/10 text-green-400' 
              : Math.abs(swap.priceImpact) < 3
              ? 'bg-yellow-500/10 text-yellow-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            Price Impact: {swap.priceImpact > 0 ? '+' : ''}{swap.priceImpact.toFixed(2)}%
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-white/[0.08] pt-3 space-y-3">
          {/* Transaction ID */}
          {swap.txid && (
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Transaction ID</span>
              <div className="flex items-center space-x-2">
                <span className="text-white/90 text-sm font-mono">
                  {swap.txid.slice(0, 8)}...{swap.txid.slice(-8)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCopyTxId}
                      className="text-white/60 hover:text-white/90 transition-colors"
                    >
                      {copiedId === swap.id ? (
                        <Check className="w-3 h-3 text-green-400" />
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
                      className="text-white/60 hover:text-white/90 transition-colors"
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
              <span className="text-white/60 text-sm">Route</span>
              <div className="text-white/90 text-sm mt-1">
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
              <span className="text-white/60 text-sm">Completed</span>
              <span className="text-white/90 text-sm">
                {formatTime(swap.completedAt)}
              </span>
            </div>
          )}

          {/* Metadata */}
          {swap.metadata?.isSubnetShift && (
            <div className="flex items-center space-x-2">
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs">
                Subnet Operation
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
};