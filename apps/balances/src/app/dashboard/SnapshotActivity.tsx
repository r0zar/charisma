"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Activity, RefreshCw } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

type CollectionData = {
  date: string
  collections: number
  snapshots: number
  size: number
}

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

// Transform snapshot data into collection activity format
const processSnapshotsIntoActivity = (snapshots: any[]): CollectionData[] => {
  // Group snapshots by date over the last 30 days
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
  
  // Create a map of dates to activity data
  const activityMap = new Map<string, CollectionData>()
  
  // Initialize all dates in the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(thirtyDaysAgo.getTime() + (i * 24 * 60 * 60 * 1000))
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    activityMap.set(dateStr, {
      date: dateStr,
      collections: 0,
      snapshots: 0,
      size: 0
    })
  }
  
  // Process each snapshot and add to the appropriate date
  snapshots.forEach(snapshot => {
    const snapshotDate = new Date(snapshot.createdAt)
    
    // Only include snapshots from the last 30 days
    if (snapshotDate >= thirtyDaysAgo && snapshotDate <= now) {
      const dateStr = snapshotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const existing = activityMap.get(dateStr)
      
      if (existing) {
        existing.snapshots += 1
        existing.collections += snapshot.addressCount || 0
        existing.size += Math.round((snapshot.size || 0) / (1024 * 1024)) // Convert to MB
      }
    }
  })
  
  return Array.from(activityMap.values())
}

export default function SnapshotActivity() {
  const [data, setData] = useState<CollectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivityData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch snapshot data to derive collection activity
      const response = await fetch('/api/snapshots')
      
      if (!response.ok) {
        throw new Error('Failed to fetch collection activity data')
      }
      
      const result = await response.json()
      
      if (result.success && result.snapshots) {
        // Transform snapshot data into collection activity data
        const activityData = processSnapshotsIntoActivity(result.snapshots)
        setData(activityData)
      } else {
        throw new Error(result.error || 'No activity data available')
      }
    } catch (err) {
      console.error('Error fetching collection activity:', err)
      setError(err instanceof Error ? err.message : 'Failed to load activity data')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivityData()
  }, [])

  const renderErrorState = () => (
    <div className="flex items-center justify-center h-[300px]">
      <div className="text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 border border-destructive/20 w-fit mx-auto">
          <Activity className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <div className="font-medium text-sm text-destructive mb-2">Activity Data Unavailable</div>
          <div className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            {error || 'No collection activity data available'}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchActivityData}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )

  const renderLoadingState = () => (
    <div className="flex items-center justify-center h-[300px]">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span>Loading activity data...</span>
      </div>
    </div>
  )
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle>Snapshot Activity</CardTitle>
        <CardDescription>
          Snapshot creation activity over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="snapshots" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/30 rounded-xl p-1">
            <TabsTrigger value="snapshots" className="rounded-lg">Snapshots</TabsTrigger>
            <TabsTrigger value="storage" className="rounded-lg">Storage</TabsTrigger>
          </TabsList>
          
          
          <TabsContent value="snapshots" className="space-y-4 mt-6">
            {loading ? renderLoadingState() : error || data.length === 0 ? renderErrorState() : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      className="opacity-30"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12}
                      className="text-muted-foreground"
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      fontSize={12}
                      className="text-muted-foreground"
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="snapshots" 
                      fill="hsl(var(--primary))"
                      opacity={0.8}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="storage" className="space-y-4 mt-6">
            {loading ? renderLoadingState() : error || data.length === 0 ? renderErrorState() : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      className="opacity-30"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12}
                      className="text-muted-foreground"
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      fontSize={12}
                      className="text-muted-foreground"
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="size" 
                      fill="hsl(var(--accent))"
                      opacity={0.8}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}