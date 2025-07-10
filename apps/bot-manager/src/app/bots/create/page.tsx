'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBots } from '@/contexts/bot-context';
import { useNotifications } from '@/contexts/notification-context';
import { CreateBotRequest } from '@/types/bot';
import { StrategyCodeEditor } from '@/components/strategy-code-editor';
import { getStrategyTemplates, type StrategyMetadata } from '@/lib/strategy-parser';
import Link from 'next/link';

export default function CreateBotPage() {
  const router = useRouter();
  const { createBot } = useBots();
  const { showSuccess, showError } = useNotifications();
  const [isCreating, setIsCreating] = useState(false);
  const [strategyCode, setStrategyCode] = useState('');
  const [formData, setFormData] = useState({
    name: ''
  });

  // Initialize with hello world template
  React.useEffect(() => {
    const templates = getStrategyTemplates();
    setStrategyCode(templates.helloWorld.code);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !strategyCode) {
      showError('Please fill in all required fields', 'Bot name and strategy code are required');
      return;
    }

    // Strategy validation removed - simplified interface

    setIsCreating(true);
    try {
      const createRequest: CreateBotRequest = {
        name: formData.name,
        strategy: strategyCode
      };

      await createBot(createRequest);
      showSuccess('Bot created successfully', 'Redirecting to bots page...');
      router.push('/bots');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to create bot', errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStrategyCodeChange = (code: string) => {
    setStrategyCode(code);
  };

  const handleStrategySave = (code: string) => {
    setStrategyCode(code);
  };

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

          </CardContent>
        </Card>

        {/* Strategy Code */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <StrategyCodeEditor
              initialCode={strategyCode}
              onCodeChange={handleStrategyCodeChange}
              onSave={handleStrategySave}
              height="400px"
            />
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
            disabled={!formData.name || !strategyCode || isCreating}
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