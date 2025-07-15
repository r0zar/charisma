"use client";

import React, { useState } from 'react';
import { ActivityItem } from '@/lib/activity/types';
import {
  getActivityTypeInfo,
  getStatusInfo,
  formatTokenAmount,
  formatUsdValue,
  getRelativeTime,
  getFullTimestamp,
  getProminentDate,
  getActivityActions,
  getPriceImpactColor,
  getActivityDescription,
  formatUserName,
  getUserAvatarLetter,
  getStatusIcon,
  formatRouteWithTokens
} from '@/lib/activity/utils';
import TokenLogo from '../TokenLogo';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip';
import { ReplyThread } from './ReplyThread';
import { toast } from '@/components/ui/sonner';
import { truncateSmartContract } from '@/lib/address-utils';
import { ProfitabilityMiniChart } from './profitability/ProfitabilityMiniChart';
import { ProfitabilityMetricsComponent } from './profitability/ProfitabilityMetrics';
import { ProfitabilityDrawer } from './profitability/ProfitabilityDrawer';
import { getMockProfitabilityData } from '@/lib/mock-profitability-data';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  MoreHorizontal,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  XCircle,
  Loader,
  HelpCircle,
  BarChart3
} from 'lucide-react';

interface ActivityCardProps {
  activity: ActivityItem;
  metadata?: any;
  onAction?: (action: string, activity: ActivityItem) => void;
  onAddReply?: (activityId: string, content: string) => void;
  onEditReply?: (replyId: string, newContent: string) => void;
  onDeleteReply?: (replyId: string) => void;
  onLikeReply?: (replyId: string) => void;
  className?: string;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  metadata = {},
  onAction,
  onAddReply,
  onEditReply,
  onDeleteReply,
  onLikeReply,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showProfitabilityDrawer, setShowProfitabilityDrawer] = useState(false);

  const typeInfo = getActivityTypeInfo(activity.type);
  const statusInfo = getStatusInfo(activity.status);
  const actions = getActivityActions(activity);

  // Get the correct icon component
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'CheckCircle':
        return CheckCircle;
      case 'Clock':
        return Clock;
      case 'AlertCircle':
        return AlertCircle;
      case 'XCircle':
        return XCircle;
      case 'Loader':
        return Loader;
      case 'HelpCircle':
        return HelpCircle;
      default:
        return HelpCircle;
    }
  };

  const StatusIcon = getIconComponent(statusInfo.icon);

  const handleAction = (actionType: string) => {
    if (actionType === 'favorite') {
      setIsFavorited(!isFavorited);
      toast.success(isFavorited ? 'Removed from favorites' : 'Added to favorites');
    } else if (actionType === 'note') {
      toast.info('Notes feature coming soon!', {
        description: 'Add personal notes to activities'
      });
    } else if (actionType === 'repeat') {
      toast.info('Repeat transaction coming soon!', {
        description: 'Quickly repeat this swap with the same parameters'
      });
    } else if (actionType === 'share') {
      toast.info('Share feature coming soon!', {
        description: 'Share activity with other users'
      });
    } else if (actionType === 'more') {
      toast.info('More options coming soon!', {
        description: 'Additional actions and settings'
      });
    } else if (actionType === 'execute') {
      toast.info('Manual execution coming soon!', {
        description: 'Execute pending orders manually'
      });
    } else if (actionType === 'cancel') {
      toast.info('Cancel order coming soon!', {
        description: 'Cancel pending orders'
      });
    }
    onAction?.(actionType, activity);
  };

  const handleCardClick = () => {
    setShowReplies(!showReplies);
  };

  const openExplorer = () => {
    if (activity.txid) {
      window.open(`https://explorer.hiro.so/txid/${activity.txid}?chain=mainnet`, '_blank');
    }
  };

  const copyTxId = () => {
    if (activity.txid) {
      navigator.clipboard.writeText(activity.txid);
      handleAction('copy_tx');
    }
  };

  // Calculate value change
  const fromValue = activity.fromToken.usdValue || 0;
  const toValue = activity.toToken.usdValue || 0;
  const valueChange = toValue - fromValue;
  const valueChangePercent = fromValue > 0 ? (valueChange / fromValue) * 100 : 0;

  // Get profitability data for completed swaps
  const profitabilityData = activity.status === 'completed' && activity.type === 'instant_swap' 
    ? getMockProfitabilityData(activity.id) 
    : null;

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 cursor-pointer border-white/[0.08] bg-black/20 hover:bg-black/30 hover:border-white/[0.15] backdrop-blur-sm ${className}`}
      onClick={handleCardClick}
      aria-label={`${getActivityDescription(activity)}. Click to ${showReplies ? 'hide' : 'show'} replies.`}
      role="article"
      title={`Click to ${showReplies ? 'hide' : 'show'} replies`}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      <div className="relative p-3 sm:p-6 space-y-4">
        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {/* User Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.15] flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-white/80">
                {getUserAvatarLetter(activity.owner, activity.displayName)}
              </span>
            </div>

            {/* User Info and Activity Type */}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="text-sm font-medium text-white/90 truncate">
                  {formatUserName(activity.owner, activity.displayName)}
                </span>
                <span className="text-white/40">•</span>
                <div className={`flex items-center space-x-1 ${typeInfo.color}`}>
                  <typeInfo.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{typeInfo.label}</span>
                </div>
                {activity.strategy === 'dca' && activity.strategyPosition && activity.strategyTotal && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {activity.strategyPosition}/{activity.strategyTotal}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60 font-medium">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span>{getRelativeTime(activity.timestamp)}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {getFullTimestamp(activity.timestamp)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {activity.txid && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="font-mono text-xs text-white/40" title={activity.txid}>
                      #{activity.txid.substring(0, 8)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Premium Status Badge */}
          <div className="flex items-center gap-3">
            <div className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-200 ${statusInfo.color} ${statusInfo.bgColor} border-white/[0.15]`}>
              <StatusIcon className={`w-3 h-3 ${activity.status === 'pending' || activity.status === 'processing' ? 'animate-pulse' : ''}`} />
              <span>{statusInfo.label}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
              title={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Swap Details Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <TokenLogo
                token={{
                  contractId: activity.fromToken.contractId,
                  symbol: activity.fromToken.symbol,
                  decimals: activity.fromToken.decimals || 6,
                  type: activity.fromToken.contractId.includes('subnet') ? 'SUBNET' : 'BASE',
                  image: activity.fromToken.image
                }}
                size="sm"
              />
              <span className="text-sm font-medium text-white/80">
                {activity.fromToken.name || activity.fromToken.symbol}
              </span>
              {activity.fromToken.verified && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">✓</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-white/40">
              <span className="text-lg">→</span>
            </div>
            <div className="flex items-center gap-2">
              <TokenLogo
                token={{
                  contractId: activity.toToken.contractId,
                  symbol: activity.toToken.symbol,
                  decimals: activity.toToken.decimals || 6,
                  type: activity.toToken.contractId.includes('subnet') ? 'SUBNET' : 'BASE',
                  image: activity.toToken.image
                }}
                size="sm"
              />
              <span className="text-sm font-medium text-white/80">
                {activity.toToken.name || activity.toToken.symbol}
              </span>
              {activity.toToken.verified && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">✓</span>
              )}
            </div>
          </div>

          <div className="text-right space-y-0.5">
            <div className="text-sm font-mono text-white/90">
              {formatTokenAmount(activity.fromToken.amount, activity.fromToken.decimals)} {activity.fromToken.symbol}
            </div>
            {activity.fromToken.name && activity.fromToken.name !== activity.fromToken.symbol && (
              <div className="text-xs text-white/50">
                {activity.fromToken.name}
              </div>
            )}
            {activity.fromToken.usdValue && (
              <div className="text-xs text-white/60 font-medium">
                {formatUsdValue(activity.fromToken.usdValue)}
              </div>
            )}
          </div>
        </div>

        {/* Trade Summary Row - Enhanced with transaction analysis data */}
        {activity.status === 'completed' && activity.type === 'instant_swap' && activity.fromToken.amount && (() => {
          // Get actual received amount from transaction analysis
          const transactionAnalysis = activity.metadata?.transactionAnalysis;
          const actualOutputAmount = transactionAnalysis?.analysis?.finalOutputAmount;
          const slippage = transactionAnalysis?.analysis?.slippage;
          
          // Use actual amount if available, otherwise fall back to original data
          const displayAmount = actualOutputAmount || activity.toToken.amount;
          const hasActualData = !!actualOutputAmount;
          
          return (
            <div className="space-y-2">
              {/* Mobile: Stack vertically, Desktop: Side by side */}
              <div className="flex flex-col md:flex-row md:gap-2 space-y-2 md:space-y-0">
                {/* Traded Section */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.05] md:flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/60">Traded:</span>
                    {activity.fromToken.usdValue && activity.toToken.usdValue ? (
                      <>
                        <span className="text-white/80 font-medium">
                          {formatUsdValue(activity.fromToken.usdValue)}
                        </span>
                        <span className="text-white/40">→</span>
                        <span className="text-white/80 font-medium">
                          {formatUsdValue(activity.toToken.usdValue)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-white/80 font-medium">
                          {formatTokenAmount(activity.fromToken.amount, activity.fromToken.decimals)} {activity.fromToken.symbol}
                        </span>
                        <span className="text-white/40">→</span>
                        <span className="text-white/80 font-medium">
                          {displayAmount && parseFloat(displayAmount.toString()) > 0 
                            ? `${formatTokenAmount(displayAmount, activity.toToken.decimals)} ${activity.toToken.symbol}`
                            : 'Processing...'
                          }
                        </span>
                      </>
                    )}
                  </div>
                  {displayAmount && parseFloat(displayAmount.toString()) > 0 && (
                    <div className="text-sm text-white/70">
                      <span className="text-xs text-white/50">Received: </span>
                      <span className={hasActualData ? "text-emerald-400 font-medium" : ""}>
                        {formatTokenAmount(displayAmount, activity.toToken.decimals)} {activity.toToken.symbol}
                      </span>
                      {hasActualData && (
                        <span className="text-xs text-emerald-500/60 ml-1">✓</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Real-time P&L Display */}
                {profitabilityData && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gradient-to-r from-blue-500/[0.05] to-purple-500/[0.05] border border-blue-500/[0.15] md:flex-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-blue-500/10">
                        {profitabilityData.metrics.currentPnL.percentage >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                      <span className="text-white/80 text-sm font-medium">Current P&L:</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${profitabilityData.metrics.currentPnL.percentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {profitabilityData.metrics.currentPnL.percentage >= 0 ? '+' : ''}{profitabilityData.metrics.currentPnL.percentage.toFixed(1)}%
                      </div>
                      <div className={`text-xs ${profitabilityData.metrics.currentPnL.percentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {profitabilityData.metrics.currentPnL.usdValue >= 0 ? '+$' : '-$'}{Math.abs(profitabilityData.metrics.currentPnL.usdValue).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}


        {/* Action buttons for active orders */}
        {activity.status === "pending" && activity.type !== 'instant_swap' && (
          <div className="flex justify-end">
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('execute');
                }}
                className="p-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/[0.15] text-emerald-400 hover:bg-emerald-500/[0.15] hover:border-emerald-400/[0.3] transition-all duration-200 backdrop-blur-sm"
              >
                <CheckCircle className="h-4 w-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('cancel');
                }}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] hover:text-red-400 transition-all duration-200 backdrop-blur-sm"
              >
                <AlertCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Expanded Details */}
        {isExpanded && (
          <div className="pt-4 border-t border-white/[0.08] animate-[slideDown_0.2s_ease-out]">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 text-sm">
              {/* Activity Details Column */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs uppercase text-white/40 font-medium mb-3 tracking-wider">Activity Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Type:</span>
                      <span className="text-white/90">{typeInfo.label}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Status:</span>
                      <span className={statusInfo.color}>{statusInfo.label}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Timestamp:</span>
                      <span className="text-white/90 text-xs">{getFullTimestamp(activity.timestamp)}</span>
                    </div>
                    {activity.orderType && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Order Type:</span>
                        <span className="text-white/90 capitalize">{activity.orderType.replace('_', ' ')}</span>
                      </div>
                    )}
                    {activity.strategy && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Strategy:</span>
                        <span className="text-white/90 capitalize">{activity.strategy}</span>
                      </div>
                    )}

                    {/* Market Execution Information */}
                    {activity.type === 'instant_swap' && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Execution Type:</span>
                        <span className="text-white/90">Market execution</span>
                      </div>
                    )}
                    {(() => {
                      const transactionAnalysis = activity.metadata?.transactionAnalysis;
                      const slippage = transactionAnalysis?.analysis?.slippage;
                      
                      if (slippage && typeof slippage.slippagePercent === 'number' && !isNaN(slippage.slippagePercent) && isFinite(slippage.slippagePercent)) {
                        return (
                          <div className="flex justify-between items-center">
                            <span className="text-white/60">Actual Slippage:</span>
                            <div className="text-right">
                              <div className="text-orange-200 text-sm font-medium">
                                {slippage.slippagePercent > 0 ? '+' : ''}{slippage.slippagePercent.toFixed(2)}%
                              </div>
                              <div className="text-orange-400/60 text-xs">
                                {formatTokenAmount(Math.abs(slippage.difference || 0).toString(), activity.toToken.decimals || 6)} {activity.toToken.symbol} difference
                              </div>
                            </div>
                          </div>
                        );
                      } else if (activity.priceImpact !== undefined) {
                        return (
                          <div className="flex justify-between items-center">
                            <span className="text-white/60">Est. Price Impact:</span>
                            <span className={`${getPriceImpactColor(activity.priceImpact)}`}>
                              {activity.priceImpact > 0 ? '+' : ''}{activity.priceImpact.toFixed(2)}%
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {activity.targetPrice && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Trigger Condition:</span>
                        <span className="text-white/90 font-mono text-xs">
                          1 {activity.fromToken.symbol} ≥ ${Number(activity.targetPrice).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {activity.waitTime && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Wait Time:</span>
                        <span className="text-white/90">{activity.waitTime}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {activity.metadata?.notes && (
                  <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.08]">
                    <div className="text-white/60 text-xs mb-1 uppercase tracking-wider">Note</div>
                    <div className="text-white/90 text-sm">
                      {activity.metadata.notes}
                    </div>
                  </div>
                )}
              </div>

              {/* Transaction Details Column */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs uppercase text-white/40 font-medium mb-3 tracking-wider">Transaction Details</h4>
                  <div className="space-y-2">
                    {activity.txid && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">TxID:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/90 font-mono text-xs truncate max-w-[300px]" title={activity.txid}>
                            {activity.txid.slice(0, 8)}...{activity.txid.slice(-8)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openExplorer();
                            }}
                            className="p-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-blue-500/[0.08] hover:border-blue-500/[0.15] hover:text-blue-400 transition-all duration-200"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyTxId();
                            }}
                            className="p-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {activity.route && activity.route.length > 2 && (
                      <div className="flex justify-between items-start">
                        <span className="text-white/60">Route:</span>
                        <span className="text-white/90 text-xs text-right max-w-[300px] font-medium">
                          {formatRouteWithTokens(activity.route, metadata)}
                        </span>
                      </div>
                    )}

                    {activity.executionPrice && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Execution Price:</span>
                        <span className="text-white/90">${activity.executionPrice.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Enhanced Transaction Analysis */}
                    {activity.metadata?.transactionAnalysis && (
                      <div className="bg-gradient-to-br from-emerald-500/[0.05] to-blue-500/[0.05] rounded-lg p-3 border border-emerald-500/[0.15] mt-3">
                        <div className="text-emerald-300 text-xs mb-3 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                          Transaction Analysis
                        </div>
                        <div className="space-y-3">
                          {/* Actual vs Quoted Amounts */}
                          {activity.metadata.transactionAnalysis.analysis.slippage && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">Quoted Amount:</span>
                                <span className="text-white/80 font-mono text-sm">
                                  {formatTokenAmount(activity.metadata.transactionAnalysis.analysis.slippage.quotedAmount, activity.toToken.decimals || 6)} {activity.toToken.symbol}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">Actual Received:</span>
                                <span className="text-emerald-300 font-mono text-sm font-medium">
                                  {formatTokenAmount(activity.metadata.transactionAnalysis.analysis.slippage.actualAmount, activity.toToken.decimals || 6)} {activity.toToken.symbol}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">Difference:</span>
                                <span className={`font-mono text-sm ${(activity.metadata.transactionAnalysis.analysis.slippage.difference || 0) > 0 ? 'text-red-300' : 'text-green-300'}`}>
                                  {(activity.metadata.transactionAnalysis.analysis.slippage.difference || 0) > 0 ? '-' : '+'}{formatTokenAmount(Math.abs(activity.metadata.transactionAnalysis.analysis.slippage.difference || 0).toString(), activity.toToken.decimals || 6)} {activity.toToken.symbol}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Token Flow Summary */}
                          <div className="pt-2 border-t border-white/[0.08]">
                            <div className="text-white/60 text-xs mb-2">Token Flow:</div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-red-300">Input Transfers:</span>
                                <span className="text-white/70">{activity.metadata.transactionAnalysis.analysis.inputTokens.length}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-green-300">Output Transfers:</span>
                                <span className="text-white/70">{activity.metadata.transactionAnalysis.analysis.outputTokens.length}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-blue-300">Total Events:</span>
                                <span className="text-white/70">{activity.metadata.transactionAnalysis.totalEvents}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Price Snapshot Information */}
                    {(activity.fromToken.priceSnapshot || activity.toToken.priceSnapshot) && (
                      <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.08] mt-3">
                        <div className="text-white/60 text-xs mb-2 uppercase tracking-wider">Price Snapshot</div>
                        <div className="space-y-2">
                          {activity.fromToken.priceSnapshot && (
                            <div className="flex justify-between items-center">
                              <span className="text-white/60 text-sm">{activity.fromToken.symbol} Price:</span>
                              <div className="text-right">
                                <div className="text-white/90 text-sm font-mono">
                                  ${activity.fromToken.priceSnapshot.price.toLocaleString()}
                                </div>
                                <div className="text-white/50 text-xs">
                                  {new Date(activity.fromToken.priceSnapshot.timestamp).toLocaleString()} • {activity.fromToken.priceSnapshot.source}
                                </div>
                              </div>
                            </div>
                          )}
                          {activity.toToken.priceSnapshot && (
                            <div className="flex justify-between items-center">
                              <span className="text-white/60 text-sm">{activity.toToken.symbol} Price:</span>
                              <div className="text-right">
                                <div className="text-white/90 text-sm font-mono">
                                  ${activity.toToken.priceSnapshot.price.toLocaleString()}
                                </div>
                                <div className="text-white/50 text-xs">
                                  {new Date(activity.toToken.priceSnapshot.timestamp).toLocaleString()} • {activity.toToken.priceSnapshot.source}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Errors */}
                {activity.metadata?.errorMessage && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-red-400 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Error Details</span>
                    </div>
                    <div className="text-red-300 text-sm">
                      {activity.metadata.errorMessage}
                    </div>
                  </div>
                )}
              </div>

              {/* Trade Performance Column - Only show if profitability data exists */}
              {profitabilityData && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs uppercase text-white/40 font-medium mb-3 tracking-wider">Trade Performance</h4>
                    
                    {/* Performance Summary */}
                    <div className="bg-gradient-to-r from-blue-500/[0.05] to-purple-500/[0.05] border border-blue-500/[0.15] rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-blue-500/10">
                            {profitabilityData.metrics.currentPnL.percentage >= 0 ? (
                              <TrendingUp className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <span className="text-white/80 text-sm font-medium">Current P&L</span>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${profitabilityData.metrics.currentPnL.percentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {profitabilityData.metrics.currentPnL.percentage >= 0 ? '+' : ''}{profitabilityData.metrics.currentPnL.percentage.toFixed(1)}%
                          </div>
                          <div className={`text-xs ${profitabilityData.metrics.currentPnL.percentage >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                            {profitabilityData.metrics.currentPnL.usdValue >= 0 ? '+$' : '-$'}{Math.abs(profitabilityData.metrics.currentPnL.usdValue).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Mini Chart */}
                      <div className="h-20 w-full mb-3">
                        <ProfitabilityMiniChart 
                          data={profitabilityData.chartData} 
                          height={80}
                          className="rounded-md"
                        />
                      </div>
                      
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-white/60">Best</div>
                          <div className="text-emerald-400 font-medium">
                            +{profitabilityData.metrics.bestPerformance.percentage.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-white/60">Worst</div>
                          <div className="text-red-400 font-medium">
                            {profitabilityData.metrics.worstPerformance.percentage.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-white/60">Time Held</div>
                          <div className="text-white/80 font-medium">
                            {Math.floor(profitabilityData.metrics.timeHeld / (1000 * 60 * 60 * 24))}d{' '}
                            {Math.floor((profitabilityData.metrics.timeHeld % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}h
                          </div>
                        </div>
                        <div>
                          <div className="text-white/60">Avg Return</div>
                          <div className={`font-medium ${profitabilityData.metrics.averageReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {profitabilityData.metrics.averageReturn >= 0 ? '+' : ''}{profitabilityData.metrics.averageReturn.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] mt-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('favorite');
              }}
              className={`p-2 rounded-xl transition-all duration-200 ${isFavorited
                ? 'bg-red-500/[0.08] border border-red-500/[0.15] text-red-400'
                : 'bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] hover:text-red-400'
                }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReplies(!showReplies);
              }}
              className={`relative p-2 rounded-xl transition-all duration-200 ${showReplies
                ? 'bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-300'
                : (activity.replyCount > 0)
                  ? 'bg-blue-500/[0.08] border border-blue-500/[0.15] text-blue-400'
                  : 'bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-blue-500/[0.08] hover:border-blue-500/[0.15] hover:text-blue-400'
                }`}
              title={showReplies ? "Hide replies" : "Show replies"}
            >
              <MessageCircle className="w-4 h-4" />
              {activity.replyCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center px-1 animate-bounce">
                  {activity.replyCount > 99 ? '99+' : activity.replyCount}
                </span>
              )}
            </button>

{profitabilityData && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfitabilityDrawer(true);
                }}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-blue-500/[0.08] hover:border-blue-500/[0.15] hover:text-blue-400 transition-all duration-200"
                title="View trade performance details"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            )}

            {(activity.type === 'instant_swap' || activity.strategy === 'single') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('repeat');
                }}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-green-500/[0.08] hover:border-green-500/[0.15] hover:text-green-400 transition-all duration-200"
              >
                <Repeat2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('share');
              }}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-purple-500/[0.08] hover:border-purple-500/[0.15] hover:text-purple-400 transition-all duration-200"
            >
              <Share className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction('more');
            }}
            className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Reply Thread */}
        {showReplies && (
          <div className="pt-4 border-t border-white/[0.08] animate-in slide-in-from-top-2 duration-300">
            <ReplyThread
              activityId={activity.id}
              replies={activity.replies || []}
              onAddReply={onAddReply || (() => { })}
              onEditReply={onEditReply}
              onDeleteReply={onDeleteReply}
              onLikeReply={onLikeReply}
              initiallyExpanded={true}
            />
          </div>
        )}
      </div>

      {/* Profitability Drawer */}
      {profitabilityData && (
        <ProfitabilityDrawer
          isOpen={showProfitabilityDrawer}
          onClose={() => setShowProfitabilityDrawer(false)}
          data={profitabilityData}
          tokenPair={{
            inputSymbol: activity.fromToken.symbol,
            outputSymbol: activity.toToken.symbol
          }}
        />
      )}
    </div>
  );
};