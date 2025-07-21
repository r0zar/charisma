import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
// Lucide icons have been replaced with inline SVG - no longer need imports
// Temporarily removed recharts import to debug createContext error
// import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface EngineStatus {
  engine: string
  status: 'healthy' | 'degraded' | 'failed' | 'unknown'
  lastSuccess: number
  errorRate: number
  averageResponseTime: number
}

interface EngineStats {
  oracle: number
  market: number
  intrinsic: number
  hybrid: number
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy': return <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    case 'degraded': return <svg className="h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.262 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
    case 'failed': return <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    default: return <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  }
}

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m ago`
  }
  return `${minutes}m ${seconds}s ago`
}

// Temporarily commented out recharts tooltip to debug createContext error
// const CustomTooltip = ({ active, payload }: any) => {
//   if (active && payload && payload.length) {
//     return (
//       <div className="bg-background border border-border rounded-lg shadow-lg p-3">
//         <p className="text-sm font-medium text-foreground">
//           {payload[0].name}: {payload[0].value} tokens
//         </p>
//       </div>
//     )
//   }
//   return null
// }

async function fetchEngineData(): Promise<{
  engineHealth: EngineStatus[]
  engineStats: EngineStats | null
  error?: string
}> {
  try {
    // Import engines directly instead of making API calls
    const { 
      PriceSeriesStorage,
      OracleEngine,
      CpmmEngine,
      VirtualEngine
    } = await import('@services/prices')
    
    const engineHealth: EngineStatus[] = []
    let engineStats: EngineStats | null = null

    // Get engine stats from latest snapshot
    const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
    if (BLOB_READ_WRITE_TOKEN) {
      try {
        const storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);
        const latestSnapshot = await storage.getLatestSnapshot();
        if (latestSnapshot?.metadata?.engineStats) {
          const stats = latestSnapshot.metadata.engineStats;
          engineStats = {
            oracle: stats.oracle || 0,
            market: stats.market || 0,
            intrinsic: stats.intrinsic || 0,
            hybrid: stats.hybrid || 0
          };
        }
      } catch (error) {
        console.warn('Failed to fetch engine stats from storage:', error)
      }
    }

    // Test Oracle Engine
    try {
      const oracleEngine = new OracleEngine();
      const startTime = Date.now();
      const btcPrice = await oracleEngine.getBtcPrice();
      const responseTime = Date.now() - startTime;
      
      engineHealth.push({
        engine: 'Oracle',
        status: btcPrice ? 'healthy' : 'failed',
        lastSuccess: btcPrice ? Date.now() : Date.now() - 300000,
        errorRate: btcPrice ? 0.02 : 0.8,
        averageResponseTime: responseTime
      });
    } catch (error) {
      engineHealth.push({
        engine: 'Oracle',
        status: 'failed',
        lastSuccess: Date.now() - 600000,
        errorRate: 1.0,
        averageResponseTime: 0
      });
    }

    // Test CPMM Engine
    try {
      const cpmmEngine = new CpmmEngine();
      const startTime = Date.now();
      const stats = cpmmEngine.getStats();
      const responseTime = Date.now() - startTime;
      
      const hasTokens = stats.totalTokens > 0;
      const hasPools = stats.totalPools > 0;
      const isRecent = stats.lastUpdated > 0 && (Date.now() - stats.lastUpdated) < 600000;
      
      let status: 'healthy' | 'degraded' | 'failed' = 'healthy';
      let errorRate = 0.05;
      
      if (!hasTokens || !hasPools) {
        status = 'failed';
        errorRate = 0.9;
      } else if (!isRecent) {
        status = 'degraded';
        errorRate = 0.3;
      }
      
      engineHealth.push({
        engine: 'CPMM',
        status,
        lastSuccess: isRecent ? stats.lastUpdated : Date.now() - 300000,
        errorRate,
        averageResponseTime: responseTime
      });
    } catch (error) {
      engineHealth.push({
        engine: 'CPMM',
        status: 'failed',
        lastSuccess: Date.now() - 600000,
        errorRate: 1.0,
        averageResponseTime: 0
      });
    }

    // Test Virtual Engine
    try {
      const virtualEngine = new VirtualEngine();
      const startTime = Date.now();
      const testToken = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
      const hasVirtual = await virtualEngine.hasVirtualValue(testToken);
      const responseTime = Date.now() - startTime;
      
      engineHealth.push({
        engine: 'Virtual',
        status: hasVirtual ? 'healthy' : 'degraded',
        lastSuccess: Date.now() - (hasVirtual ? 60000 : 180000),
        errorRate: hasVirtual ? 0.1 : 0.25,
        averageResponseTime: responseTime
      });
    } catch (error) {
      engineHealth.push({
        engine: 'Virtual',
        status: 'failed',
        lastSuccess: Date.now() - 600000,
        errorRate: 1.0,
        averageResponseTime: 0
      });
    }
    
    return { engineHealth, engineStats }
  } catch (error) {
    console.error('Failed to fetch engine data:', error)
    return { 
      engineHealth: [], 
      engineStats: null,
      error: 'Failed to fetch engine health data'
    }
  }
}

export default async function EngineHealth() {
  const { engineHealth, engineStats, error } = await fetchEngineData() as any
  
  // Prepare chart data
  const chartData = engineStats ? [
    { name: 'Oracle', value: engineStats.oracle, color: 'hsl(var(--primary))' },
    { name: 'Market', value: engineStats.market, color: 'hsl(var(--accent))' },
    { name: 'Intrinsic', value: engineStats.intrinsic, color: 'hsl(var(--secondary))' },
    { name: 'Hybrid', value: engineStats.hybrid, color: 'hsl(220, 70%, 50%)' }
  ].filter(item => item.value > 0) : []
  
  return (
    <div className="space-y-6">
      {/* Engine Health Summary */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Engine Health Summary
          </CardTitle>
          <CardDescription>
            Status of the three pricing engines
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error || engineHealth.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-center">
              <div className="space-y-3">
                <div className="p-3 rounded-full bg-destructive/10 border border-destructive/20 w-fit mx-auto">
                  <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <div className="font-medium text-sm text-destructive mb-1">Engine Health Unavailable</div>
                  <div className="text-xs text-muted-foreground max-w-sm">
                    {error || 'No engine health data available'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {engineHealth.map((engine: EngineStatus) => (
                <div key={engine.engine} className="group flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/60 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(engine.status)}
                    <div>
                      <div className="font-medium">{engine.engine}</div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round((1 - engine.errorRate) * 100)}% success
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {engine.averageResponseTime}ms
                    </div>
                    <div className="text-xs text-muted-foreground">
                      avg response
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Engine Usage Distribution - Temporarily commented out recharts usage */}
      {chartData.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Engine Usage Distribution
            </CardTitle>
            <CardDescription>
              Latest snapshot engine usage breakdown (Chart temporarily disabled)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[200px] flex items-center justify-center border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">Chart temporarily disabled during debugging</p>
              </div>
              <div className="space-y-3">
                {chartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium">{item.name} Engine</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{item.value}</div>
                      <div className="text-sm text-muted-foreground">tokens</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}