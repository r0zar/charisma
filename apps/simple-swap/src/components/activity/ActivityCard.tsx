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
  HelpCircle
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

        {/* Trade Summary Row - Only for completed swaps with meaningful data */}
        {activity.status === 'completed' && activity.type === 'instant_swap' && activity.fromToken.usdValue && activity.toToken.usdValue && (
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/60">Traded:</span>
              <span className="text-white/80 font-medium">
                {formatUsdValue(activity.fromToken.usdValue)}
              </span>
              <span className="text-white/40">→</span>
              <span className="text-white/80 font-medium">
                {formatUsdValue(activity.toToken.usdValue)}
              </span>
            </div>
            {activity.toToken.amount && activity.fromToken.amount && (
              <div className="text-sm text-white/70">
                <span className="text-xs text-white/50">Received: </span>
                {formatTokenAmount(activity.toToken.amount, activity.toToken.decimals)} {activity.toToken.symbol}
              </div>
            )}
          </div>
        )}

        {/* Condition/Status Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {activity.type === 'instant_swap' ? (
              <div className="flex items-center gap-2">
                <span className="text-white/60">Market execution</span>
                {activity.priceImpact !== undefined && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className={`${getPriceImpactColor(activity.priceImpact)}`}>
                      {activity.priceImpact > 0 ? '+' : ''}{activity.priceImpact.toFixed(2)}% impact
                    </span>
                  </>
                )}
              </div>
            ) : activity.targetPrice ? (
              <div className="flex items-center gap-2 font-mono">
                <span className="text-white/60">When</span>
                <span className="text-white/80">1 {activity.fromToken.symbol}</span>
                <span className="text-lg text-white/60">≥</span>
                <span className="text-white/90">${Number(activity.targetPrice).toLocaleString()}</span>
                <span className="text-white/60">USD</span>
              </div>
            ) : activity.waitTime ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/60" />
                <span className="text-white/60">Waited {activity.waitTime}</span>
              </div>
            ) : (
              <span className="text-white/60">Strategy execution</span>
            )}
          </div>

          {/* Action buttons for active orders */}
          {activity.status === "pending" && activity.type !== 'instant_swap' && (
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
          )}
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="pt-4 border-t border-white/[0.08] animate-[slideDown_0.2s_ease-out]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
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
                  </div>
                </div>
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
                          <span className="text-white/90 font-mono text-xs truncate max-w-[120px]" title={activity.txid}>
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
                        <span className="text-white/90 text-xs text-right max-w-[200px] font-medium">
                          {formatRouteWithTokens(activity.route, metadata)}
                        </span>
                      </div>
                    )}

                    {activity.targetPrice && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Target Price:</span>
                        <span className="text-white/90">${activity.targetPrice.toLocaleString()}</span>
                      </div>
                    )}

                    {activity.executionPrice && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Execution Price:</span>
                        <span className="text-white/90">${activity.executionPrice.toLocaleString()}</span>
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

                {/* Notes and Errors */}
                {activity.metadata?.notes && (
                  <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.08]">
                    <div className="text-white/60 text-xs mb-1 uppercase tracking-wider">Note</div>
                    <div className="text-white/90 text-sm">
                      {activity.metadata.notes}
                    </div>
                  </div>
                )}

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
    </div>
  );
};