'use client';

import { motion } from 'framer-motion';
import { 
  AlertTriangle,
  ArrowUpRight, 
  Bell, 
  Bot, 
  CheckCircle, 
  Clock, 
  Info,
  Pause, 
  User, 
  XCircle} from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { BotAvatar } from '@/components/ui/bot-avatar';
import { useSearch } from '@/contexts/search-context';
import { SearchResult } from '@/lib/services/search';

export function SearchResults() {
  const { results, loading, error, query, selectedIndex, closeSearch } = useSearch();

  if (!query) return null;

  if (loading) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="text-muted-foreground">Searching...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  if (!results || results.totalResults === 0) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="text-muted-foreground">No results found for "{query}"</div>
      </div>
    );
  }

  const handleResultClick = (result: SearchResult) => {
    closeSearch();
    
    // Navigate based on result type
    switch (result.type) {
      case 'bot':
        window.location.href = `/bots/${result.data.id}`;
        break;
      case 'notification':
        if (result.data.actionUrl) {
          window.location.href = result.data.actionUrl;
        }
        break;
      case 'user':
        // Handle user click - could navigate to user profile
        console.log('User clicked:', result.data);
        break;
      case 'transaction':
        if (result.data.txId) {
          window.open(`https://explorer.stacks.co/txid/${result.data.txId}`, '_blank');
        }
        break;
    }
  };

  const currentIndex = 0;
  const allResults = [
    ...results.bots,
    ...results.notifications,
    ...results.users,
    ...results.transactions
  ];

  return (
    <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden scroll-smooth" id="search-results-container">
      {results.bots.length > 0 && (
        <SearchCategory
          title="Bots"
          icon={<Bot className="w-4 h-4" />}
          results={results.bots}
          onResultClick={handleResultClick}
          selectedIndex={selectedIndex}
          startIndex={currentIndex}
        />
      )}
      
      {results.notifications.length > 0 && (
        <SearchCategory
          title="Notifications"
          icon={<Bell className="w-4 h-4" />}
          results={results.notifications}
          onResultClick={handleResultClick}
          selectedIndex={selectedIndex}
          startIndex={currentIndex + results.bots.length}
        />
      )}
      
      {results.users.length > 0 && (
        <SearchCategory
          title="Users"
          icon={<User className="w-4 h-4" />}
          results={results.users}
          onResultClick={handleResultClick}
          selectedIndex={selectedIndex}
          startIndex={currentIndex + results.bots.length + results.notifications.length}
        />
      )}
      
      {results.transactions.length > 0 && (
        <SearchCategory
          title="Transactions"
          icon={<ArrowUpRight className="w-4 h-4" />}
          results={results.transactions}
          onResultClick={handleResultClick}
          selectedIndex={selectedIndex}
          startIndex={currentIndex + results.bots.length + results.notifications.length + results.users.length}
        />
      )}
      
      <div className="px-6 py-3 border-t border-border/30 bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{results.totalResults} results in {results.searchTime}ms</span>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground">↑↓</kbd>
            <span>to navigate</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground">Enter</kbd>
            <span>to select</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SearchCategoryProps {
  title: string;
  icon: React.ReactNode;
  results: SearchResult[];
  onResultClick: (result: SearchResult) => void;
  selectedIndex: number;
  startIndex: number;
}

function SearchCategory({ title, icon, results, onResultClick, selectedIndex, startIndex }: SearchCategoryProps) {
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div className="px-6 py-2 bg-muted/10">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </div>
      </div>
      
      <div className="py-2">
        {results.map((result, index) => {
          const isSelected = selectedIndex === startIndex + index;
          return (
            <SearchResultItem
              key={result.id}
              result={result}
              isSelected={isSelected}
              onClick={() => onResultClick(result)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
}

function SearchResultItem({ result, isSelected, onClick }: SearchResultItemProps) {
  const itemRef = useRef<HTMLButtonElement>(null);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [isSelected]);
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'paused':
        return <Pause className="w-3 h-3 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Clock className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'info':
        return <Info className="w-3 h-3 text-blue-500" />;
      default:
        return <Bell className="w-3 h-3 text-muted-foreground" />;
    }
  };

  return (
    <motion.button
      ref={itemRef}
      onClick={onClick}
      className={`w-full px-6 py-3 text-left hover:bg-accent/50 transition-colors ${
        isSelected ? 'bg-accent' : ''
      }`}
      whileHover={{ x: 1 }}
      transition={{ duration: 0.1 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {result.type === 'bot' && (
            <BotAvatar bot={result.data} size="sm" />
          )}
          {result.type === 'notification' && (
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Bell className="w-4 h-4 text-orange-500" />
            </div>
          )}
          {result.type === 'user' && (
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <User className="w-4 h-4 text-purple-500" />
            </div>
          )}
          {result.type === 'transaction' && (
            <div className="p-2 bg-green-500/10 rounded-lg">
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground truncate">{result.title}</span>
            
            {result.type === 'bot' && result.metadata?.status && (
              <div className="flex items-center gap-1">
                {getStatusIcon(result.metadata.status)}
                <Badge variant="outline" className="text-xs">
                  {result.metadata.status}
                </Badge>
              </div>
            )}
            
            {result.type === 'notification' && (
              <div className="flex items-center gap-1">
                {getNotificationIcon(result.metadata?.notificationType || 'info')}
                {!result.metadata?.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground truncate">{result.description}</p>
          
          {result.type === 'transaction' && result.metadata?.txId && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-muted-foreground font-mono">
                {result.metadata.txId.slice(0, 8)}...{result.metadata.txId.slice(-8)}
              </span>
              <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}