"use client"

import { Check, Copy, Network, Bitcoin, CircuitBoard } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWallet } from "@/contexts"

export default function NetworkSettingsPage() {
  const { walletState, network, setNetwork, connectWallet, disconnectWallet, isConnecting } = useWallet()
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("bitcoin")

  // Helper function to get Bitcoin addresses from original Stacks Connect data
  const getBitcoinAddresses = (networkType: "mainnet" | "testnet") => {
    try {
      const storageKey = networkType === "mainnet" ? "addresses-mainnet" : "addresses-testnet"
      const originalData = JSON.parse(localStorage.getItem(storageKey) || '[]')
      return originalData.filter((addr: any) => addr.symbol === "BTC") || []
    } catch (error) {
      console.error(`Error reading Bitcoin addresses for ${networkType}:`, error)
      return []
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  const copyAddress = async (address: string, key: string) => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
    }
  }

  const clearNetworkData = (networkType: string) => {
    if (networkType === 'stacks') {
      localStorage.removeItem('addresses-mainnet')
      localStorage.removeItem('addresses-testnet')
    } else if (networkType === 'bitcoin') {
      localStorage.removeItem('addresses-bitcoin-mainnet')
      localStorage.removeItem('addresses-bitcoin-testnet')
    }
    // Force reload of wallet state
    window.location.reload()
  }

  const getNetworkStatus = (networkKey: string) => {
    return walletState.addresses[networkKey as keyof typeof walletState.addresses]
  }

  const isStacksConnected = getNetworkStatus('stacks-mainnet') || getNetworkStatus('stacks-testnet') || getNetworkStatus('mainnet') || getNetworkStatus('testnet')
  const isBitcoinConnected = getNetworkStatus('bitcoin-mainnet') || getNetworkStatus('bitcoin-testnet')

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Networks Configuration
        </CardTitle>
        <CardDescription>
          Manage your wallet connections across different networks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bitcoin" className="flex items-center gap-2">
              <Bitcoin className="h-4 w-4" />
              Bitcoin
            </TabsTrigger>
            <TabsTrigger value="stacks" className="flex items-center gap-2">
              <CircuitBoard className="h-4 w-4" />
              Stacks
            </TabsTrigger>
          </TabsList>

          {/* Bitcoin Networks Tab */}
          <TabsContent value="bitcoin" className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-3">Bitcoin Networks</h3>

              {!isBitcoinConnected && !isStacksConnected ? (
                <div className="text-center p-6 border rounded-lg">
                  <Bitcoin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h4 className="text-lg font-medium mb-2">No Bitcoin Addresses Available</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect a Stacks wallet first to access Bitcoin addresses, or use a dedicated Bitcoin wallet
                  </p>
                  <Button
                    onClick={() => {
                      setActiveTab('stacks')
                      setNetwork('stacks-mainnet')
                      connectWallet()
                    }}
                    disabled={isConnecting}
                  >
                    Connect Stacks Wallet
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Bitcoin Mainnet */}
                  {(() => {
                    const bitcoinAddresses = getBitcoinAddresses("mainnet");
                    const isMainnetActive = network === "bitcoin-mainnet" || network === "stacks-mainnet";
                    
                    return (
                      <div className={`p-4 bg-muted rounded-lg border-2 ${isMainnetActive ? 'border-primary' : 'border-transparent'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Bitcoin className="h-4 w-4" />
                            Bitcoin Mainnet
                          </h4>
                          <Badge variant="default">Live</Badge>
                        </div>

                        <div className="space-y-3">
                          {bitcoinAddresses.map((addr: any) => (
                            <div key={addr.address}>
                              <p className="text-xs text-muted-foreground mb-1">
                                {addr.type === "p2tr" ? "Taproot (P2TR)" : 
                                 addr.type === "p2wpkh" ? "Segwit (P2WPKH)" : 
                                 addr.type === "p2pkh" ? "Legacy (P2PKH)" : 
                                 addr.type === "p2sh" ? "Legacy (P2SH)" : 
                                 `${addr.type?.toUpperCase() || 'Unknown'}`}
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-background p-2 rounded flex-1 break-all border">
                                  {addr.address}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyAddress(addr.address, `bitcoin-mainnet-${addr.type}`)}
                                >
                                  {copied[`bitcoin-mainnet-${addr.type}`] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {/* Show btcAddress from Stacks if no direct Bitcoin addresses */}
                          {bitcoinAddresses.length === 0 && (getNetworkStatus('stacks-mainnet') || getNetworkStatus('mainnet'))?.btcAddress && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Via Stacks Wallet:</p>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-background p-2 rounded flex-1 break-all border">
                                  {(getNetworkStatus('stacks-mainnet') || getNetworkStatus('mainnet'))?.btcAddress}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyAddress(
                                    (getNetworkStatus('stacks-mainnet') || getNetworkStatus('mainnet'))?.btcAddress || '',
                                    'bitcoin-mainnet-stacks'
                                  )}
                                >
                                  {copied['bitcoin-mainnet-stacks'] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          )}

                          {bitcoinAddresses.length === 0 && !(getNetworkStatus('stacks-mainnet') || getNetworkStatus('mainnet'))?.btcAddress && (
                            <p className="text-sm text-muted-foreground">No addresses available</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bitcoin Testnet */}
                  {(() => {
                    const bitcoinAddresses = getBitcoinAddresses("testnet");
                    const isTestnetActive = network === "bitcoin-testnet" || network === "stacks-testnet";
                    
                    return (
                      <div className={`p-4 bg-muted rounded-lg border-2 ${isTestnetActive ? 'border-primary' : 'border-transparent'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Bitcoin className="h-4 w-4" />
                            Bitcoin Testnet
                          </h4>
                          <Badge variant="secondary">Test</Badge>
                        </div>

                        <div className="space-y-3">
                          {bitcoinAddresses.map((addr: any) => (
                            <div key={addr.address}>
                              <p className="text-xs text-muted-foreground mb-1">
                                {addr.type === "p2tr" ? "Taproot (P2TR)" : 
                                 addr.type === "p2wpkh" ? "Segwit (P2WPKH)" : 
                                 addr.type === "p2pkh" ? "Legacy (P2PKH)" : 
                                 addr.type === "p2sh" ? "Legacy (P2SH)" : 
                                 `${addr.type?.toUpperCase() || 'Unknown'}`}
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-background p-2 rounded flex-1 break-all border">
                                  {addr.address}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyAddress(addr.address, `bitcoin-testnet-${addr.type}`)}
                                >
                                  {copied[`bitcoin-testnet-${addr.type}`] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {/* Show btcAddress from Stacks if no direct Bitcoin addresses */}
                          {bitcoinAddresses.length === 0 && (getNetworkStatus('stacks-testnet') || getNetworkStatus('testnet'))?.btcAddress && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Via Stacks Wallet:</p>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-background p-2 rounded flex-1 break-all border">
                                  {(getNetworkStatus('stacks-testnet') || getNetworkStatus('testnet'))?.btcAddress}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyAddress(
                                    (getNetworkStatus('stacks-testnet') || getNetworkStatus('testnet'))?.btcAddress || '',
                                    'bitcoin-testnet-stacks'
                                  )}
                                >
                                  {copied['bitcoin-testnet-stacks'] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          )}

                          {bitcoinAddresses.length === 0 && !(getNetworkStatus('stacks-testnet') || getNetworkStatus('testnet'))?.btcAddress && (
                            <p className="text-sm text-muted-foreground">No addresses available</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bitcoin Network Controls */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Active Network</h4>
                      <RadioGroup
                        value={network.startsWith('bitcoin-') ? network : 'bitcoin-mainnet'}
                        onValueChange={setNetwork}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="bitcoin-mainnet" id="bitcoin-mainnet" />
                          <Label htmlFor="bitcoin-mainnet" className="cursor-pointer">Mainnet</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="bitcoin-testnet" id="bitcoin-testnet" />
                          <Label htmlFor="bitcoin-testnet" className="cursor-pointer">Testnet</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          // Force refresh to reload Bitcoin addresses from Stacks wallet
                          window.location.reload()
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Refresh Addresses
                      </Button>
                      <Button
                        onClick={disconnectWallet}
                        variant="destructive"
                        size="sm"
                      >
                        Disconnect Wallet
                      </Button>
                    </div>
                  </div>


                  {!getNetworkStatus('bitcoin-mainnet') && !getNetworkStatus('bitcoin-testnet') && (
                    <div className="p-4 border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Note:</strong> Bitcoin addresses are currently provided through your Stacks wallet connection.
                        Direct Bitcoin wallet integration is planned for future releases.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Stacks Networks Tab */}
          <TabsContent value="stacks" className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-3">Stacks Networks</h3>

              {!isStacksConnected ? (
                <div className="text-center p-6 border rounded-lg">
                  <CircuitBoard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h4 className="text-lg font-medium mb-2">No Stacks Wallet Connected</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your Stacks wallet to access mainnet and testnet
                  </p>
                  <Button
                    onClick={() => {
                      setNetwork('stacks-mainnet')
                      connectWallet()
                    }}
                    disabled={isConnecting}
                  >
                    {isConnecting ? "Connecting..." : "Connect Stacks Wallet"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stacks Mainnet */}
                  {(() => {
                    const stacksMainnet = getNetworkStatus('stacks-mainnet') || getNetworkStatus('mainnet');
                    const isMainnetActive = network === "stacks-mainnet" || network === "bitcoin-mainnet";
                    
                    return (
                      <div className={`p-4 bg-muted rounded-lg border-2 ${isMainnetActive ? 'border-primary' : 'border-transparent'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <CircuitBoard className="h-4 w-4" />
                            Stacks Mainnet
                          </h4>
                          <Badge variant="default">Live</Badge>
                        </div>

                        <div className="space-y-3">
                          {stacksMainnet ? (
                            <>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-background p-2 rounded flex-1 break-all border">
                                  {stacksMainnet.address}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyAddress(stacksMainnet.address || '', 'stacks-mainnet')}
                                >
                                  {copied['stacks-mainnet'] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>

                              {stacksMainnet.btcAddress && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Associated Bitcoin Address:</p>
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs bg-background p-2 rounded flex-1 break-all border">
                                      {stacksMainnet.btcAddress}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyAddress(stacksMainnet.btcAddress || '', 'stacks-mainnet-btc')}
                                    >
                                      {copied['stacks-mainnet-btc'] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">No addresses available</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Stacks Testnet */}
                  {(() => {
                    const stacksTestnet = getNetworkStatus('stacks-testnet') || getNetworkStatus('testnet');
                    const isTestnetActive = network === "stacks-testnet" || network === "bitcoin-testnet";
                    
                    return (
                      <div className={`p-4 bg-muted rounded-lg border-2 ${isTestnetActive ? 'border-primary' : 'border-transparent'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <CircuitBoard className="h-4 w-4" />
                            Stacks Testnet
                          </h4>
                          <Badge variant="secondary">Test</Badge>
                        </div>

                        <div className="space-y-3">
                          {stacksTestnet ? (
                            <>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-background p-2 rounded flex-1 break-all border">
                                  {stacksTestnet.address}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyAddress(stacksTestnet.address || '', 'stacks-testnet')}
                                >
                                  {copied['stacks-testnet'] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>

                              {stacksTestnet.btcAddress && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Associated Bitcoin Address:</p>
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs bg-background p-2 rounded flex-1 break-all border">
                                      {stacksTestnet.btcAddress}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyAddress(stacksTestnet.btcAddress || '', 'stacks-testnet-btc')}
                                    >
                                      {copied['stacks-testnet-btc'] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">No addresses available</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Network Controls */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Active Network</h4>
                      <RadioGroup
                        value={network.startsWith('stacks-') ? network : 'stacks-mainnet'}
                        onValueChange={setNetwork}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="stacks-mainnet" id="stacks-mainnet" />
                          <Label htmlFor="stacks-mainnet" className="cursor-pointer">Mainnet</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="stacks-testnet" id="stacks-testnet" />
                          <Label htmlFor="stacks-testnet" className="cursor-pointer">Testnet</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          // Force refresh to reload Stacks wallet data
                          window.location.reload()
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Refresh Addresses
                      </Button>
                      <Button
                        onClick={disconnectWallet}
                        variant="destructive"
                        size="sm"
                      >
                        Disconnect Wallet
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}