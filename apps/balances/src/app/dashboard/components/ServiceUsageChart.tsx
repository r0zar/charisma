"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type ServiceData = {
  name: string
  value: number
  color: string
}

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

export function ServiceUsageChart() {
  const [data, setData] = useState<ServiceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchServiceData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/service/usage')
      
      if (!response.ok) {
        throw new Error('Failed to fetch service usage data')
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        setData(result.data)
      } else {
        throw new Error(result.message || 'No service usage data available')
      }
    } catch (err) {
      console.error('Error fetching service usage:', err)
      setError(err instanceof Error ? err.message : 'Failed to load service data')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServiceData()
  }, [])
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading service data...</span>
        </div>
      </div>
    )
  }

  if (error || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <div className="text-center space-y-3">
          <div className="p-3 rounded-full bg-destructive/10 border border-destructive/20 w-fit mx-auto">
            <Activity className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <div className="font-medium text-sm text-destructive mb-1">Service Data Unavailable</div>
            <div className="text-xs text-muted-foreground max-w-xs mx-auto mb-3">
              {error || 'No service usage data available'}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchServiceData}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="h-[200px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomPieTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((item) => (
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
    </>
  )
}