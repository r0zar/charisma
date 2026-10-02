'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/contexts/wallet-context';
import { signMessage } from 'blaze-sdk';
import { toast } from '@/components/ui/sonner';
import { 
  Key, 
  Plus, 
  Trash2, 
  Shield, 
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  permissions: ('execute' | 'cancel')[];
  status: 'active' | 'suspended' | 'revoked';
  rateLimit: number;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  usageStats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    executionCount: number;
    cancellationCount: number;
  };
}

interface CreateKeyFormData {
  name: string;
  permissions: ('execute' | 'cancel')[];
  expiresAt?: string;
}

export default function ApiKeysPage() {
  const { address } = useWallet();
  const isConnected = !!address;
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [formData, setFormData] = useState<CreateKeyFormData>({
    name: '',
    permissions: ['execute', 'cancel'],
    expiresAt: ''
  });

  // Load API keys on mount and wallet connection
  useEffect(() => {
    if (isConnected && address) {
      loadApiKeys();
    }
  }, [isConnected, address]);

  const loadApiKeys = async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      const message = {
        action: 'list_api_keys',
        timestamp: Date.now()
      };

      const messageString = JSON.stringify(message);
      const signature = await signMessage(messageString);

      const response = await fetch('/api/v1/api-keys', {
        method: 'GET',
        headers: {
          'X-Message': messageString,
          'X-Signature': signature.signature,
          'X-Wallet-Address': address
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load API keys');
      }

      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (error) {
      console.error('Failed to load API keys:', error);
      toast.error(`Failed to load API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!address || !formData.name.trim()) return;

    setCreating(true);
    try {
      const message = {
        action: 'create_api_key',
        keyName: formData.name.trim(),
        permissions: formData.permissions,
        timestamp: Date.now(),
        ...(formData.expiresAt && { expiresAt: formData.expiresAt })
      };

      const messageString = JSON.stringify(message);
      const signature = await signMessage(messageString);

      const response = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageString,
          signature: signature.signature,
          walletAddress: address
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create API key');
      }

      const data = await response.json();
      setNewApiKey(data.apiKey);
      setShowNewKey(true);
      setShowCreateDialog(false);
      
      // Reset form
      setFormData({
        name: '',
        permissions: ['execute', 'cancel'],
        expiresAt: ''
      });

      // Reload the list
      await loadApiKeys();
      
      toast.success('API key created successfully! Make sure to copy it now - it won\'t be shown again.');
    } catch (error) {
      console.error('Failed to create API key:', error);
      toast.error(`Failed to create API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteApiKey = async (keyId: string, keyName: string) => {
    if (!address) return;
    
    if (!confirm(`Are you sure you want to revoke the API key "${keyName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const message = {
        action: 'delete_api_key',
        keyId,
        timestamp: Date.now()
      };

      const messageString = JSON.stringify(message);
      const signature = await signMessage(messageString);

      const response = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageString,
          signature: signature.signature,
          walletAddress: address
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete API key');
      }

      toast.success(`API key "${keyName}" has been revoked`);
      await loadApiKeys();
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast.error(`Failed to delete API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('API key copied to clipboard');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-success/20 text-success border-success/30',
      suspended: 'bg-warning/20 text-warning border-warning/30',
      revoked: 'bg-danger/20 text-danger border-danger/30'
    };
    return variants[status as keyof typeof variants] || variants.active;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-bg">
        <Header />
        <div className="container max-w-4xl mx-auto p-6">
          <Card className="bg-surface border-line backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-ink-muted" />
              <h2 className="text-xl font-semibold text-ink mb-2">Wallet Connection Required</h2>
              <p className="text-ink-body">
                Please connect your wallet to manage your API keys.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      
      <div className="container max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ink mb-2">API Key Management</h1>
              <p className="text-ink-body">
                Create and manage API keys for automated trading and order execution.
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent text-on-accent">
                  <Plus className="w-4 h-4 mr-2" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-surface-raised border-line">
                <DialogHeader>
                  <DialogTitle className="text-ink">Create New API Key</DialogTitle>
                  <DialogDescription className="text-ink-body">
                    Create a new API key for automated order execution and cancellation.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-ink">Key Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My Trading Bot"
                      className="bg-surface border-line text-ink"
                    />
                  </div>

                  <div>
                    <Label className="text-ink">Permissions</Label>
                    <div className="flex gap-2 mt-2">
                      {['execute', 'cancel'].map((permission) => (
                        <label key={permission} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission as any)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  permissions: [...prev.permissions, permission as any]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  permissions: prev.permissions.filter(p => p !== permission)
                                }));
                              }
                            }}
                            className="rounded border-line-strong bg-surface"
                          />
                          <span className="text-ink capitalize">{permission}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="expires" className="text-ink">Expiration Date (Optional)</Label>
                    <Input
                      id="expires"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="bg-surface border-line text-ink"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateDialog(false)}
                      className="border-line text-ink"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createApiKey}
                      disabled={creating || !formData.name.trim() || formData.permissions.length === 0}
                      className="bg-accent hover:bg-accent"
                    >
                      {creating ? 'Creating...' : 'Create Key'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* New API Key Display */}
        {newApiKey && (
          <Card className="mb-6 bg-success/10 border-success/30">
            <CardHeader>
              <CardTitle className="text-success flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                API Key Created Successfully
              </CardTitle>
              <CardDescription className="text-success/80">
                Copy your API key now - it will not be shown again for security reasons.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 bg-surface-sunken rounded-lg border border-success/20">
                <code className="flex-1 text-success text-sm font-mono break-all">
                  {showNewKey ? newApiKey : '•'.repeat(48)}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewKey(!showNewKey)}
                  className="border-success/30 text-success hover:bg-success/10"
                >
                  {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(newApiKey)}
                  className="bg-success hover:bg-success"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button
                onClick={() => setNewApiKey(null)}
                className="mt-3 w-full bg-success hover:bg-success"
              >
                I've copied the key safely
              </Button>
            </CardContent>
          </Card>
        )}

        {/* API Keys List */}
        <Card className="bg-surface border-line backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-ink flex items-center">
              <Key className="w-5 h-5 mr-2" />
              Your API Keys
            </CardTitle>
            <CardDescription className="text-ink-body">
              Manage your API keys for automated trading.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-ink-body">Loading API keys...</p>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8">
                <Key className="w-16 h-16 mx-auto mb-4 text-ink-muted" />
                <p className="text-ink-body">No API keys found.</p>
                <p className="text-ink-muted text-sm">Create your first API key to get started with automation.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.id} className="p-4 bg-surface-sunken rounded-lg border border-line-soft">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-ink">{key.name}</h3>
                          <Badge className={getStatusBadge(key.status)}>
 {key.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-ink-muted">Permissions</p>
                            <p className="text-ink">
                              {key.permissions.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                            </p>
                          </div>
                          <div>
                            <p className="text-ink-muted">Rate Limit</p>
                            <p className="text-ink">{key.rateLimit} req/min</p>
                          </div>
                          <div>
                            <p className="text-ink-muted">Created</p>
                            <p className="text-ink">{formatDate(key.createdAt)}</p>
                          </div>
                        </div>

                        {key.lastUsedAt && (
                          <div className="mt-2 text-sm">
                            <p className="text-ink-muted">Last used: {formatDate(key.lastUsedAt)}</p>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div className="bg-surface p-2 rounded">
                            <p className="text-ink-muted">Total Requests</p>
                            <p className="text-ink font-mono">{key.usageStats.totalRequests}</p>
                          </div>
                          <div className="bg-surface p-2 rounded">
                            <p className="text-ink-muted">Executions</p>
                            <p className="text-ink font-mono">{key.usageStats.executionCount}</p>
                          </div>
                          <div className="bg-surface p-2 rounded">
                            <p className="text-ink-muted">Cancellations</p>
                            <p className="text-ink font-mono">{key.usageStats.cancellationCount}</p>
                          </div>
                          <div className="bg-surface p-2 rounded">
                            <p className="text-ink-muted">Success Rate</p>
                            <p className="text-ink font-mono">
                              {key.usageStats.totalRequests > 0 
                                ? Math.round((key.usageStats.successfulRequests / key.usageStats.totalRequests) * 100)
                                : 0}%
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteApiKey(key.id, key.name)}
                          disabled={key.status !== 'active'}
                          className="border-danger/30 text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="mt-6 bg-warning/10 border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <h4 className="text-warning font-semibold">Security Best Practices</h4>
                <ul className="text-warning/80 text-sm mt-1 space-y-1">
                  <li>• Store API keys securely and never commit them to version control</li>
                  <li>• Use environment variables for production deployments</li>
                  <li>• Rotate keys regularly (monthly recommended)</li>
                  <li>• Create keys with minimal required permissions</li>
                  <li>• Monitor usage statistics for suspicious activity</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}