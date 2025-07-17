'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { usePrices } from '@/contexts/token-price-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import CreateBotModal from './CreateBotModal';
import { signedFetch } from 'blaze-sdk';
import { request } from '@stacks/connect';
import { makeSTXTokenTransfer, broadcastTransaction, uintCV, principalCV, noneCV, Pc } from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import {
  Bot,
  Plus,
  Play,
  Pause,
  Archive,
  Activity,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Copy,
  ExternalLink,
  Wallet,
  AlertCircle,
  Fuel,
  TrendingUp,
  History,
  Zap,
  ArrowUpLeft
} from 'lucide-react';

// LP tokens required for yield farming
const YIELD_FARMING_LP_TOKENS = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit',
];

// Reward token from yield farming
const REWARD_TOKEN = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl';

// All withdrawable tokens (LP tokens + reward token)
const WITHDRAWABLE_TOKENS = [...YIELD_FARMING_LP_TOKENS, REWARD_TOKEN];
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BotActivityRecord } from '@/types/bot';

interface BotConfig {
  id: string;
  name: string;
  strategy: string;
  status: 'active' | 'paused' | 'error' | 'inactive';
  walletAddress: string;
  dailyPnL: number;
  totalPnL: number;
  lastActive: string;
  createdAt: string;
  isExample?: boolean;
}

// Example bots for demonstration
const exampleBots: BotConfig[] = [
  {
    id: 'example-1',
    name: 'DCA Bitcoin',
    strategy: 'Dollar Cost Averaging',
    status: 'active',
    walletAddress: 'SP1ABC...DEF',
    dailyPnL: 23.45,
    totalPnL: 156.78,
    lastActive: '2 minutes ago',
    createdAt: '2024-01-15',
    isExample: true
  },
  {
    id: 'example-2',
    name: 'Yield Optimizer',
    strategy: 'Liquidity Pool Automation',
    status: 'paused',
    walletAddress: 'SP2XYZ...ABC',
    dailyPnL: -5.67,
    totalPnL: 89.12,
    lastActive: '1 hour ago',
    createdAt: '2024-01-20',
    isExample: true
  },
  {
    id: 'example-3',
    name: 'Arbitrage Scanner',
    strategy: 'Cross-DEX Arbitrage',
    status: 'error',
    walletAddress: 'SP3QRS...XYZ',
    dailyPnL: 0,
    totalPnL: -12.34,
    lastActive: '6 hours ago',
    createdAt: '2024-01-25',
    isExample: true
  }
];

const statusColors = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

const statusIcons = {
  active: <CheckCircle className="w-3 h-3" />,
  paused: <Pause className="w-3 h-3" />,
  error: <XCircle className="w-3 h-3" />,
  inactive: <Clock className="w-3 h-3" />
};

