'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Coins, ExternalLink, Copy, Info, Zap, 
  TrendingUp, Users, Clock, CheckCircle 
} from 'lucide-react';

interface TokenRequirement {
  contractId: string;
  name: string;
  symbol: string;
  purpose: string;
  isRequired: boolean;
  minimumAmount?: string;
  description: string;
}

export function EnergyTokenRequirements() {
  const [copied, setCopied] = useState<string | null>(null);

  // Based on vault configuration: Base Token is the required token to hold
  const tokenRequirements: TokenRequirement[] = [
    {
      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
      name: 'Dexterity Pool V1',
      symbol: 'DEX-POOL-V1',
      purpose: 'Energy Generation Token',
      isRequired: true,
      minimumAmount: '> 0',
      description: 'This LP token must be held in your wallet to generate energy rewards. The energize vault manages this token for energy operations.'
    },
    {
      contractId: 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn',
      name: 'Dexterity Hold-to-Earn Engine',
      symbol: 'HOLD-TO-EARN',
      purpose: 'Reward Distribution Engine',
      isRequired: false,
      description: 'The underlying engine contract that calculates and distributes energy rewards based on token holdings.'
    }
  ];

  const requiredToken = tokenRequirements.find(token => token.isRequired)!;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Primary Token Requirement Alert */}
      <Alert className="border-l-4 border-l-blue-500 bg-blue-50">
        <Coins className="h-4 w-4" />
        <AlertTitle className="text-blue-800">Required Token for Energy Generation</AlertTitle>
        <AlertDescription className="text-blue-700">
          To generate energy, users must hold <strong>{requiredToken.name}</strong> ({requiredToken.symbol}) tokens in their wallet.
          The energize vault manages this token to provide energy rewards through the hold-to-earn mechanism.
        </AlertDescription>
      </Alert>

      {/* Token Requirements Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Energy System Token Requirements
          </CardTitle>
          <CardDescription>
            Understanding which tokens are needed to participate in the energy system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tokenRequirements.map((token, index) => (
            <div key={index} className={`border rounded-lg p-4 ${token.isRequired ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${token.isRequired ? 'bg-blue-500' : 'bg-gray-400'}`} />
                  <div>
                    <h3 className="font-medium text-lg">{token.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={token.isRequired ? "default" : "secondary"}>
                        {token.symbol}
                      </Badge>
                      <Badge variant={token.isRequired ? "default" : "outline"}>
                        {token.purpose}
                      </Badge>
                      {token.isRequired && (
                        <Badge variant="destructive" className="text-xs">
                          REQUIRED
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => copyToClipboard(token.contractId, token.contractId)}
                    variant="ghost" 
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    {copied === token.contractId ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                    <a 
                      href={`https://explorer.stacks.co/address/${token.contractId}?chain=mainnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <code className="text-xs bg-background border rounded px-2 py-1 block break-all">
                  {token.contractId}
                </code>
                <p className="text-sm text-muted-foreground">
                  {token.description}
                </p>
                
                {token.minimumAmount && (
                  <div className="text-xs text-blue-600 font-medium">
                    <strong>Minimum to hold:</strong> {token.minimumAmount} tokens
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* How Energy Generation Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            How Energy Generation Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <Coins className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-medium mb-1">1. Hold Tokens</h3>
              <p className="text-sm text-muted-foreground">
                Users must hold {requiredToken.symbol} tokens in their wallet
              </p>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <Clock className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-medium mb-1">2. Earn Over Time</h3>
              <p className="text-sm text-muted-foreground">
                Energy accumulates automatically based on token holdings
              </p>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <Zap className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="font-medium mb-1">3. Harvest Energy</h3>
              <p className="text-sm text-muted-foreground">
                Use the energize vault to harvest accumulated energy rewards
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Important Notes</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Energy generation is proportional to the amount of {requiredToken.symbol} tokens held</li>
            <li>Tokens must remain in your wallet - transferring them stops energy generation</li>
            <li>Energy can be harvested at any time using the vault's harvest-energy function</li>
            <li>The vault contract manages the relationship between token holdings and energy rewards</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}