"use client";

import React, { useState } from 'react';
import { Reply } from '@/lib/activity/types';
import { getRelativeTime, getFullTimestamp } from '@/lib/activity/utils';
import { Heart, MessageCircle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip';
import { toast } from '../ui/sonner';

interface ReplyItemProps {
  reply: Reply;
  onReply?: (replyId: string) => void;
  onEdit?: (replyId: string, newContent: string) => void;
  onDelete?: (replyId: string) => void;
  onLike?: (replyId: string) => void;
  className?: string;
}

export const ReplyItem: React.FC<ReplyItemProps> = ({
  reply,
  onReply,
  onEdit,
  onDelete,
  onLike,
  className = ''
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    toast.success(isLiked ? 'Removed like' : 'Liked reply');
    onLike?.(reply.id);
  };

  const formatAuthor = (author: string): string => {
    // If it looks like a wallet address, truncate it
    if (author.length > 20 && author.startsWith('SP')) {
      return `${author.slice(0, 8)}...${author.slice(-4)}`;
    }
    return author;
  };

  return (
    <div 
      className={`group relative py-4 transition-all duration-200 hover:bg-white/[0.02] ${className}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      style={{ animation: 'replyFadeIn 0.4s ease-out' }}
    >
      {/* Left border indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.08]" />
      
      <div className="pl-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Author avatar placeholder */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.15] flex items-center justify-center">
              <span className="text-xs font-medium text-white/80">
                {formatAuthor(reply.author).charAt(0).toUpperCase()}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-white/90">
                {formatAuthor(reply.author)}
              </span>
              <span className="text-white/40">•</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="text-sm text-white/60 hover:text-white/80 transition-colors cursor-help">
                      {getRelativeTime(reply.timestamp)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {getFullTimestamp(reply.timestamp)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {reply.metadata?.isEdited && (
                <>
                  <span className="text-white/40">•</span>
                  <span className="text-xs text-white/40">edited</span>
                </>
              )}
            </div>
          </div>

          {/* Actions menu - only show on hover */}
          {showActions && (
            <div className="flex items-center space-x-1 animate-in fade-in duration-200">
              <button
                onClick={() => {
                  toast.info('Reply to reply coming soon!', {
                    description: 'Nested reply conversations'
                  });
                  onReply?.(reply.id);
                }}
                className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-blue-500/[0.08] hover:border-blue-500/[0.15] hover:text-blue-400 transition-all duration-200"
                title="Reply"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={() => {
                  toast.info('Edit reply coming soon!', {
                    description: 'Edit your reply content'
                  });
                  onEdit?.(reply.id, reply.content);
                }}
                className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-yellow-500/[0.08] hover:border-yellow-500/[0.15] hover:text-yellow-400 transition-all duration-200"
                title="Edit"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={() => {
                  toast.info('Delete reply coming soon!', {
                    description: 'Remove your reply from the conversation'
                  });
                  onDelete?.(reply.id);
                }}
                className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] hover:text-red-400 transition-all duration-200"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={() => {
                  toast.info('More reply options coming soon!', {
                    description: 'Report, bookmark, and other actions'
                  });
                }}
                className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
                title="More options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Reply content */}
        <div className="pl-11">
          <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
            {reply.content}
          </div>
        </div>

        {/* Action bar */}
        <div className="pl-11 flex items-center space-x-4">
          <button
            onClick={handleLike}
            className={`flex items-center space-x-1 text-xs transition-all duration-200 ${
              isLiked 
                ? 'text-red-400 hover:text-red-300' 
                : 'text-white/40 hover:text-red-400'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            {/* Could add like count here */}
          </button>
          
          <button
            onClick={() => {
              toast.info('Reply to reply coming soon!', {
                description: 'Nested reply conversations'
              });
              onReply?.(reply.id);
            }}
            className="flex items-center space-x-1 text-xs text-white/40 hover:text-blue-400 transition-all duration-200"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Reply</span>
          </button>
        </div>
      </div>
    </div>
  );
};