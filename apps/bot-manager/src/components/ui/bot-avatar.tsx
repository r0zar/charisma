'use client';

import React, { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Bot as BotIcon } from 'lucide-react';
import { Bot } from '@/schemas/bot.schema';
import { getBotImageWithFallback, getBotImageFallback } from '@/lib/bot-images';
import { cn } from '@/lib/utils';

interface BotAvatarProps {
  bot: Bot;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallbackIcon?: boolean;
}

const sizeClasses = {
  sm: 'size-8',
  md: 'size-12',
  lg: 'size-16',
  xl: 'size-24',
};

export function BotAvatar({
  bot,
  size = 'md',
  className,
  showFallbackIcon = true
}: BotAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

  const primaryImageUrl = getBotImageWithFallback(bot);
  const fallbackImageUrl = getBotImageFallback(bot.name);

  const handleImageError = () => {
    if (!imageError) {
      setImageError(true);
    } else if (!fallbackError) {
      setFallbackError(true);
    }
  };

  const getImageUrl = () => {
    if (!imageError) {
      return primaryImageUrl;
    }
    if (!fallbackError) {
      return fallbackImageUrl;
    }
    return null;
  };

  const imageUrl = getImageUrl();

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {imageUrl && !fallbackError && (
        <AvatarImage
          src={imageUrl}
          alt={`${bot.name} avatar`}
          onError={handleImageError}
          className="object-cover"
        />
      )}
      <AvatarFallback className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
        {showFallbackIcon ? (
          <BotIcon className={cn(
            size === 'sm' && 'w-4 h-4',
            size === 'md' && 'w-6 h-6',
            size === 'lg' && 'w-8 h-8',
            size === 'xl' && 'w-12 h-12'
          )} />
        ) : (
          <span className={cn(
            'font-semibold',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base',
            size === 'xl' && 'text-xl'
          )}>
            {bot.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </AvatarFallback>
    </Avatar>
  );
}

interface BotAvatarGroupProps {
  bots: Bot[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function BotAvatarGroup({
  bots,
  maxDisplay = 3,
  size = 'md',
  className
}: BotAvatarGroupProps) {
  const displayBots = bots.slice(0, maxDisplay);
  const remainingCount = Math.max(0, bots.length - maxDisplay);

  return (
    <div className={cn('flex -space-x-2', className)}>
      {displayBots.map((bot) => (
        <BotAvatar
          key={bot.id}
          bot={bot}
          size={size}
          className="border-2 border-background"
        />
      ))}
      {remainingCount > 0 && (
        <Avatar className={cn(sizeClasses[size], 'border-2 border-background')}>
          <AvatarFallback className="bg-muted text-muted-foreground">
            <span className={cn(
              'font-semibold',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base',
              size === 'xl' && 'text-xl'
            )}>
              +{remainingCount}
            </span>
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

interface BotAvatarWithStatusProps extends BotAvatarProps {
  showStatus?: boolean;
}

export function BotAvatarWithStatus({
  bot,
  size = 'md',
  className,
  showFallbackIcon = true,
  showStatus = true
}: BotAvatarWithStatusProps) {
  const statusColors = {
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    error: 'bg-red-500',
    inactive: 'bg-gray-500',
    setup: 'bg-blue-500',
  };

  const statusColor = statusColors[bot.status] || 'bg-gray-500';

  return (
    <div className={cn('relative', className)}>
      <BotAvatar
        bot={bot}
        size={size}
        showFallbackIcon={showFallbackIcon}
        className='scale-150'
      />
      {showStatus && (
        <div className={cn(
          'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background',
          statusColor,
          size === 'sm' && 'w-3 h-3',
          size === 'md' && 'w-4 h-4',
          size === 'lg' && 'w-5 h-5',
          size === 'xl' && 'w-6 h-6'
        )} />
      )}
    </div>
  );
}