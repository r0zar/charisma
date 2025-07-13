'use client';

import {
  Copy,
  ExternalLink,
  Shield,
} from 'lucide-react';
import React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentBot } from '@/contexts/current-bot-context';
import { useToast } from '@/contexts/toast-context';
import { formatCurrency } from '@/lib/utils';

export default function BotWalletPage() {
  const { bot } = useCurrentBot();
  const { showSuccess, showError } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess('Copied to clipboard'))
      .catch(() => showError('Failed to copy to clipboard'));
  };

  const openInExplorer = (address: string) => {
    window.open(`https://explorer.stacks.co/address/${address}`, '_blank');
  };

  if (!bot) {
    return null; // Layout will handle loading state
  }

  return (
    <div className="space-y-4 mb-96">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Wallet Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-card-foreground">Bot Wallet Address</Label>
              <div className="flex items-center gap-2 mt-1 w-full">
                <Input
                  value={bot.id}
                  disabled
                  className="bg-input border-border text-foreground flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(bot.id)}
                  className="border-border text-foreground"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openInExplorer(bot.id)}
                  className="border-border text-foreground"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-card-foreground">Owner Address</Label>
              <div className="flex items-center gap-2 mt-1 w-full">
                <Input
                  value={bot.ownerId}
                  disabled
                  className="bg-input border-border text-foreground flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(bot.ownerId)}
                  className="border-border text-foreground"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openInExplorer(bot.ownerId)}
                  className="border-border text-foreground"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <Label className="text-card-foreground">Public Key</Label>
              <div className="flex items-center gap-2 mt-1 w-full">
                <Input
                  value={bot.publicKey || 'Not available'}
                  disabled
                  className="bg-input border-border text-foreground flex-1 font-mono text-sm"
                />
                {bot.publicKey && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(bot.publicKey!)}
                    className="border-border text-foreground"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

          </div>

          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Shield className="w-4 h-4 text-blue-400" />
            <AlertDescription className="text-blue-300">
              Bot wallets are automatically managed with encrypted private keys. The bot can execute transactions securely without exposing sensitive data.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">STX Balance</div>
              <div className="text-lg font-semibold text-card-foreground">0.00 STX</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Total Value</div>
              <div className="text-lg font-semibold text-card-foreground">
                {formatCurrency(0)}
              </div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Wallet Security</div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-card-foreground">Encrypted</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}