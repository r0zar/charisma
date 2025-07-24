"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Copy, Check, Network } from "lucide-react"

export default function NetworkSettingsPage() {
  const { walletState, network, setNetwork, connectWallet, disconnectWallet, isConnecting } = useWallet()
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const copyAddress = async () => {
    if (walletState.address) {
      await navigator.clipboard.writeText(walletState.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const clearAddresses = () => {
    localStorage.removeItem(`addresses-${network}`)
    disconnectWallet()
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Network Configuration
        </CardTitle>
        <CardDescription>
          Manage your blockchain network settings and wallet connections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Network Selection */}
        <div>
          <h3 className="text-lg font-medium mb-3">Active Network</h3>
          <RadioGroup value={network} onValueChange={setNetwork}>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border">
                <RadioGroupItem value="mainnet" id="mainnet" />
                <Label htmlFor="mainnet" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Mainnet</p>
                      <p className="text-sm text-muted-foreground">
                        Production Stacks blockchain
                      </p>
                    </div>
                    <Badge variant="default">Live</Badge>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border">
                <RadioGroupItem value="testnet" id="testnet" />
                <Label htmlFor="testnet" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Testnet</p>
                      <p className="text-sm text-muted-foreground">
                        Development and testing network
                      </p>
                    </div>
                    <Badge variant="secondary">Test</Badge>
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* Wallet Section */}
        <div>
          <h3 className="text-lg font-medium mb-3">Wallet Connection</h3>
          
          {!walletState.connected ? (
            <div className="text-center p-6 border rounded-lg">
              <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="text-lg font-medium mb-2">No Wallet Connected</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your wallet to manage addresses and sign transactions
              </p>
              <Button onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected Wallet Info */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Connected Address</h4>
                  <Badge variant={network === "mainnet" ? "default" : "secondary"}>
                    {network}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-sm bg-background p-2 rounded flex-1 break-all border">
                    {walletState.address}
                  </code>
                  <Button  variant="ghost" onClick={copyAddress}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={disconnectWallet} variant="outline" >
                    Disconnect
                  </Button>
                  <Button onClick={clearAddresses} variant="destructive" >
                    Clear All Data
                  </Button>
                </div>
              </div>
              
              {/* Address Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg border-border">
                  <p className="text-sm font-medium text-muted-foreground">Public Key</p>
                  <p className="text-sm font-mono break-all">
                    {walletState.publicKey || "Not available"}
                  </p>
                </div>
                
                <div className="p-3 border rounded-lg border-border">
                  <p className="text-sm font-medium text-muted-foreground">Network Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <p className="text-sm">Connected</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}