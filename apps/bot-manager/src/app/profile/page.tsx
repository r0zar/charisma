'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Copy, ExternalLink, Wallet, Network, Shield } from 'lucide-react';
import { useWallet } from '@/contexts/wallet-context';
import { useNotifications } from '@/contexts/notification-context';

export default function ProfilePage() {
  const { walletState, network, setNetwork } = useWallet();
  const { addNotification } = useNotifications();

  const copyAddress = () => {
    if (walletState.address) {
      navigator.clipboard.writeText(walletState.address);
      addNotification({
        type: 'success',
        message: 'Wallet address copied to clipboard',
        duration: 3000
      });
    }
  };

  const openExplorer = () => {
    if (walletState.address) {
      const explorerUrl = network === 'mainnet' 
        ? `https://explorer.stacks.co/address/${walletState.address}`
        : `https://explorer.stacks.co/address/${walletState.address}?chain=testnet`;
      window.open(explorerUrl, '_blank');
    }
  };

  if (!walletState.connected) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">No Wallet Connected</h1>
          <p className="text-muted-foreground">Please connect your wallet to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your wallet and account settings</p>
      </div>

      <div className="grid gap-6">
        {/* Wallet Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Wallet Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src="/placeholder-user.jpg" alt="User" />
                <AvatarFallback className="text-xl">
                  {walletState.address.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Wallet Address</span>
                  <Badge variant="outline" className="text-xs">
                    {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {walletState.address}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAddress}
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openExplorer}
                    className="h-8 w-8 p-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {walletState.publicKey && (
              <div>
                <span className="text-sm font-medium">Public Key</span>
                <code className="block text-sm bg-muted px-2 py-1 rounded mt-1 break-all">
                  {walletState.publicKey}
                </code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              Network Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Active Network</label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={network === 'mainnet' ? 'default' : 'outline'}
                    onClick={() => setNetwork('mainnet')}
                    className="flex-1"
                  >
                    Mainnet
                  </Button>
                  <Button
                    variant={network === 'testnet' ? 'default' : 'outline'}
                    onClick={() => setNetwork('testnet')}
                    className="flex-1"
                  >
                    Testnet
                  </Button>
                </div>
              </div>

              {/* Show addresses for both networks if available */}
              {walletState.addresses.mainnet && (
                <div>
                  <label className="text-sm font-medium">Mainnet Address</label>
                  <code className="block text-sm bg-muted px-2 py-1 rounded mt-1 break-all">
                    {walletState.addresses.mainnet.address}
                  </code>
                </div>
              )}

              {walletState.addresses.testnet && (
                <div>
                  <label className="text-sm font-medium">Testnet Address</label>
                  <code className="block text-sm bg-muted px-2 py-1 rounded mt-1 break-all">
                    {walletState.addresses.testnet.address}
                  </code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Wallet Connection</p>
                  <p className="text-sm text-muted-foreground">
                    Your wallet is securely connected and authenticated
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600">
                  Connected
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Cryptographic signatures are used for secure API access
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600">
                  Enabled
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}