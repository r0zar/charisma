"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

// Color palette for pie charts
const DISCOVERY_COLORS = {
  'trait-search': '#3b82f6', // blue
  'sip-scan': '#10b981', // emerald
  'api-scan': '#f59e0b', // amber
  'manual': '#8b5cf6' // violet
}

const TRAIT_COLORS = {
  'SIP010': '#10b981', // emerald
  'SIP069': '#8b5cf6', // violet
  'Vault': '#3b82f6', // blue
  'Custom': '#6b7280' // gray
}

export function DiscoveryMethodsChart({ data }: { data: Record<string, number> }) {
  // Prepare data for pie chart, filtering out zero values
  const chartData = Object.entries(data)
    .filter(([_, count]) => count > 0)
    .map(([method, count]) => ({
      name: method.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      color: DISCOVERY_COLORS[method as keyof typeof DISCOVERY_COLORS] || '#6b7280'
    }))

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>No discovery data available</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value, name) => [value.toLocaleString(), name]}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          contentStyle={{ 
            backgroundColor: 'hsl(var(--popover))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px'
          }}
        />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function TraitDistributionChart({ data }: { data: Record<string, number> }) {
  // Prepare data for pie chart, filtering out zero values
  const chartData = Object.entries(data)
    .filter(([_, count]) => count > 0)
    .map(([trait, count]) => ({
      name: trait,
      value: count,
      color: TRAIT_COLORS[trait as keyof typeof TRAIT_COLORS] || '#6b7280'
    }))

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>No trait data available</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value, name) => [value.toLocaleString(), name]}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          contentStyle={{ 
            backgroundColor: 'hsl(var(--popover))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px'
          }}
        />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}