import { ChevronDown, ChevronRight, File, Folder, Wallet, Code, TrendingUp, LineChart, Info, Database } from 'lucide-react';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getNodeIcon(name: string, type: 'file' | 'directory') {
  if (type === 'directory') {
    if (name === 'addresses') return Wallet;
    if (name === 'contracts') return Code;
    if (name === 'prices') return TrendingUp;
    if (name === 'price-series') return LineChart;
    if (name === 'balances') return Database;
    if (name === 'balance-series') return Database;
    if (name === 'discovered') return Database;
    if (name === 'metadata') return Info;
    return Folder;
  }
  return File;
}

export function getNodeColor(name: string, type: 'file' | 'directory') {
  if (type === 'directory') {
    if (name === 'addresses') return 'text-blue-500';
    if (name === 'contracts') return 'text-purple-500';
    if (name === 'prices') return 'text-green-500';
    if (name === 'price-series') return 'text-orange-500';
    if (name === 'balances') return 'text-cyan-500';
    if (name === 'balance-series') return 'text-teal-500';
    if (name === 'discovered') return 'text-yellow-500';
    if (name === 'metadata') return 'text-gray-500';
    return 'text-muted-foreground';
  }
  return 'text-muted-foreground';
}

export function getAddressPreview(name: string): string {
  if (name.match(/^S[PTM]/)) {
    return name.slice(0, 8) + '...' + name.slice(-4);
  }
  return name;
}

export function getDisplayName(name: string, type: 'file' | 'directory'): string {
  if (type === 'directory' && name.match(/^S[PTM]/)) {
    return getAddressPreview(name);
  }
  if (name === 'price-series') {
    return 'Price Series';
  }
  return name.replace('.json', '');
}