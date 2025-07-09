'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useBots } from '@/contexts/bot-context';
import { useNotifications } from '@/contexts/notification-context';
import { useSettings } from '@/contexts/settings-context';
import { CreateBotRequest } from '@/types/bot';
import Link from 'next/link';

const strategies = [
  {
    id: 'yield-farming',
    name: 'Yield Farming',
    description: 'Automated liquidity pool farming for maximum yield',
    icon: '🌾',
    complexity: 'Beginner',
    estimatedReturns: '5-15% APY'
  },
  {
    id: 'dca',
    name: 'Dollar Cost Averaging',
    description: 'Automatically buy assets at regular intervals',
    icon: '📈',
    complexity: 'Beginner',
    estimatedReturns: '3-8% APY'
  },
  {
    id: 'arbitrage',
    name: 'Arbitrage Trading',
    description: 'Profit from price differences across exchanges',
    icon: '⚡',
    complexity: 'Advanced',
    estimatedReturns: '10-25% APY'
  },
  {
    id: 'liquidity-mining',
    name: 'Liquidity Mining',
    description: 'Provide liquidity to earn rewards and fees',
    icon: '💧',
    complexity: 'Intermediate',
    estimatedReturns: '8-20% APY'
  }
];

export default function CreateBotPage() {
  const router = useRouter();
  const { createBot } = useBots();
  const { showSuccess, showError } = useNotifications();
  const { settings } = useSettings();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateBotRequest>({
    name: '',
    strategy: settings.botDefaults.defaultStrategy as any,
    maxGasPrice: settings.botDefaults.defaultGasPrice,
    slippageTolerance: settings.botDefaults.defaultSlippage,
    autoRestart: settings.botDefaults.autoRestart
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.strategy) {
      showError('Please fill in all required fields', 'Bot name and strategy are required');
      return;
    }

    setIsCreating(true);
    try {
      await createBot(formData);
      showSuccess('Bot created successfully', 'Redirecting to bots page...');
      router.push('/bots');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to create bot', errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const selectedStrategy = strategies.find(s => s.id === formData.strategy);

  return (
    <div className="p-6 max-w-4xl mx-auto bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button asChild variant="ghost" size="icon" className="text-foreground">
          <Link href="/bots">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New Bot</h1>
          <p className="text-muted-foreground">Set up your automated trading bot</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-card-foreground">Bot Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter a name for your bot"
                className="bg-input border-border text-foreground"
                required
              />
            </div>

            <div>
              <Label htmlFor="strategy" className="text-card-foreground">Strategy</Label>
              <Select value={formData.strategy} onValueChange={(value) => setFormData({ ...formData, strategy: value as any })}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Select a trading strategy" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {strategies.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.id} className="text-popover-foreground">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{strategy.icon}</span>
                        <div>
                          <div className="font-medium">{strategy.name}</div>
                          <div className="text-xs text-muted-foreground">{strategy.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStrategy && (
              <div className="p-4 bg-muted rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{selectedStrategy.icon}</span>
                  <div>
                    <h3 className="font-medium text-card-foreground">{selectedStrategy.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedStrategy.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Complexity: </span>
                    <span className="text-card-foreground">{selectedStrategy.complexity}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Returns: </span>
                    <span className="text-green-400">{selectedStrategy.estimatedReturns}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Advanced Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="maxGasPrice" className="text-card-foreground">Max Gas Price (microSTX)</Label>
              <Input
                id="maxGasPrice"
                type="number"
                value={formData.maxGasPrice}
                onChange={(e) => setFormData({ ...formData, maxGasPrice: parseInt(e.target.value) })}
                placeholder="1000"
                className="bg-input border-border text-foreground"
                min="100"
                max="10000"
                step="100"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum gas price the bot will pay for transactions</p>
            </div>

            <div>
              <Label htmlFor="slippageTolerance" className="text-card-foreground">Slippage Tolerance (%)</Label>
              <Input
                id="slippageTolerance"
                type="number"
                value={formData.slippageTolerance}
                onChange={(e) => setFormData({ ...formData, slippageTolerance: parseFloat(e.target.value) })}
                placeholder="0.5"
                className="bg-input border-border text-foreground"
                min="0.1"
                max="5"
                step="0.1"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum slippage tolerance for trades</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoRestart" className="text-card-foreground">Auto Restart</Label>
                <p className="text-xs text-muted-foreground">Automatically restart bot if it encounters errors</p>
              </div>
              <Switch
                id="autoRestart"
                checked={formData.autoRestart}
                onCheckedChange={(checked) => setFormData({ ...formData, autoRestart: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-400 mb-1">Security Notice</h3>
                <p className="text-sm text-yellow-300">
                  A new wallet will be generated for this bot. You'll need to fund it with STX for gas fees 
                  and any required LP tokens for your chosen strategy. Keep your bot wallet secure.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button asChild variant="outline" className="border-border text-foreground">
            <Link href="/bots">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={!formData.name || !formData.strategy || isCreating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating Bot...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Create Bot
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}