"use client";

import React, { useState, useRef } from 'react';
import { Send, Smile, AtSign, Image, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from '../ui/sonner';

interface ReplyComposerProps {
  activityId: string;
  onSubmit: (content: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  activityId,
  onSubmit,
  placeholder = "Reply to this activity...",
  maxLength = 280,
  autoFocus = false,
  className = ''
}) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim());
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setContent(value);
      
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }
  };

  const remainingChars = maxLength - content.length;
  const isOverLimit = remainingChars < 0;
  const isNearLimit = remainingChars <= 20;

  return (
    <div 
      className={`rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm transition-all duration-300 ${isFocused ? 'border-white/[0.15] bg-black/30' : ''} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative p-4 space-y-4">
        {/* Main compose area */}
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full bg-transparent text-white/90 placeholder-white/40 resize-none border-none outline-none text-base leading-relaxed min-h-[80px] max-h-[200px]"
            style={{ 
              overflow: 'hidden',
              height: 'auto'
            }}
          />
        </div>

        {/* Composer toolbar */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
          <div className="flex items-center space-x-2">
            {/* Emoji picker button */}
            <button
              onClick={() => toast.info('Emoji picker coming soon!', {
                description: 'Add emojis and reactions to your replies'
              })}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
              title="Add emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
            
            {/* Mention button */}
            <button
              onClick={() => toast.info('User mentions coming soon!', {
                description: 'Mention other users in your replies'
              })}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
              title="Mention user"
            >
              <AtSign className="w-4 h-4" />
            </button>
            
            {/* Image upload button */}
            <button
              onClick={() => toast.info('Image uploads coming soon!', {
                description: 'Share screenshots and charts in replies'
              })}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
              title="Add image"
            >
              <Image className="w-4 h-4" />
            </button>
            
            {/* More options */}
            <button
              onClick={() => toast.info('More composer options coming soon!', {
                description: 'GIFs, polls, and advanced formatting'
              })}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {/* Character count */}
            {content.length > 0 && (
              <div className="flex items-center space-x-2">
                {/* Character count indicator */}
                <div className="relative w-6 h-6">
                  <svg className="w-6 h-6 transform -rotate-90" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      className="text-white/[0.08]"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 10}`}
                      strokeDashoffset={`${2 * Math.PI * 10 * (1 - content.length / maxLength)}`}
                      className={`transition-all duration-200 ${
                        isOverLimit
                          ? 'text-red-400'
                          : isNearLimit
                          ? 'text-yellow-400'
                          : 'text-blue-400'
                      }`}
                    />
                  </svg>
                  {isNearLimit && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xs font-medium ${isOverLimit ? 'text-red-400' : 'text-yellow-400'}`}>
                        {remainingChars}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isOverLimit}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-white/[0.03] disabled:text-white/40 text-white border-0 px-6 py-2 text-sm font-medium transition-all duration-200"
            >
              <Send className="w-4 h-4 mr-2" />
              Reply
            </Button>
          </div>
        </div>

        {/* Help text */}
        {isFocused && (
          <div className="text-xs text-white/40 animate-in fade-in duration-200">
            <kbd className="px-1.5 py-0.5 bg-white/[0.08] rounded text-xs">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-white/[0.08] rounded text-xs">Enter</kbd> to send
          </div>
        )}
      </div>
    </div>
  );
};