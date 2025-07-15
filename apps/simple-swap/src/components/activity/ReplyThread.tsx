"use client";

import React, { useState } from 'react';
import { Reply } from '@/lib/activity/types';
import { ReplyItem } from './ReplyItem';
import { ReplyComposer } from './ReplyComposer';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

interface ReplyThreadProps {
  activityId: string;
  replies: Reply[];
  onAddReply: (activityId: string, content: string) => void;
  onEditReply?: (replyId: string, newContent: string) => void;
  onDeleteReply?: (replyId: string) => void;
  onLikeReply?: (replyId: string) => void;
  initiallyExpanded?: boolean;
  className?: string;
}

export const ReplyThread: React.FC<ReplyThreadProps> = ({
  activityId,
  replies,
  onAddReply,
  onEditReply,
  onDeleteReply,
  onLikeReply,
  initiallyExpanded = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [showComposer, setShowComposer] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleAddReply = (content: string) => {
    onAddReply(activityId, content);
    setShowComposer(false);
    setReplyingTo(null);
  };

  const handleReplyToReply = (replyId: string) => {
    setReplyingTo(replyId);
    setShowComposer(true);
    setIsExpanded(true);
  };

  const sortedReplies = [...replies].sort((a, b) => a.timestamp - b.timestamp);

  // Always show something when the parent wants to display replies
  if (replies.length === 0 && !showComposer) {
    return (
      <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
        {/* No replies message with composer trigger */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">No replies yet</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComposer(true);
            }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
          >
            Be the first to reply
          </button>
        </div>
      </div>
    );
  }

  if (replies.length === 0 && showComposer) {
    return (
      <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="animate-in slide-in-from-bottom-2 duration-300">
          <ReplyComposer
            activityId={activityId}
            onSubmit={handleAddReply}
            placeholder="Be the first to reply..."
            autoFocus
          />
          
          <div className="mt-3 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowComposer(false);
              }}
              className="text-sm text-white/60 hover:text-white/90 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`space-y-4 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Reply count and toggle */}
      {replies.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center space-x-2 text-sm text-white/60 hover:text-white/90 transition-all duration-200"
          >
            <MessageCircle className="w-4 h-4" />
            <span>
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {!showComposer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowComposer(true);
                setIsExpanded(true);
              }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
            >
              Add reply
            </button>
          )}
        </div>
      )}

      {/* Expanded reply thread */}
      {isExpanded && (
        <div className="space-y-0 animate-in slide-in-from-top-2 duration-300" style={{ animation: 'replySlideIn 0.3s ease-out' }}>
          {/* Thread container with left border */}
          <div className="relative border-l-2 border-white/[0.08] ml-4">
            {/* Reply items */}
            {sortedReplies.map((reply, index) => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                onReply={handleReplyToReply}
                onEdit={onEditReply}
                onDelete={onDeleteReply}
                onLike={onLikeReply}
                className={index === sortedReplies.length - 1 ? 'border-b border-white/[0.08]' : ''}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reply composer */}
      {showComposer && (
        <div className="ml-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="relative">
            {/* Connection line to thread */}
            <div className="absolute -left-4 top-4 w-4 h-px bg-white/[0.08]" />
            
            <ReplyComposer
              activityId={activityId}
              onSubmit={handleAddReply}
              placeholder={
                replyingTo 
                  ? "Reply to this comment..." 
                  : "Reply to this activity..."
              }
              autoFocus
            />
            
            {/* Cancel button */}
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setShowComposer(false);
                  setReplyingTo(null);
                }}
                className="text-sm text-white/60 hover:text-white/90 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add reply button when thread is expanded but composer is hidden */}
      {isExpanded && !showComposer && replies.length > 0 && (
        <div className="ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComposer(true);
            }}
            className="w-full p-3 rounded-xl border-2 border-dashed border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white/60 hover:bg-white/[0.02] transition-all duration-200 text-sm"
          >
            Add a reply...
          </button>
        </div>
      )}

    </div>
  );
};