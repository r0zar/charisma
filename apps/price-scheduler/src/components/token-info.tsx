"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface TokenMetadata {
  contractId: string
  symbol: string
  name: string
  decimals?: number
  totalSupply?: string
  logoUri?: string
  type: string
}

interface TokenInfoProps {
  contractId: string
  className?: string
  showDetails?: boolean
}

export function TokenInfo({ contractId, className = '', showDetails = false }: TokenInfoProps) {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/v1/tokens/metadata?contractId=${encodeURIComponent(contractId)}`)
        const result = await response.json()
        
        if (result.success) {
          setMetadata(result.data)
        } else {
          setError(result.error || 'Failed to fetch token metadata')
          setMetadata(null)
        }
      } catch (err) {
        console.error('Error fetching token metadata:', err)
        setError('Failed to load token metadata')
        setMetadata(null)
      } finally {
        setLoading(false)
      }
    }

    if (contractId) {
      fetchMetadata()
    }
  }, [contractId])

  if (loading) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    )
  }

  if (error || !metadata) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">?</span>
        </div>
        <div>
          <div className="font-medium text-sm">Unknown Token</div>
          <div className="text-xs text-muted-foreground truncate max-w-32">
            {contractId.split('.')[1] || contractId}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {metadata.logoUri ? (
        <img 
          src={metadata.logoUri} 
          alt={metadata.symbol}
          className="w-8 h-8 rounded-full"
          onError={(e) => {
            // Fallback to placeholder if image fails to load
            e.currentTarget.style.display = 'none'
            const fallback = e.currentTarget.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'flex'
          }}
        />
      ) : null}
      <div 
        className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
        style={{ display: metadata.logoUri ? 'none' : 'flex' }}
      >
        <span className="text-xs font-semibold text-primary">
          {metadata.symbol.slice(0, 2).toUpperCase()}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{metadata.symbol}</span>
          {metadata.type !== 'STANDARD' && (
            <Badge variant="outline" className="text-xs">
              {metadata.type}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {metadata.name || 'Unnamed Token'}
        </div>
        
        {showDetails && (
          <div className="text-xs text-muted-foreground mt-1">
            {metadata.decimals && (
              <span>Decimals: {metadata.decimals}</span>
            )}
            {metadata.totalSupply && (
              <span className="ml-2">
                Supply: {parseInt(metadata.totalSupply).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface TokenInfoCardProps {
  contractId: string
  price?: number
  priceChange?: number
  confidence?: number
  className?: string
}

export function TokenInfoCard({ 
  contractId, 
  price, 
  priceChange, 
  confidence, 
  className = '' 
}: TokenInfoCardProps) {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true)
        
        const response = await fetch(`/api/v1/tokens/metadata?contractId=${encodeURIComponent(contractId)}`)
        const result = await response.json()
        
        if (result.success) {
          setMetadata(result.data)
        }
      } catch (err) {
        console.error('Error fetching token metadata:', err)
      } finally {
        setLoading(false)
      }
    }

    if (contractId) {
      fetchMetadata()
    }
  }, [contractId])

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {metadata?.logoUri ? (
              <img 
                src={metadata.logoUri} 
                alt={metadata.symbol}
                className="w-12 h-12 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
            ) : null}
            <div 
              className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
              style={{ display: metadata?.logoUri ? 'none' : 'flex' }}
            >
              <span className="text-sm font-semibold text-primary">
                {metadata?.symbol?.slice(0, 2).toUpperCase() || '??'}
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{metadata?.symbol || 'Unknown'}</h3>
                {metadata?.type !== 'STANDARD' && (
                  <Badge variant="outline" className="text-xs">
                    {metadata?.type}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {metadata?.name || 'Unnamed Token'}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            {price !== undefined && (
              <div className="text-lg font-bold">
                ${price.toFixed(price >= 1 ? 2 : 6)}
              </div>
            )}
            {priceChange !== undefined && (
              <div className={`text-sm ${
                priceChange > 0 ? 'text-green-500' :
                priceChange < 0 ? 'text-red-500' : 'text-muted-foreground'
              }`}>
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            )}
            {confidence !== undefined && (
              <div className="text-xs text-muted-foreground">
                Confidence: {Math.round(confidence * 100)}%
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}