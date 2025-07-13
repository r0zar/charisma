'use client';

import { AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { StrategyCodeEditor } from '@/components/strategy-code-editor';
import { getStrategyTemplates } from '@/components/strategy-code-editor/strategy-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBots } from '@/contexts/bot-context';
import { useToast } from '@/contexts/toast-context';
import { CreateBotRequest } from '@/schemas/bot.schema';

export default function CreateBotPage() {
  const router = useRouter();
  const { createBot } = useBots();
  const { showSuccess, showError } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [strategyCode, setStrategyCode] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    gitRepository: '',
    isMonorepo: false,
    packagePath: '',
    buildCommands: ['pnpm install', 'pnpm run build']
  });
  const [showRepoConfig, setShowRepoConfig] = useState(false);

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
        strategy: strategyCode,
        gitRepository: formData.gitRepository.trim() || undefined,
        isMonorepo: formData.isMonorepo ? formData.isMonorepo : undefined,
        packagePath: formData.packagePath.trim() || undefined,
        buildCommands: formData.buildCommands.filter(cmd => cmd.trim()).length > 0
          ? formData.buildCommands.filter(cmd => cmd.trim())
          : undefined
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

        {/* Repository Configuration */}
        <Card className="bg-card border-border">
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowRepoConfig(!showRepoConfig)}
          >
            <div className="flex items-center gap-2">
              {showRepoConfig ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <CardTitle className="text-card-foreground">Repository Configuration (Optional)</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              {showRepoConfig ?
                "Configure which git repository to use for strategy execution. Leave empty to run in a clean Node.js environment." :
                "Click to configure a custom git repository for your strategy execution."
              }
            </p>
          </CardHeader>
          {showRepoConfig && (
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="gitRepository" className="text-card-foreground">Git Repository URL (optional)</Label>
                <Input
                  id="gitRepository"
                  type="url"
                  value={formData.gitRepository}
                  onChange={(e) => setFormData({ ...formData, gitRepository: e.target.value })}
                  placeholder="https://github.com/username/repository.git"
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must be a public repository. If not specified, strategies run in a clean Node.js environment without external dependencies.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isMonorepo"
                  checked={formData.isMonorepo}
                  onCheckedChange={(checked) => setFormData({ ...formData, isMonorepo: checked })}
                />
                <Label htmlFor="isMonorepo" className="text-card-foreground">This is a monorepo</Label>
              </div>

              {formData.isMonorepo && (
                <div>
                  <Label htmlFor="packagePath" className="text-card-foreground">Package Path</Label>
                  <Input
                    id="packagePath"
                    type="text"
                    value={formData.packagePath}
                    onChange={(e) => setFormData({ ...formData, packagePath: e.target.value })}
                    placeholder="packages/polyglot"
                    className="bg-input border-border text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Path to the package within the monorepo (e.g., "packages/polyglot")
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="buildCommands" className="text-card-foreground">Build Commands</Label>
                <div className="space-y-2">
                  {formData.buildCommands.map((command, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="text"
                        value={command}
                        onChange={(e) => {
                          const newCommands = [...formData.buildCommands];
                          newCommands[index] = e.target.value;
                          setFormData({ ...formData, buildCommands: newCommands });
                        }}
                        placeholder="pnpm install"
                        className="bg-input border-border text-foreground"
                      />
                      {formData.buildCommands.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newCommands = formData.buildCommands.filter((_, i) => i !== index);
                            setFormData({ ...formData, buildCommands: newCommands });
                          }}
                          className="shrink-0"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({ ...formData, buildCommands: [...formData.buildCommands, ''] });
                    }}
                    className="w-full"
                  >
                    Add Command
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Commands to run for building the repository. Common examples: "pnpm install", "npm run build"
                </p>
              </div>
            </CardContent>
          )}
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