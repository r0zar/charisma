'use client';

import React, { useState } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { signedFetch } from 'blaze-sdk';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot } from 'lucide-react';

interface CreateBotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBotCreated: (bot: any) => void;
}

const strategies = [
  {
    id: 'yield-farming',
    name: 'Yield Farming',
    description: 'Optimize liquidity pool positions for maximum yield'
  }
];

export default function CreateBotModal({ open, onOpenChange, onBotCreated }: CreateBotModalProps) {
  const { address } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState('');

  const resetModal = () => {
    setSelectedStrategy('');
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const createBot = async () => {
    if (!address || !selectedStrategy) return;

    setIsLoading(true);
    try {
      // Call API to create bot with wallet generation on backend
      const response = await signedFetch('/api/bots/create', {
        message: address, // Sign the user's address
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategy: selectedStrategy,
          userAddress: address
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create bot');
      }

      const bot = await response.json();
      onBotCreated(bot);
      handleClose(); // Close modal immediately after creation
    } catch (error) {
      console.error('Failed to create bot:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border border-border backdrop-blur-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Create DeFi Bot
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-accent-text" />
            </div>
            <h3 className="text-lg font-semibold text-ink mb-2">Choose Your Strategy</h3>
            <p className="text-sm text-ink-muted">
              Select an automation strategy for your DeFi bot
            </p>
          </div>

          <div>
            <Label className="text-ink-body">Strategy</Label>
            <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
              <SelectTrigger className="bg-surface border-line text-ink">
                <SelectValue placeholder="Select a strategy" />
              </SelectTrigger>
              <SelectContent className="bg-surface-raised border-line">
                {strategies.map((strategy) => (
                  <SelectItem key={strategy.id} value={strategy.id} className="text-ink">
                    <div>
                      <div className="font-medium">{strategy.name}</div>
                      <div className="text-xs text-ink-muted">{strategy.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleClose} className="text-ink-body">
              Cancel
            </Button>
            <Button
              onClick={createBot}
              disabled={!selectedStrategy || isLoading}
              className="bg-accent hover:bg-accent text-on-accent"
            >
              {isLoading ? 'Creating Bot...' : 'Create Bot'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}