import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Network, Users, PieChart as PieChartIcon } from "lucide-react"
import { ServiceUsageChart } from "./components/ServiceUsageChart"
import { getServiceStats, type ServiceStats } from "@/lib/actions"


async function fetchServiceStatus(): Promise<{ isDemo: boolean; stats: ServiceStats }> {
  try {
    const stats = await getServiceStats()
    
    return {
      isDemo: stats.status !== 'healthy',
      stats: stats
    }
  } catch (error) {
    return { 
      isDemo: true, 
      stats: {
        totalAddresses: 0,
        totalTokens: 0,
        totalSnapshots: 0,
        status: 'unhealthy' as const,
        lastUpdate: new Date().toISOString()
      }
    }
  }
}

export default async function ServiceStatus() {
  const { isDemo, stats } = await fetchServiceStatus()
  
  return (
    <div className="space-y-6">
      {/* Service Status */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2">
            <Network className="h-5 w-5 text-primary" />
            <span>Service Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Balance Service</span>
            <Badge variant={isDemo ? "secondary" : "default"}>
              {isDemo ? "Demo Mode" : "Running"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Snapshot Storage</span>
            <Badge variant={isDemo ? "secondary" : "default"}>
              {isDemo ? "Not Configured" : "Active"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">KV Store</span>
            <Badge variant={isDemo ? "outline" : "default"}>
              {isDemo ? "Unavailable" : "Connected"}
            </Badge>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">System Health</p>
            <p className="text-xs text-muted-foreground">
              {isDemo 
                ? "Configure services to see real status"
                : "All systems operational"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Collection Summary */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Collection Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Active Addresses</span>
            <span className="text-sm">{stats?.totalAddresses || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tracked Contracts</span>
            <span className="text-sm">{stats?.totalTokens || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Collections</span>
            <span className="text-sm">{(stats?.totalSnapshots || 0).toLocaleString()}</span>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Performance</p>
            <p className="text-xs text-muted-foreground">
              {isDemo 
                ? "No performance data available in demo mode"
                : "System running optimally"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Service Distribution */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            <span>Service Usage</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ServiceUsageChart />
        </CardContent>
      </Card>
    </div>
  )
}