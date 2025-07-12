'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Search,
  Download,
  RefreshCw,
  Trash2,
  Filter,
  Play,
  Pause,
  ArrowDown
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ExecutionLog {
  type: string;
  level?: string;
  message: string;
  timestamp: string;
}

interface ExecutionLogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ExecutionLog[];
  isExecuting: boolean;
  onClearLogs: () => void;
}

export function ExecutionLogsDrawer({
  isOpen,
  onClose,
  logs,
  isExecuting,
  onClearLogs
}: ExecutionLogsDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive and auto-scroll is enabled
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Check if user has scrolled up and disable auto-scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  // Filter logs based on search query and type filter
  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = logTypeFilter === 'all' ||
      log.type === logTypeFilter ||
      log.level === logTypeFilter;

    return matchesSearch && matchesType;
  });

  // Get unique log types for filter dropdown
  const logTypes = Array.from(new Set([
    ...logs.map(log => log.type),
    ...logs.map(log => log.level).filter(Boolean)
  ])).filter(Boolean) as string[];

  const exportLogs = () => {
    const logText = filteredLogs.map(log =>
      `${new Date(log.timestamp).toISOString()} [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getLogColor = (log: ExecutionLog) => {
    if (log.type === 'error' || log.level === 'error') return 'text-red-400';
    if (log.type === 'status') return 'text-blue-400';
    if (log.level === 'warn') return 'text-yellow-400';
    if (log.type === 'result') return 'text-green-400';
    return 'text-foreground';
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="h-[90vh] flex flex-col">
        <DrawerHeader className="shrink-0">
          <DrawerTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Execution Logs
            {isExecuting && (
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Executing
              </Badge>
            )}
          </DrawerTitle>
          <DrawerDescription>
            Real-time strategy execution logs and debugging information
          </DrawerDescription>
        </DrawerHeader>

        {/* Controls */}
        <div className="px-4 sm:px-6 pb-4 space-y-3 shrink-0 border-b border-border">
          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {logTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
                className="flex items-center gap-1"
              >
                {autoScroll ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span className="hidden sm:inline">Auto-scroll</span>
              </Button>
              {!autoScroll && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollToBottom}
                  className="flex items-center gap-1"
                >
                  <ArrowDown className="w-3 h-3" />
                  <span className="hidden sm:inline">Bottom</span>
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-muted-foreground order-last sm:order-first">
                {filteredLogs.length} of {logs.length} entries
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                disabled={filteredLogs.length === 0}
                className="flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearLogs}
                disabled={logs.length === 0}
                className="flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Logs Content */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 px-6 py-4 overflow-y-auto bg-muted/30"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-muted-foreground text-center py-12">
              {logs.length === 0 ? (
                <>
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No execution logs yet</p>
                  <p className="text-sm">Click "Test Strategy" to see real-time logs</p>
                </>
              ) : (
                <>
                  <Search className="w-8 h-8 mx-auto mb-4 opacity-30" />
                  <p>No logs match your search criteria</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 p-2 rounded hover:bg-muted/50 ${getLogColor(log)}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className="text-muted-foreground text-xs w-20 sm:w-24">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="uppercase text-xs font-semibold bg-muted/30 px-2 py-0.5 rounded w-12 sm:w-16 text-center">
                      {log.type}
                    </span>
                  </div>
                  <span className="break-words leading-relaxed text-xs sm:text-sm pl-1 sm:pl-0">{log.message || ''}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          {isExecuting && logs.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-400 mt-4 p-2 bg-blue-500/10 rounded">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Streaming logs in real-time...</span>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}