export default function BotsSettings() {
  const { address } = useWallet();
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [userBots, setUserBots] = useState<BotConfig[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [fundingBot, setFundingBot] = useState<string | null>(null);
  const [sendingLpTokens, setSendingLpTokens] = useState<string | null>(null);
  const [operatingBot, setOperatingBot] = useState<string | null>(null);
  const [withdrawingBot, setWithdrawingBot] = useState<string | null>(null);
  const [withdrawalConfirmBot, setWithdrawalConfirmBot] = useState<string | null>(null);
  const [activityModalBot, setActivityModalBot] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<{ [botId: string]: BotActivityRecord[] }>({});
  const [loadingActivity, setLoadingActivity] = useState<{ [botId: string]: boolean }>({});
  const [recentlySentTokens, setRecentlySentTokens] = useState<{ [botId: string]: string[] }>({});

  // Get bot wallet addresses for balance tracking
  const botWalletAddresses = useMemo(() => {
    return userBots.map(bot => bot.walletAddress).filter(Boolean);
  }, [userBots]);

  // Use new contexts to get real-time balances and prices for all bot wallets
  const { prices, getPrice } = usePrices();
  const { balances, getBalance, getTokenBalance, getStxBalance, refreshBalances } = useBalances(botWalletAddresses);
  const { getTokenSymbol, getTokenName, getTokenImage, getTokenDecimals, getToken } = useTokenMetadata();

  // Helper function to calculate USD value
  const calculateUsdValue = useCallback((contractId: string, formattedBalance: number): string => {
    const price = getPrice(contractId);
    if (!price) return '~';
    const usdValue = formattedBalance * price;
    return `$${usdValue.toFixed(2)}`;
  }, [getPrice]);

  // Helper functions that need to be defined before useEffects
  const getBotStxBalance = useCallback((walletAddress: string): number => {
    if (!walletAddress) return 0;

    try {
      return getStxBalance(walletAddress);
    } catch (error) {
      console.error('Error getting STX balance for bot wallet:', error);
      return 0;
    }
  }, [getStxBalance]);

  const getUserLpTokens = useCallback((userAddress: string) => {
    if (!userAddress) return [];

    try {
      const walletBalance = getBalance(userAddress);
      if (!walletBalance?.fungible_tokens) return [];
      
      const lpTokens = [];

      for (const contractId of YIELD_FARMING_LP_TOKENS) {
        const tokenBalance = walletBalance.fungible_tokens[contractId];
        if (tokenBalance && parseFloat(tokenBalance.balance || '0') > 0) {
          const formattedBalance = parseFloat(tokenBalance.balance) / Math.pow(10, 6); // Assuming 6 decimals
          lpTokens.push({
            contractId,
            balance: tokenBalance.balance,
            formattedBalance,
            symbol: 'LP',
            name: 'LP Token',
            metadata: tokenBalance
          });
        }
      }

      return lpTokens;
    } catch (error) {
      console.error('Error getting user LP token balances:', error);
      return [];
    }
  }, [getBalance]);

  const getBotLpTokens = useCallback((walletAddress: string) => {
    if (!walletAddress) return [];

    try {
      const walletBalance = getBalance(walletAddress);
      if (!walletBalance?.fungible_tokens) return [];
      
      const lpTokens = [];

      for (const contractId of YIELD_FARMING_LP_TOKENS) {
        const tokenBalance = walletBalance.fungible_tokens[contractId];
        if (tokenBalance && parseFloat(tokenBalance.balance || '0') > 0) {
          const formattedBalance = parseFloat(tokenBalance.balance) / Math.pow(10, 6); // Assuming 6 decimals
          lpTokens.push({
            contractId,
            balance: tokenBalance.balance,
            formattedBalance,
            symbol: 'LP',
            name: 'LP Token',
            metadata: tokenBalance
          });
        }
      }

      return lpTokens;
    } catch (error) {
      console.error('Error getting bot LP token balances:', error);
      return [];
    }
  }, [getBalance]);

  // Get all withdrawable tokens from bot (LP tokens + reward tokens)
  const getBotWithdrawableTokens = useCallback((walletAddress: string) => {
    if (!walletAddress) return [];

    try {
      const walletBalance = getBalance(walletAddress);
      if (!walletBalance?.fungible_tokens) return [];
      
      const withdrawableTokens = [];

      for (const contractId of WITHDRAWABLE_TOKENS) {
        const tokenBalance = walletBalance.fungible_tokens[contractId];
        if (tokenBalance && parseFloat(tokenBalance.balance || '0') > 0) {
          const isRewardToken = contractId === REWARD_TOKEN;
          const formattedBalance = parseFloat(tokenBalance.balance) / Math.pow(10, 6); // Assuming 6 decimals
          withdrawableTokens.push({
            contractId,
            balance: tokenBalance.balance,
            formattedBalance,
            symbol: isRewardToken ? 'HOOTER' : 'LP',
            name: isRewardToken ? 'Hooter the Owl' : 'LP Token',
            metadata: tokenBalance,
            type: isRewardToken ? 'reward' : 'lp'
          });
        }
      }

      return withdrawableTokens;
    } catch (error) {
      console.error('Error getting bot withdrawable token balances:', error);
      return [];
    }
  }, [getBalance]);

  // Check if a bot has ALL required LP tokens for yield farming
  const botHasLpTokens = useCallback((bot: BotConfig) => {
    if (bot.isExample || bot.strategy !== 'yield-farming') return false;

    const botLpTokens = getBotLpTokens(bot.walletAddress);

    // Check if bot has ALL 3 required LP tokens
    const requiredTokens = YIELD_FARMING_LP_TOKENS;
    const botTokenContracts = botLpTokens.map(token => token.contractId);

    return requiredTokens.every(contractId => botTokenContracts.includes(contractId));
  }, [getBotLpTokens]);

  // Load user's bots on component mount
  useEffect(() => {
    if (address) {
      loadUserBots();
    }
  }, [address]);

  // Refresh balances when page loads to ensure we have latest reward tokens
  useEffect(() => {
    if (botWalletAddresses.length > 0 && refreshBalances) {
      // Small delay to ensure balance subscriptions are established
      const timer = setTimeout(() => {
        console.log('🔄 Initial refresh for bot wallets to load latest reward tokens');
        refreshBalances(botWalletAddresses);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [botWalletAddresses, refreshBalances]);

  // Show examples only if user has no real bots
  useEffect(() => {
    if (userBots.length === 0) {
      setBots(exampleBots);
    } else {
      setBots(userBots);
    }
  }, [userBots]);

  // Poll refresh balances every 10 seconds when bots are in wait state
  useEffect(() => {
    // Check if any bot is in a wait state (recently sent tokens but not yet confirmed)
    const hasWaitingBots = userBots.some(bot => {
      if (bot.isExample || bot.strategy !== 'yield-farming') return false;

      const recentlySent = recentlySentTokens[bot.id] || [];
      const hasRecentlySentTokens = recentlySent.length > 0;
      const stillNeedsTokens = !botHasLpTokens(bot);

      return hasRecentlySentTokens && stillNeedsTokens;
    });

    if (!hasWaitingBots || !refreshBalances || botWalletAddresses.length === 0) {
      return;
    }

    // Start polling every 10 seconds
    const interval = setInterval(() => {
      console.log('🔄 Polling refresh for bot wallets in wait state');
      refreshBalances(botWalletAddresses);
    }, 10000);

    return () => clearInterval(interval);
  }, [userBots, recentlySentTokens, botHasLpTokens, refreshBalances, botWalletAddresses]);

  const loadUserBots = async () => {
    if (!address) return;

    setIsLoading(true);
    try {
      // Use regular fetch since auth is removed from list endpoint
      const response = await fetch(`/api/bots?userAddress=${address}`, {
        method: 'GET'
      });
      if (response.ok) {
        const data = await response.json();
        setUserBots(data.bots || []);
      } else {
        const error = await response.json();
        console.error('Failed to load bots:', error.error);
      }
    } catch (error) {
      console.error('Failed to load bots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBotCreated = (newBot: BotConfig) => {
    setUserBots(prev => [newBot, ...prev]);
    setIsCreateModalOpen(false);
    toast.success('Bot created successfully!', {
      description: `${newBot.name} is ready to be funded`
    });
  };

  const handleStartBot = async (botId: string) => {
    if (bots.find(bot => bot.id === botId)?.isExample) return;

    setOperatingBot(botId);
    const bot = bots.find(b => b.id === botId);

    try {
      toast.loading(`Starting ${bot?.name}...`, { id: 'bot-operation' });

      // Use signed request to start bot
      const response = await signedFetch(`/api/bots/${botId}/status`, {
        message: address,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          userAddress: address
        })
      });

      if (response.ok) {
        setBots(prev => prev.map(bot =>
          bot.id === botId ? { ...bot, status: 'active' as const } : bot
        ));
        setUserBots(prev => prev.map(bot =>
          bot.id === botId ? { ...bot, status: 'active' as const } : bot
        ));
        toast.success('Bot started successfully!', {
          id: 'bot-operation',
          description: `${bot?.name} is now active`
        });
      } else {
        const error = await response.json();
        console.error('Failed to start bot:', error.error);
        toast.error('Failed to start bot', {
          id: 'bot-operation',
          description: error.error || 'Please try again'
        });
      }
    } catch (error) {
      console.error('Failed to start bot:', error);
      toast.error('Failed to start bot', {
        id: 'bot-operation',
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setOperatingBot(null);
    }
  };

  const handlePauseBot = async (botId: string) => {
    if (bots.find(bot => bot.id === botId)?.isExample) return;

    setOperatingBot(botId);
    const bot = bots.find(b => b.id === botId);

    try {
      toast.loading(`Pausing ${bot?.name}...`, { id: 'bot-operation' });

      // Use signed request to pause bot
      const response = await signedFetch(`/api/bots/${botId}/status`, {
        message: address,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paused',
          userAddress: address
        })
      });

      if (response.ok) {
        setBots(prev => prev.map(bot =>
          bot.id === botId ? { ...bot, status: 'paused' as const } : bot
        ));
        setUserBots(prev => prev.map(bot =>
          bot.id === botId ? { ...bot, status: 'paused' as const } : bot
        ));
        toast.success('Bot paused successfully!', {
          id: 'bot-operation',
          description: `${bot?.name} is now paused`
        });
      } else {
        const error = await response.json();
        console.error('Failed to pause bot:', error.error);
        toast.error('Failed to pause bot', {
          id: 'bot-operation',
          description: error.error || 'Please try again'
        });
      }
    } catch (error) {
      console.error('Failed to pause bot:', error);
      toast.error('Failed to pause bot', {
        id: 'bot-operation',
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setOperatingBot(null);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (bots.find(bot => bot.id === botId)?.isExample) return;

    try {
      // Use signed request to delete bot
      const response = await signedFetch(`/api/bots/${botId}/status?userAddress=${address}`, {
        message: address,
        method: 'DELETE'
      });

      if (response.ok) {
        setBots(prev => prev.filter(bot => bot.id !== botId));
        setUserBots(prev => prev.filter(bot => bot.id !== botId));
      } else {
        const error = await response.json();
        console.error('Failed to delete bot:', error.error);
      }
    } catch (error) {
      console.error('Failed to delete bot:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Show toast notification
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const openInExplorer = (address: string) => {
    // Using Stacks Explorer mainnet URL
    const explorerUrl = `https://explorer.stacks.co/address/${address}`;
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  };


  const needsFunding = useCallback((bot: BotConfig) => {
    if (bot.isExample) return false;
    const stxBalance = getBotStxBalance(bot.walletAddress);
    return stxBalance === 0;
  }, [getBotStxBalance]);

  // Check if user has ALL required LP tokens
  const userHasAllLpTokens = useCallback(() => {
    if (!address) return false;

    const userLpTokens = getUserLpTokens(address);
    const userTokenContracts = userLpTokens.map(token => token.contractId);

    return YIELD_FARMING_LP_TOKENS.every(contractId => userTokenContracts.includes(contractId));
  }, [getUserLpTokens, address]);

  const needsLpTokens = useCallback((bot: BotConfig) => {
    if (bot.isExample || bot.strategy !== 'yield-farming') return false;

    // Check if user has ALL required LP tokens
    return !userHasAllLpTokens();
  }, [userHasAllLpTokens]);

  // Get missing LP tokens for a bot (excluding recently sent ones)
  const getMissingLpTokens = useCallback((bot: BotConfig) => {
    if (bot.isExample || bot.strategy !== 'yield-farming') return [];

    const botLpTokens = getBotLpTokens(bot.walletAddress);
    const botTokenContracts = botLpTokens.map(token => token.contractId);
    const recentlySent = recentlySentTokens[bot.id] || [];

    return YIELD_FARMING_LP_TOKENS.filter(contractId =>
      !botTokenContracts.includes(contractId) && !recentlySent.includes(contractId)
    );
  }, [getBotLpTokens, recentlySentTokens]);

  // Check if a token was recently sent to a bot
  const wasRecentlySent = useCallback((botId: string, contractId: string) => {
    return (recentlySentTokens[botId] || []).includes(contractId);
  }, [recentlySentTokens]);

  // Calculate maximum LP token amount for $10 cap
  const getMaxLpTokenAmount = useCallback((contractId: string, userBalance: number) => {
    const tokenPrice = getPrice(contractId);
    if (!tokenPrice) return userBalance * 0.1; // Fallback to 10% if no prices

    // Calculate max tokens worth $10
    const maxTokensFor10USD = 10 / tokenPrice;

    // Return the smaller of: user's 10% balance or $10 worth
    return Math.min(userBalance * 0.1, maxTokensFor10USD);
  }, [getPrice]);

  // Calculate total USD value of all tokens in a bot wallet
  const getBotTotalValue = useCallback((walletAddress: string): number => {
    if (!walletAddress) return 0;

    try {
      const walletBalance = getBalance(walletAddress);
      if (!walletBalance) return 0;
      
      let totalValue = 0;

      // Add STX value
      const stxBalance = getStxBalance(walletAddress);
      const stxPrice = getPrice('STX') || getPrice('.stx');
      if (stxBalance && stxPrice) {
        totalValue += stxBalance * stxPrice;
      }

      // Add all token values (including LP tokens)
      if (walletBalance.fungible_tokens) {
        Object.entries(walletBalance.fungible_tokens).forEach(([contractId, tokenData]) => {
          const tokenPrice = getPrice(contractId);
          const formattedBalance = parseFloat(tokenData.balance || '0') / Math.pow(10, 6); // Assuming 6 decimals
          if (tokenPrice && formattedBalance > 0) {
            totalValue += formattedBalance * tokenPrice;
          }
        });
      }

      return totalValue;
    } catch (error) {
      console.error('Error calculating bot total value:', error);
      return 0;
    }
  }, [getBalance, getStxBalance, getPrice]);

  // Calculate funding amount for display
  const calculateFundingAmount = useCallback((): number => {
    if (!address) return 0;

    const userStxBalance = getBotStxBalance(address);

    if (userStxBalance <= 0) return 0;

    // Calculate funding amount: 5 STX if they have 50+ STX, otherwise 1/10 of their balance
    if (userStxBalance >= 50) {
      return 5; // Use 5 STX if user has 50+ STX
    } else {
      return Math.max(0.1, userStxBalance * 0.1); // Use 1/10 of balance, minimum 0.1 STX
    }
  }, [address, getBotStxBalance]);

  const handleFundBot = async (botId: string) => {
    if (!address) return;

    // Find the bot to get its wallet address
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    setFundingBot(botId);

    try {
      // Calculate funding amount using helper function
      const fundingAmount = calculateFundingAmount();

      if (fundingAmount <= 0) {
        toast.error('Insufficient STX balance', {
          id: 'stx-transfer',
          description: 'You need STX to fund your bot'
        });
        return;
      }

      // Convert to microSTX (1 STX = 1,000,000 microSTX)
      const microStxAmount = Math.floor(fundingAmount * 1_000_000).toString();

      toast.loading('Initiating STX transfer...', { id: 'stx-transfer' });

      // Request STX transfer to the bot wallet
      const result = await request('stx_transferStx', {
        recipient: bot.walletAddress,
        amount: microStxAmount,
        memo: `Fund bot: ${bot.name}`,
        network: 'mainnet'
      });

      if (result) {
        console.log('STX transfer initiated:', result);
        toast.success('STX transfer initiated successfully!', {
          id: 'stx-transfer',
          description: `${fundingAmount.toFixed(1)} STX sent to ${bot.name}`
        });
      }
    } catch (error) {
      console.error('Failed to initiate STX transfer:', error);
      toast.error('Failed to initiate STX transfer', {
        id: 'stx-transfer',
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setFundingBot(null);
    }
  };

  const handleSendLpTokens = async (botId: string, contractId: string, amount: number) => {
    if (!address) return;

    // Find the bot to get its wallet address
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    setSendingLpTokens(botId);

    try {
      const [contractAddress, contractName] = contractId.split('.');
      if (!contractAddress || !contractName) {
        throw new Error('Invalid contract format');
      }

      // Get token metadata to determine decimals and identifier
      const decimals = getTokenDecimals(contractId);
      const tokenSymbol = getTokenSymbol(contractId);
      const tokenName = getTokenName(contractId);
      const tokenMetadata = getToken(contractId);

      // Convert amount to microunits
      const microAmount = Math.floor(amount * Math.pow(10, decimals));

      toast.loading(`Sending ${tokenSymbol || 'LP tokens'}...`, { id: 'lp-transfer' });

      const result = await request('stx_callContract', {
        contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
        functionName: 'transfer',
        functionArgs: [
          uintCV(microAmount),
          principalCV(address),
          principalCV(bot.walletAddress),
          noneCV()
        ],
        network: 'mainnet',
        postConditions: [Pc.principal(address).willSendEq(microAmount).ft(contractId as `${string}.${string}`, tokenMetadata?.identifier || 'token')]
      });

      if (result) {
        console.log('LP token transfer initiated:', result);
        toast.success('LP tokens sent successfully!', {
          id: 'lp-transfer',
          description: `${tokenSymbol} sent to ${bot.name}`
        });

        // Add to recently sent tokens for immediate UI feedback
        setRecentlySentTokens(prev => ({
          ...prev,
          [botId]: [...(prev[botId] || []), contractId]
        }));

        // Remove from recently sent after 30 seconds (enough time for potential confirmation)
        setTimeout(() => {
          setRecentlySentTokens(prev => ({
            ...prev,
            [botId]: (prev[botId] || []).filter(id => id !== contractId)
          }));
        }, 30000);
      }
    } catch (error) {
      console.error('Failed to initiate LP token transfer:', error);
      toast.error('Failed to send LP tokens', {
        id: 'lp-transfer',
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setSendingLpTokens(null);
    }
  };

  const handleWithdrawLpTokens = async (botId: string) => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    // Get bot LP tokens
    const bot = userBots.find(b => b.id === botId);
    if (!bot) {
      toast.error('Bot not found');
      return;
    }

    const withdrawableTokens = getBotWithdrawableTokens(bot.walletAddress);
    if (withdrawableTokens.length === 0) {
      toast.error('No withdrawable tokens found in bot wallet');
      return;
    }

    setWithdrawingBot(botId);

    try {
      // Withdraw all tokens sequentially
      let successCount = 0;
      let errorCount = 0;
      const results = [];

      for (const token of withdrawableTokens) {
        try {
          toast.loading(`Withdrawing ${token.symbol}...`, { id: `withdraw-${token.contractId}` });

          const response = await signedFetch(`/api/bots/${botId}/withdraw`, {
            message: address,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userAddress: address,
              contractId: token.contractId,
              amount: token.balance,
              recipient: address // Withdraw to user's address
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to withdraw LP tokens');
          }

          const result = await response.json();
          results.push({ token: token.symbol, txid: result.txid, success: true });
          successCount++;

          toast.success(`${token.symbol} withdrawal broadcast! TX: ${result.txid?.substring(0, 8)}...`, {
            id: `withdraw-${token.contractId}`
          });

        } catch (tokenError) {
          console.error(`Failed to withdraw ${token.symbol}:`, tokenError);
          errorCount++;
          const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
          results.push({ token: token.symbol, error: errorMessage, success: false });

          toast.error(`Failed to withdraw ${token.symbol}: ${errorMessage}`, {
            id: `withdraw-${token.contractId}`
          });
        }
      }

      // Show summary
      if (successCount > 0 && errorCount === 0) {
        toast.success(`All ${successCount} tokens withdrawal broadcast successfully!`, {
          description: 'Check activity tab for transaction status'
        });
      } else if (successCount > 0) {
        toast.success(`${successCount} of ${withdrawableTokens.length} tokens withdrawn successfully`, {
          description: `${errorCount} withdrawals failed - check activity for details`
        });
      }

      // Refresh activity data
      if (activityModalBot === botId) {
        fetchBotActivity(botId);
      }

    } catch (error) {
      console.error('Failed to withdraw LP tokens:', error);
      toast.error('Withdrawal process failed', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setWithdrawingBot(null);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

      return date.toLocaleDateString();
    } catch (error) {
      return dateString;
    }
  };

  // Fetch bot activity
  const fetchBotActivity = useCallback(async (botId: string) => {
    if (!address || loadingActivity[botId]) return;

    setLoadingActivity(prev => ({ ...prev, [botId]: true }));

    try {
      const response = await fetch(`/api/bots/${botId}/activity?userAddress=${address}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setActivityData(prev => ({ ...prev, [botId]: data.activities || [] }));
      } else {
        console.error('Failed to fetch bot activity:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching bot activity:', error);
    } finally {
      setLoadingActivity(prev => ({ ...prev, [botId]: false }));
    }
  }, [address, loadingActivity]);

  // Get recent activity for a bot
  const getRecentActivity = useCallback((botId: string) => {
    const activities = activityData[botId] || [];
    return activities.slice(0, 3); // Show last 3 activities
  }, [activityData]);

  // Get activity status indicator
  const getActivityStatus = useCallback((botId: string) => {
    const activities = activityData[botId] || [];
    if (activities.length === 0) return 'none';

    const recentActivity = activities[0];
    if (recentActivity.status === 'success') return 'success';
    if (recentActivity.status === 'failure') return 'failure';
    return 'pending';
  }, [activityData]);

  // Open activity modal and fetch data
  const handleViewActivity = useCallback((botId: string) => {
    setActivityModalBot(botId);
    if (!activityData[botId]) {
      fetchBotActivity(botId);
    }
  }, [activityData, fetchBotActivity]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white/95 mb-1">DeFi Automation Bots</h3>
          <p className="text-sm text-white/60">
            Automated trading strategies and yield optimization
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white border-0 shrink-0"
          size="sm"
        >
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Create Bot</span>
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="pt-6 bg-white/[0.03] border-white/[0.08]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider">Bots</p>
                <p className="text-xl font-bold text-white/95">{bots.length}</p>
              </div>
              <Bot className="w-6 h-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="pt-6 bg-white/[0.03] border-white/[0.08]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider">Active</p>
                <p className="text-xl font-bold text-green-400">
                  {bots.filter(bot => bot.status === 'active').length}
                </p>
              </div>
              <Activity className="w-6 h-6 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="pt-6 bg-white/[0.03] border-white/[0.08]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider">Gas</p>
                <p className="text-xl font-bold text-white/95">
                  {bots.reduce((sum, bot) => sum + getBotStxBalance(bot.walletAddress), 0).toFixed(3)}
                </p>
              </div>
              <Fuel className="w-6 h-6 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="pt-6 bg-white/[0.03] border-white/[0.08]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider">Value</p>
                <p className="text-xl font-bold text-white/95">
                  ${(bots.reduce((sum, bot) => sum + getBotTotalValue(bot.walletAddress), 0)).toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bots List */}
      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardHeader>
          <CardTitle className="text-white/95 flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {userBots.length > 0 ? 'Your Bots' : 'Example Bots'}
            {userBots.length === 0 && (
              <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
              <h3 className="text-base font-medium text-white/90 mb-1">Loading bots...</h3>
              <p className="text-sm text-white/60">Fetching your automation bots</p>
            </div>
          ) : bots.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                <Bot className="w-6 h-6 text-white/40" />
              </div>
              <h3 className="text-base font-medium text-white/90 mb-2">No bots created yet</h3>
              <p className="text-sm text-white/60 max-w-sm mx-auto mb-4">
                Create your first automation bot to start earning with DeFi strategies.
              </p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white border-0"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Bot
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {bots.map((bot) => (
                <div
                  key={bot.id}
                  className="relative p-3 bg-white/[0.02] rounded-lg border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-200"
                >
                  <div className={`${needsFunding(bot) ? 'blur-sm' : ''}`}>
                    {/* Mobile Layout */}
                    <div className="flex flex-col gap-3 lg:hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-white/95 text-sm">{bot.name}</h4>
                            <p className="text-xs text-white/60">{bot.strategy}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white/95">
                            {formatCurrency(getBotTotalValue(bot.walletAddress))}
                          </p>
                          <p className="text-xs text-white/60">Value</p>
                        </div>
                      </div>

                      {/* Mobile Status and Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-xs ${statusColors[bot.status]} border`}>
                            {statusIcons[bot.status]}
                            <span className="ml-1 capitalize">{bot.status}</span>
                          </Badge>
                          {(() => {
                            if (needsFunding(bot)) {
                              return (
                                <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Fund
                                </Badge>
                              );
                            }
                            if (bot.strategy === 'yield-farming' && !bot.isExample) {
                              const activityStatus = getActivityStatus(bot.id);
                              if (activityStatus === 'success') {
                                return (
                                  <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                                    <Zap className="w-3 h-3 mr-1" />
                                    Farming
                                  </Badge>
                                );
                              } else if (activityStatus === 'pending') {
                                return (
                                  <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Broadcasting
                                  </Badge>
                                );
                              } else if (activityStatus === 'failure') {
                                return (
                                  <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Failed
                                  </Badge>
                                );
                              } else if (botHasLpTokens(bot)) {
                                return (
                                  <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Ready
                                  </Badge>
                                );
                              } else {
                                // Check for partial setup
                                const botLpTokens = getBotLpTokens(bot.walletAddress);
                                const missingTokens = getMissingLpTokens(bot);

                                if (botLpTokens.length > 0) {
                                  return (
                                    <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {3 - missingTokens.length}/3 Setup
                                    </Badge>
                                  );
                                }
                              }
                            }
                            return bot.isExample ? (
                              <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                                Demo
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex items-center gap-1">
                          {bot.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePauseBot(bot.id)}
                              disabled={bot.isExample || operatingBot === bot.id}
                              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50 h-8 w-8 p-0"
                            >
                              <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartBot(bot.id)}
                              disabled={bot.isExample || operatingBot === bot.id}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 disabled:opacity-50 h-8 w-8 p-0"
                            >
                              <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          )}
                          {bot.strategy === 'yield-farming' && !bot.isExample && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewActivity(bot.id)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 w-8 p-0"
                              >
                                <History className="w-3 h-3 sm:w-4 sm:h-4" />
                              </Button>
                              {getBotWithdrawableTokens(bot.walletAddress).length > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setWithdrawalConfirmBot(bot.id)}
                                  disabled={withdrawingBot === bot.id}
                                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 disabled:opacity-50 h-8 w-8 p-0"
                                >
                                  <ArrowUpLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Mobile Details */}
                      <div className="flex items-center justify-between text-xs text-white/50">
                        <div className="flex items-center gap-2">
                          <span>{truncateAddress(bot.walletAddress)}</span>
                          <Copy
                            className="w-3 h-3 text-white/40 hover:text-white/70 cursor-pointer"
                            onClick={() => copyToClipboard(bot.walletAddress)}
                          />
                        </div>
                        <span>{getBotStxBalance(bot.walletAddress).toFixed(1)} STX</span>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden lg:flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                          <Bot className="w-5 h-5 text-blue-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-medium text-white/95 truncate">{bot.name}</h4>
                            <Badge className={`text-xs ${statusColors[bot.status]} border shrink-0`}>
                              {statusIcons[bot.status]}
                              <span className="ml-1 capitalize">{bot.status}</span>
                            </Badge>
                            {(() => {
                              if (needsFunding(bot)) {
                                return (
                                  <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30 shrink-0">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Needs Funding
                                  </Badge>
                                );
                              }
                              if (bot.strategy === 'yield-farming' && !bot.isExample) {
                                const activityStatus = getActivityStatus(bot.id);
                                if (activityStatus === 'success') {
                                  return (
                                    <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 shrink-0">
                                      <Zap className="w-3 h-3 mr-1" />
                                      Active Farming
                                    </Badge>
                                  );
                                } else if (activityStatus === 'pending') {
                                  return (
                                    <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shrink-0">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Broadcasting
                                    </Badge>
                                  );
                                } else if (activityStatus === 'failure') {
                                  return (
                                    <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30 shrink-0">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Farm Failed
                                    </Badge>
                                  );
                                } else if (botHasLpTokens(bot)) {
                                  return (
                                    <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 shrink-0">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      LP Ready
                                    </Badge>
                                  );
                                } else {
                                  // Check for partial setup
                                  const botLpTokens = getBotLpTokens(bot.walletAddress);
                                  const missingTokens = getMissingLpTokens(bot);

                                  if (botLpTokens.length > 0) {
                                    return (
                                      <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shrink-0">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {3 - missingTokens.length}/3 LP Setup
                                      </Badge>
                                    );
                                  }
                                }
                              }
                              return bot.isExample ? (
                                <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30 shrink-0">
                                  Example
                                </Badge>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-white/50">
                            <div className="flex items-center gap-2">
                              <span>{truncateAddress(bot.walletAddress)}</span>
                              <Copy
                                className="w-3 h-3 text-white/40 hover:text-white/70 cursor-pointer"
                                onClick={() => copyToClipboard(bot.walletAddress)}
                              />
                              <ExternalLink
                                className="w-3 h-3 text-white/40 hover:text-white/70 cursor-pointer"
                                onClick={() => openInExplorer(bot.walletAddress)}
                              />
                            </div>
                            <span>{getBotStxBalance(bot.walletAddress).toFixed(1)} STX</span>
                            {bot.strategy === 'yield-farming' && (() => {
                              const lpTokens = getBotLpTokens(bot.walletAddress);
                              return lpTokens.length > 0 ? (
                                <span>LP: {lpTokens.map(t => t.symbol).join(', ')}</span>
                              ) : null;
                            })()}
                            <span>Active: {formatRelativeTime(bot.lastActive)}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs text-white/60">Total Value</p>
                          <p className="text-sm font-medium text-white/95">
                            {formatCurrency(getBotTotalValue(bot.walletAddress))}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-4 shrink-0">
                        {bot.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePauseBot(bot.id)}
                            disabled={bot.isExample || operatingBot === bot.id}
                            className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50 px-2"
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartBot(bot.id)}
                            disabled={bot.isExample || operatingBot === bot.id}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10 disabled:opacity-50 px-2"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}

                        {bot.strategy === 'yield-farming' && !bot.isExample && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewActivity(bot.id)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            {getBotWithdrawableTokens(bot.walletAddress).length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setWithdrawalConfirmBot(bot.id)}
                                disabled={withdrawingBot === bot.id}
                                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 disabled:opacity-50 px-2"
                              >
                                <ArrowUpLeft className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Funding Alert Overlay */}
                  {needsFunding(bot) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-xl">
                      <div className="bg-yellow-50 dark:bg-yellow-950/80 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-6 shadow-xl max-w-sm mx-4 backdrop-blur-md">
                        <div className="text-center">
                          <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800/50 flex items-center justify-center mx-auto mb-4">
                            <Wallet className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <h4 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Fund Your Bot</h4>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                            Transfer STX to your bot wallet to start automation
                          </p>
                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => handleFundBot(bot.id)}
                              disabled={fundingBot === bot.id || calculateFundingAmount() === 0}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium disabled:opacity-50"
                            >
                              {fundingBot === bot.id ? 'Funding...' :
                                calculateFundingAmount() === 0 ? 'Insufficient STX' :
                                  `Fund with ${calculateFundingAmount().toFixed(1)} STX`}
                            </Button>
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              Wallet: {truncateAddress(bot.walletAddress)}
                            </p>
                            {calculateFundingAmount() > 0 && (
                              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                {calculateFundingAmount() === 5 ?
                                  '5 STX (you have 50+ STX)' :
                                  `10% of your ${getBotStxBalance(address || '').toFixed(1)} STX balance`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LP Token Alert Overlay for Yield Farming */}
                  {!needsFunding(bot) && needsLpTokens(bot) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-xl">
                      <div className="bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/50 rounded-lg p-6 shadow-xl max-w-sm mx-4 backdrop-blur-md">
                        <div className="text-center">
                          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">Need All LP Tokens</h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                            Yield farming requires ALL 3 LP token types. Get them via swap to activate your bot.
                          </p>

                          <div className="space-y-2 mb-4">
                            {(() => {
                              const userLpTokens = getUserLpTokens(address || '');
                              const userTokenContracts = userLpTokens.map(t => t.contractId);

                              const tokenNames = {
                                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow': 'SXC',
                                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1': 'DEX',
                                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit': 'POV'
                              };

                              return YIELD_FARMING_LP_TOKENS.map(contractId => {
                                const hasToken = userTokenContracts.includes(contractId);
                                const tokenSymbol = tokenNames[contractId as keyof typeof tokenNames] || 'Unknown';

                                return (
                                  <div key={contractId} className="flex items-center gap-2 text-sm">
                                    <div className={`w-2 h-2 rounded-full ${hasToken ? 'bg-green-400' : 'bg-red-400'}`} />
                                    <span className={hasToken ? 'text-green-600 dark:text-green-400' : 'text-blue-700 dark:text-blue-300'}>
                                      {tokenSymbol} {hasToken ? '✓' : '(missing)'}
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => window.open('/swap', '_blank')}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                            >
                              Swap for LP Tokens
                            </Button>
                            <Button
                              onClick={() => window.open('https://invest.charisma.rocks', '_blank')}
                              variant="outline"
                              className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              Add Liquidity on Charisma
                            </Button>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                              <strong>Swap:</strong> Trade existing tokens for LP tokens<br />
                              <strong>Add Liquidity:</strong> Provide liquidity to earn LP tokens
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Multi-Token Setup Overlay for Yield Farming */}
                  {!needsFunding(bot) && userHasAllLpTokens() && bot.strategy === 'yield-farming' && !botHasLpTokens(bot) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-xl">
                      <div className="bg-green-50 dark:bg-green-950/95 border border-green-200 dark:border-green-800/50 rounded-lg p-6 shadow-xl max-w-md mx-4 backdrop-blur-md">
                        <div className="text-center mb-4">
                          <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800/50 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <h4 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">Setup LP Tokens</h4>
                          <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                            Send all 3 LP token types to your bot for optimal yield farming.
                          </p>
                        </div>

                        <div className="space-y-3 mb-4">
                          {(() => {
                            const userLpTokens = getUserLpTokens(address || '');
                            const missingTokens = getMissingLpTokens(bot);

                            return YIELD_FARMING_LP_TOKENS.map(contractId => {
                              const userToken = userLpTokens.find(t => t.contractId === contractId);
                              const botHasThis = !missingTokens.includes(contractId);
                              const recentlySent = wasRecentlySent(bot.id, contractId);

                              if (!userToken) return null;

                              const maxAmount = getMaxLpTokenAmount(contractId, userToken.formattedBalance);
                              const tokenPrice = getPrice(contractId);
                              const usdValue = tokenPrice ?
                                (maxAmount * tokenPrice).toFixed(2) : '?';

                              // Determine status: confirmed > recently sent > missing
                              let statusColor = 'bg-gray-400';
                              let statusText = `Send (~$${usdValue})`;
                              let showButton = true;

                              if (botHasThis) {
                                statusColor = 'bg-green-400';
                                statusText = '✓ Confirmed';
                                showButton = false;
                              } else if (recentlySent) {
                                statusColor = 'bg-yellow-400';
                                statusText = '⏳ Broadcasting...';
                                showButton = false;
                              }

                              return (
                                <div key={contractId} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                                    <span className="text-sm font-medium text-white">{userToken.symbol}</span>
                                  </div>
                                  {showButton && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleSendLpTokens(bot.id, contractId, maxAmount)}
                                      disabled={sendingLpTokens === bot.id}
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                                    >
                                      {sendingLpTokens === bot.id ? 'Sending...' : statusText}
                                    </Button>
                                  )}
                                  {!showButton && (
                                    <span className={`text-xs ${botHasThis ? 'text-green-400' : 'text-yellow-400'}`}>
                                      {statusText}
                                    </span>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>

                        <p className="text-xs text-green-600 dark:text-green-400 text-center">
                          {(() => {
                            const missing = getMissingLpTokens(bot).length;
                            const recentlySent = (recentlySentTokens[bot.id] || []).length;
                            const confirmed = getBotLpTokens(bot.walletAddress).length;

                            if (missing === 0 && recentlySent === 0) {
                              return "All tokens confirmed!";
                            } else if (recentlySent > 0) {
                              return `${missing} missing, ${recentlySent} broadcasting, ${confirmed} confirmed`;
                            } else {
                              return `${missing} of 3 tokens remaining`;
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Bot Modal */}
      <CreateBotModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onBotCreated={handleBotCreated}
      />

      {/* Information Card */}
      <Card className="pt-6 bg-white/[0.03] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-white/95 mb-2">About Yield Farming Bots</h4>
              <p className="text-sm text-white/70 mb-4">
                The more LP tokens you hold, the faster you generate reward tokens which can be harvested every fast block.
                Because of this fast cycle, it makes sense to have a bot do it automatically.
                Bots require ALL 3 LP token types (SXC, DEX, POV) to activate and begin automated farming.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-white/90 mb-2">Requirements:</h5>
                  <ul className="space-y-1 text-white/60">
                    <li>• All 3 LP token types required</li>
                    <li>• SXC, DEX, and POV tokens</li>
                    <li>• STX for transaction fees</li>
                    <li>• Automated hourly execution</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-white/90 mb-2">Setup Process:</h5>
                  <ul className="space-y-1 text-white/60">
                    <li>• Create bot with guided setup</li>
                    <li>• Fund bot wallet with STX</li>
                    <li>• Send all 3 LP token types</li>
                    <li>• Activate for automated farming</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Confirmation Dialog */}
      <Dialog open={!!withdrawalConfirmBot} onOpenChange={(open) => !open && setWithdrawalConfirmBot(null)}>
        <DialogContent className="max-w-md bg-background border border-border backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ArrowUpLeft className="w-5 h-5 text-purple-400" />
              Withdraw LP Tokens
            </DialogTitle>
          </DialogHeader>

          {withdrawalConfirmBot && (() => {
            const bot = userBots.find(b => b.id === withdrawalConfirmBot);
            const withdrawableTokens = bot ? getBotWithdrawableTokens(bot.walletAddress) : [];
            const lpTokens = withdrawableTokens.filter(t => t.type === 'lp');
            const rewardTokens = withdrawableTokens.filter(t => t.type === 'reward');

            return (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                    <ArrowUpLeft className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white/95 mb-2">Withdraw All Tokens</h3>
                  <p className="text-sm text-white/60 mb-4">
                    This will withdraw all {withdrawableTokens.length} tokens from your bot back to your wallet.
                  </p>
                </div>

                {withdrawableTokens.length > 0 && (
                  <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.05]">
                    <div className="space-y-3">
                      {lpTokens.length > 0 && (
                        <>
                          <div className="text-sm text-white/60 mb-2">LP Tokens:</div>
                          {lpTokens.map((token) => (
                            <div key={token.contractId} className="flex justify-between items-center py-2 border-b border-white/[0.05] last:border-b-0">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  {getTokenImage(token.contractId) ? (
                                    <img
                                      src={getTokenImage(token.contractId)!}
                                      alt={token.symbol}
                                      className="w-8 h-8 rounded-full bg-white/10"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (nextElement) nextElement.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center ${getTokenImage(token.contractId) ? 'hidden' : 'flex'}`}>
                                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-white/90 font-medium text-sm">{token.symbol}</span>
                                  <span className="text-xs text-white/50">LP Token</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-white/90 text-sm">{(parseFloat(token.balance) / 1000000).toFixed(6)}</div>
                                <div className="text-white/60 text-xs">{calculateUsdValue(token.contractId, token.formattedBalance)}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {rewardTokens.length > 0 && (
                        <>
                          {lpTokens.length > 0 && <div className="border-t border-white/[0.05] pt-2" />}
                          <div className="text-sm text-white/60 mb-2">Reward Tokens:</div>
                          {rewardTokens.map((token) => (
                            <div key={token.contractId} className="flex justify-between items-center py-2 border-b border-white/[0.05] last:border-b-0">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  {getTokenImage(token.contractId) ? (
                                    <img
                                      src={getTokenImage(token.contractId)!}
                                      alt={token.symbol}
                                      className="w-8 h-8 rounded-full bg-white/10"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (nextElement) nextElement.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center ${getTokenImage(token.contractId) ? 'hidden' : 'flex'}`}>
                                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-white/90 font-medium text-sm">{token.symbol}</span>
                                  <span className="text-xs text-yellow-400">Reward Token</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-white/90 text-sm">{(parseFloat(token.balance) / 1000000).toFixed(6)}</div>
                                <div className="text-white/60 text-xs">{calculateUsdValue(token.contractId, token.formattedBalance)}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      <div className="space-y-2 pt-2 border-t border-white/[0.05]">
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Total Value:</span>
                          <span className="text-white/90 text-sm font-medium">
                            {(() => {
                              const totalValue = withdrawableTokens.reduce((sum, token) => {
                                const tokenPrice = getPrice(token.contractId) || 0;
                                return sum + (token.formattedBalance * tokenPrice);
                              }, 0);
                              return totalValue > 0 ? `$${totalValue.toFixed(2)}` : '~';
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Recipient:</span>
                          <span className="text-white/90 font-mono text-xs">
                            {address?.slice(0, 6)}...{address?.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-yellow-300 font-medium">Multiple Transactions</p>
                      <p className="text-xs text-yellow-400 mt-1">
                        Each token requires a separate transaction. You'll need to approve {withdrawableTokens.length} transactions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setWithdrawalConfirmBot(null)}
                    className="text-white/70"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (withdrawalConfirmBot) {
                        handleWithdrawLpTokens(withdrawalConfirmBot);
                        setWithdrawalConfirmBot(null);
                      }
                    }}
                    disabled={withdrawingBot === withdrawalConfirmBot}
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    {withdrawingBot === withdrawalConfirmBot ? 'Withdrawing...' : `Withdraw All ${withdrawableTokens.length} Tokens`}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Activity Modal */}
      <Dialog open={!!activityModalBot} onOpenChange={(open) => !open && setActivityModalBot(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[85vh] p-4 sm:p-6">
          <DialogHeader className="pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="hidden sm:inline">Farming Activity</span>
              <span className="sm:hidden">Activity</span>
              {activityModalBot && (() => {
                const bot = bots.find(b => b.id === activityModalBot);
                return bot ? ` - ${bot.name}` : '';
              })()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[65vh] overflow-y-auto">
            {activityModalBot && loadingActivity[activityModalBot] ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                <span className="ml-3 text-white/60">Loading activity...</span>
              </div>
            ) : activityModalBot && activityData[activityModalBot]?.length ? (
              <div className="space-y-2">
                {activityData[activityModalBot].map((activity) => (
                  <div key={activity.id} className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.08]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${activity.status === 'success' ? 'bg-green-400' :
                          activity.status === 'failure' ? 'bg-red-400' : 'bg-yellow-400'
                          }`} />
                        <span className="text-sm font-medium text-white/90">
                          {activity.action === 'yield-farming' ? 'Yield Farming' :
                            activity.action === 'withdraw-lp-tokens' ? 'LP Token Withdrawal' :
                              activity.action}
                        </span>
                        <Badge className={`text-xs ${activity.status === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          activity.status === 'failure' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }`}>
                          {activity.status === 'pending' ? 'Broadcasting...' :
                            activity.status === 'success' ? 'Confirmed' :
                              activity.status === 'failure' ? 'Failed' : activity.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-white/50">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                    </div>

                    <div className="text-xs text-white/70 space-y-1">
                      {activity.action === 'withdraw-lp-tokens' && activity.amount && (
                        <div className="flex items-center gap-2">
                          <span>Amount:</span>
                          <span className="text-white/90">{(activity.amount / 1000000).toFixed(6)} LP</span>
                        </div>
                      )}
                      {activity.action === 'withdraw-lp-tokens' && activity.recipient && (
                        <div className="flex items-center gap-2">
                          <span>To:</span>
                          <span className="text-white/90 font-mono text-xs">
                            {activity.recipient.slice(0, 6)}...{activity.recipient.slice(-6)}
                          </span>
                        </div>
                      )}
                      {activity.txid && (
                        <div className="flex items-center gap-2">
                          <span>TX:</span>
                          <a
                            href={`https://explorer.stacks.co/txid/${activity.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                          >
                            {activity.txid.slice(0, 6)}...{activity.txid.slice(-6)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      {activity.blockHeight && (
                        <div className="flex items-center gap-2">
                          <span>Block:</span>
                          <span className="text-white/90">#{activity.blockHeight}</span>
                        </div>
                      )}
                      {activity.blockTime && (
                        <div className="flex items-center gap-2">
                          <span>Confirmed:</span>
                          <span className="text-white/90">{formatRelativeTime(activity.blockTime)}</span>
                        </div>
                      )}
                      {activity.errorMessage && (
                        <div className="text-red-400 text-xs mt-1 p-2 bg-red-500/10 rounded border border-red-500/20">
                          {activity.errorMessage.length > 100 ?
                            `${activity.errorMessage.slice(0, 100)}...` :
                            activity.errorMessage
                          }
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : activityModalBot ? (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-white/40 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-white/90 mb-2">No Activity Yet</h3>
                <p className="text-white/60">
                  This bot hasn't performed any farming operations yet. Activity will appear here once the automated farming starts.
                </p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}