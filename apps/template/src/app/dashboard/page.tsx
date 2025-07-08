"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  TrendingUp, 
  Wallet, 
  Network, 
  Copy, 
  Check, 
  RefreshCw,
  BarChart3,
  PieChart,
  Calendar,
  Clock,
  Globe,
  Settings,
  Zap
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell, Pie } from "recharts"
import Link from "next/link"

// Custom tooltip component that uses theme styles
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-muted-foreground">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.dataKey}:
            </span>{' '}
            {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Custom pie chart tooltip
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground">
          {payload[0].name}: {payload[0].value}%
        </p>
      </div>
    )
  }
  return null
}

// Mock data generators
const generateBalanceData = () => {
  const data = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: date.toLocaleDateString(),
      balance: Math.floor(Math.random() * 1000) + 500,
      transactions: Math.floor(Math.random() * 10) + 1
    })
  }
  return data
}

const generateTransactionData = () => {
  const types = ['Send', 'Receive', 'Contract Call', 'Token Transfer']
  const statuses = ['Confirmed', 'Pending', 'Failed']
  return Array.from({ length: 20 }, (_, i) => ({
    id: `tx_${i + 1}`,
    type: types[Math.floor(Math.random() * types.length)],
    amount: (Math.random() * 100).toFixed(2),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    hash: `0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`
  }))
}

const generateNetworkData = () => [
  { name: 'Mainnet', value: 85, color: '#3b82f6' },
  { name: 'Testnet', value: 15, color: '#10b981' }
]

export default function DashboardPage() {
  const { walletState, network, connectWallet, disconnectWallet, isConnecting } = useWallet()
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Mock data
  const [balanceData] = useState(generateBalanceData())
  const [transactionData] = useState(generateTransactionData())
  const [networkData] = useState(generateNetworkData())

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

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1000)
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your wallet activity and network status
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Wallet Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Wallet Status</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-3">
              {walletState.connected ? "Connected" : "Disconnected"}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={network === "mainnet" ? "default" : "secondary"}>
                {network}
              </Badge>
              <Badge variant={walletState.connected ? "default" : "destructive"}>
                {walletState.connected ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Mock Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">$2,847.50</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+12.5%</span> from last month
            </p>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">147</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+8</span> this week
            </p>
          </CardContent>
        </Card>

        {/* Network Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Network Health</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600 mb-2">Excellent</div>
            <p className="text-xs text-muted-foreground">
              Block height: 142,847
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Balance Chart */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Portfolio Overview</span>
              </CardTitle>
              <CardDescription>
                Your portfolio performance over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs defaultValue="balance" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="balance">Balance</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>
                <TabsContent value="balance" className="space-y-4">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={balanceData}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          className="opacity-30"
                        />
                        <XAxis 
                          dataKey="date" 
                          fontSize={12}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          fontSize={12}
                          className="text-muted-foreground"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="balance" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                <TabsContent value="transactions" className="space-y-4">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={balanceData}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          className="opacity-30"
                        />
                        <XAxis 
                          dataKey="date" 
                          fontSize={12}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          fontSize={12}
                          className="text-muted-foreground"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="transactions" 
                          fill="#3b82f6"
                          opacity={0.8}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Recent Transactions</span>
              </CardTitle>
              <CardDescription>
                Your latest transaction activity
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {transactionData.slice(0, 8).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{tx.type}</Badge>
                        <Badge 
                          variant={
                            tx.status === 'Confirmed' ? 'default' : 
                            tx.status === 'Pending' ? 'secondary' : 'destructive'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tx.hash} • {tx.timestamp}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">{tx.amount} STX</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-8">
          {/* Wallet Details */}
          {walletState.connected && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <Wallet className="h-5 w-5" />
                  <span>Wallet Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div>
                  <p className="text-sm font-medium mb-3">Address</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted p-2 rounded flex-1 break-all">
                      {walletState.address}
                    </code>
                    <Button size="sm" variant="ghost" onClick={copyAddress}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-3">Network</p>
                  <Badge variant={network === "mainnet" ? "default" : "secondary"}>
                    {network}
                  </Badge>
                </div>
                <Button 
                  onClick={disconnectWallet}
                  variant="outline" 
                  className="w-full"
                >
                  Disconnect Wallet
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Connect Wallet */}
          {!walletState.connected && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Connect Wallet</CardTitle>
                <CardDescription>
                  Connect your wallet to access all features
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="w-full"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Network Distribution */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5" />
                <span>Network Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Pie
                      data={networkData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      strokeWidth={2}
                    >
                      {networkData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {networkData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Quick Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Link href="/settings">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Link href="/skins">
                <Button variant="outline" className="w-full justify-start">
                  <Globe className="mr-2 h-4 w-4" />
                  Change Theme
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="mr-2 h-4 w-4" />
                  App Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}