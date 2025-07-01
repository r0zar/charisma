'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Upload,
  Check,
  X,
  AlertCircle,
  Users,
  Copy,
  FileText,
  Loader2
} from 'lucide-react';
import {
  parseAddressText,
  parseAddressTextPreview,
  detectDelimiterType,
  getExampleFormats,
  type AddressParseResult,
  type ParsedAddress
} from '@/lib/address-parser';

interface BatchWalletImportDialogProps {
  onImport: (addresses: string[]) => Promise<void>;
  existingAddresses?: string[];
  maxAddresses?: number;
}

export default function BatchWalletImportDialog({
  onImport,
  existingAddresses = [],
  maxAddresses = 50
}: BatchWalletImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  // Real-time parsing for preview
  const parseResult = useMemo((): AddressParseResult => {
    if (!inputText.trim()) {
      return {
        validAddresses: [],
        invalidAddresses: [],
        totalFound: 0,
        duplicatesRemoved: 0
      };
    }
    return parseAddressText(inputText);
  }, [inputText]);

  // Preview parsed addresses
  const previewAddresses = useMemo((): ParsedAddress[] => {
    if (!inputText.trim()) return [];
    return parseAddressTextPreview(inputText);
  }, [inputText]);

  // Detect delimiter type
  const delimiterType = useMemo(() => {
    return detectDelimiterType(inputText);
  }, [inputText]);

  // Filter out addresses that already exist
  const newAddresses = useMemo(() => {
    return parseResult.validAddresses.filter(addr => 
      !existingAddresses.includes(addr)
    );
  }, [parseResult.validAddresses, existingAddresses]);

  const existingInInput = useMemo(() => {
    return parseResult.validAddresses.filter(addr => 
      existingAddresses.includes(addr)
    );
  }, [parseResult.validAddresses, existingAddresses]);

  // Check if we're over the limit
  const wouldExceedLimit = (existingAddresses.length + newAddresses.length) > maxAddresses;
  const addressesOverLimit = Math.max(0, (existingAddresses.length + newAddresses.length) - maxAddresses);

  const examples = useMemo(() => getExampleFormats(), []);

  const handleImport = useCallback(async () => {
    if (newAddresses.length === 0) return;

    setIsImporting(true);
    try {
      // Only import addresses that fit within the limit
      const addressesToImport = wouldExceedLimit 
        ? newAddresses.slice(0, maxAddresses - existingAddresses.length)
        : newAddresses;
      
      await onImport(addressesToImport);
      setOpen(false);
      setInputText('');
    } catch (error) {
      console.error('Failed to import addresses:', error);
    } finally {
      setIsImporting(false);
    }
  }, [newAddresses, onImport, wouldExceedLimit, maxAddresses, existingAddresses.length]);

  const copyExample = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const resetInput = useCallback(() => {
    setInputText('');
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 text-white/70 hover:text-white/90"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Wallets
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-background border border-border backdrop-blur-xl max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Import Multiple Wallets
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Import multiple Stacks wallet addresses at once. Paste addresses separated by commas, spaces, or new lines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="addresses" className="text-foreground">
                Wallet Addresses
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExamples(!showExamples)}
                  className="text-xs"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {showExamples ? 'Hide' : 'Show'} Examples
                </Button>
                {inputText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetInput}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            
            <textarea
              id="addresses"
              placeholder="Paste wallet addresses here...&#10;ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM&#10;SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7&#10;ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-32 p-3 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none font-mono text-sm"
            />

            {inputText && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Delimiter detected: {delimiterType}</span>
                {parseResult.duplicatesRemoved > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {parseResult.duplicatesRemoved} duplicate{parseResult.duplicatesRemoved !== 1 ? 's' : ''} removed
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Examples Section */}
          {showExamples && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-foreground">Format Examples</CardTitle>
                <CardDescription className="text-xs">
                  Click any example to copy it to your clipboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(examples).map(([format, example]) => (
                  <div key={format} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{format}:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyExample(example)}
                        className="text-xs h-6 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <code className="block p-2 bg-background rounded text-xs font-mono break-all text-muted-foreground">
                      {example}
                    </code>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Preview Section */}
          {inputText && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Total Found</div>
                  <div className="text-lg font-semibold text-foreground">{parseResult.totalFound}</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="text-xs text-green-400">Valid</div>
                  <div className="text-lg font-semibold text-green-400">{parseResult.validAddresses.length}</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="text-xs text-red-400">Invalid</div>
                  <div className="text-lg font-semibold text-red-400">{parseResult.invalidAddresses.length}</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="text-xs text-blue-400">New</div>
                  <div className="text-lg font-semibold text-blue-400">{newAddresses.length}</div>
                </div>
              </div>

              {/* Warning Messages */}
              {existingInInput.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-yellow-400">
                        {existingInInput.length} address{existingInInput.length !== 1 ? 'es' : ''} already imported
                      </div>
                      <div className="text-xs text-yellow-400/70 mt-1">
                        These addresses will be skipped during import
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {wouldExceedLimit && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-red-400">
                        Exceeds maximum limit ({maxAddresses} addresses)
                      </div>
                      <div className="text-xs text-red-400/70 mt-1">
                        Only the first {maxAddresses - existingAddresses.length} new addresses will be imported
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Preview */}
              {previewAddresses.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-foreground">
                      Address Preview ({previewAddresses.length} total)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {previewAddresses.map((addr, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs font-mono">
                          {addr.isValid ? (
                            <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                          ) : (
                            <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                          )}
                          <span className={addr.isValid ? 'text-foreground' : 'text-red-400'}>
                            {addr.address}
                          </span>
                          {existingAddresses.includes(addr.address) && (
                            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">
                              Exists
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {newAddresses.length > 0 && (
                <span>Ready to import {newAddresses.length} new address{newAddresses.length !== 1 ? 'es' : ''}</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={newAddresses.length === 0 || isImporting}
                className="min-w-24"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {newAddresses.length > 0 ? `(${newAddresses.length})` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}