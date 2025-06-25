'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { 
  ExternalLink, Copy, Eye, EyeOff, Zap, 
  CheckCircle, AlertTriangle, Clock 
} from 'lucide-react';
import { useEnergyHealth, getHealthStatusIcon, getHealthStatusColor } from '@/hooks/useEnergyHealth';

interface EnergizeVaultHeaderProps {
  showDetails?: boolean;
  className?: string;
}

export function EnergizeVaultHeader({ showDetails = false, className = '' }: EnergizeVaultHeaderProps) {
  const [showFullAddress, setShowFullAddress] = useState(false);
  const { data: healthData, loading } = useEnergyHealth();

  const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1';
  const contractAddress = contractId.split('.')[0];
  const contractName = contractId.split('.')[1];
  
  const displayAddress = showFullAddress ? contractId : `${contractAddress.slice(0, 8)}...${contractName}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractId);
  };

  const vaultHealth = healthData?.health[0]; // Single vault

  return (
    <Card className={`border-l-4 border-l-blue-500 ${className}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="font-medium text-lg">Energize Vault</h3>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {displayAddress}
                  </code>
                  <Button 
                    onClick={() => setShowFullAddress(!showFullAddress)}
                    variant="ghost" 
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    {showFullAddress ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button 
                    onClick={copyToClipboard}
                    variant="ghost" 
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Health Status */}
            {loading ? (
              <Badge variant="secondary" className="animate-pulse">
                <Clock className="h-3 w-3 mr-1" />
                Checking...
              </Badge>
            ) : vaultHealth ? (
              <div className="flex items-center gap-2">
                <Badge 
                  variant={vaultHealth.overallStatus === 'healthy' ? 'default' : 
                          vaultHealth.overallStatus === 'warning' ? 'secondary' : 'destructive'}
                  className="flex items-center gap-1"
                >
                  <span>{getHealthStatusIcon(vaultHealth.overallStatus)}</span>
                  {vaultHealth.overallStatus}
                </Badge>
                {showDetails && (
                  <div className="text-xs text-muted-foreground">
                    Functions: {Object.values(vaultHealth.functions).filter(f => f.working).length}/3 working
                  </div>
                )}
              </div>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Health Unknown
              </Badge>
            )}

            <Button variant="outline" size="sm" asChild>
              <a 
                href={`https://explorer.stacks.co/address/${contractId}?chain=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Explorer
              </a>
            </Button>
          </div>
        </div>

        {showDetails && vaultHealth && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Required Token Highlight */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-sm font-medium text-blue-800">Required Token for Energy Generation</span>
              </div>
              <code className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1
              </code>
              <div className="text-xs text-blue-600 mt-1">
                Users must hold DEX-POOL-V1 tokens to generate energy rewards
              </div>
            </div>

            {/* Technical Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm font-medium">Contract Functions</div>
                <div className="text-xs text-muted-foreground mt-1">
                  quote() {vaultHealth.functions.quote.working ? '✅' : '❌'} • 
                  get-token-uri() {vaultHealth.functions.tokenUri.working ? '✅' : '❌'} • 
                  engine {vaultHealth.functions.engineTap.working ? '✅' : '❌'}
                </div>
              </div>

              <div className="text-center">
                <div className="text-sm font-medium">Configuration</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {vaultHealth.configValidation.warnings.length === 0 ? 
                    '✅ Config matches contract' : 
                    `⚠️ ${vaultHealth.configValidation.warnings.length} warnings`
                  }
                </div>
              </div>

              <div className="text-center">
                <div className="text-sm font-medium">Relationships</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Engine: {vaultHealth.relationships.engine ? '✅ Connected' : '❌ Not found'}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}