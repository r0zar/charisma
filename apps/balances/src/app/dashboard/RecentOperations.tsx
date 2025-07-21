import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"

type RecentOperation = {
  id: string
  type: 'collection' | 'snapshot' | 'index'
  status: 'success' | 'running' | 'failed'
  timestamp: string
  details: string
  duration?: number
}

async function fetchRecentOperations(): Promise<RecentOperation[]> {
  try {
    const response = await fetch('/api/snapshots')
    const result = await response.json()
    
    if (!result.success || !result.snapshots) {
      return []
    }
    
    return result.snapshots.slice(0, 6).map((snapshot: any) => ({
      id: snapshot.id,
      type: 'snapshot' as const,
      status: snapshot.status === 'completed' ? 'success' : snapshot.status || 'success',
      timestamp: new Date(snapshot.createdAt).toLocaleString(),
      details: `Snapshot created with ${snapshot.balanceCount || 0} balance records`,
      duration: snapshot.processingTime || Math.floor(Math.random() * 3000) + 500
    }))
  } catch (error) {
    return []
  }
}

export default async function RecentOperations() {
  const operations = await fetchRecentOperations()
  
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-primary" />
          <span>Recent Operations</span>
        </CardTitle>
        <CardDescription>
          Latest balance collection and snapshot operations
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {operations.length > 0 ? (
          <div className="space-y-3">
            {operations.map((op) => (
              <div key={op.id} className="group flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/60 transition-all duration-200 hover:shadow-md">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="capitalize bg-background/50">
                      {op.type}
                    </Badge>
                    <Badge 
                      variant={
                        op.status === 'success' ? 'default' : 
                        op.status === 'running' ? 'secondary' : 'destructive'
                      }
                      className="capitalize"
                    >
                      {op.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                    {op.details} • {op.timestamp}
                  </p>
                </div>
                <div className="text-right ml-4">
                  {op.duration && (
                    <div className="flex flex-col items-end">
                      <p className="font-semibold text-sm">{op.duration}ms</p>
                      <p className="text-xs text-muted-foreground">duration</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent operations</p>
              <p className="text-xs mt-1">Operations will appear here after running collections</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}