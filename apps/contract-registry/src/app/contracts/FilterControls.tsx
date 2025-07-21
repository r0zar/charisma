"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter, X, Database, Code, Shield, Loader2 } from "lucide-react"

const CONTRACT_TYPES = [
  { value: 'all', label: 'All Types', icon: Database },
  { value: 'token', label: 'Token Contracts', icon: Code },
  { value: 'nft', label: 'NFT Contracts', icon: Shield },
  { value: 'vault', label: 'Vault Contracts', icon: Database },
  { value: 'unknown', label: 'Unknown Type', icon: Database }
]

const TRAITS = [
  { value: 'all', label: 'All Traits' },
  { value: 'SIP009', label: 'SIP-009 (Non-Fungible Token)' },
  { value: 'SIP010', label: 'SIP-010 (Fungible Token)' },
  { value: 'SIP069', label: 'SIP-069 (Fungible Credit)' },
  { value: 'SIP013', label: 'SIP-013 (Semi-Fungible Token)' }
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'valid', label: 'Valid' },
  { value: 'pending', label: 'Pending Validation' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'blocked', label: 'Blocked' }
]

interface FilterControlsProps {
  filters?: {
    type: string
    trait: string
    status: string
  }
}

export function FilterControls({ filters }: FilterControlsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const typeFilter = filters?.type || 'all'
  const traitFilter = filters?.trait || 'all'
  const statusFilter = filters?.status || 'all'

  const updateFilter = (key: string, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams)
      
      if (value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      
      // Reset to page 1 when changing filters
      params.delete('page')
      
      router.push(`/contracts?${params.toString()}`)
    })
  }

  const clearFilters = () => {
    startTransition(() => {
      router.push('/contracts')
    })
  }

  const hasFilters = typeFilter !== 'all' || traitFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="mb-8 space-y-6">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Select value={typeFilter} onValueChange={(value) => updateFilter('type', value)}>
            <SelectTrigger className="w-44 h-11 rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
              <SelectValue placeholder="Contract Type" />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPES.map((type) => {
                const Icon = type.icon
                return (
                  <SelectItem key={type.value} value={type.value} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <Select value={traitFilter} onValueChange={(value) => updateFilter('trait', value)}>
            <SelectTrigger className="w-52 h-11 rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
              <SelectValue placeholder="Implemented Traits" />
            </SelectTrigger>
            <SelectContent>
              {TRAITS.map((trait) => (
                <SelectItem key={trait.value} value={trait.value} className="cursor-pointer">
                  {trait.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => updateFilter('status', value)}>
            <SelectTrigger className="w-44 h-11 rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value} className="cursor-pointer">
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters */}
      {hasFilters && (
        <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {typeFilter !== 'all' && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  Type: {typeFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateFilter('type', 'all')}
                    className="h-4 w-4 p-0 ml-2 hover:bg-destructive/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              
              {traitFilter !== 'all' && (
                <Badge variant="secondary" className="bg-secondary/10 text-secondary-foreground border-secondary/20">
                  Trait: {traitFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateFilter('trait', 'all')}
                    className="h-4 w-4 p-0 ml-2 hover:bg-destructive/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="bg-accent/10 text-accent-foreground border-accent/20">
                  Status: {statusFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateFilter('status', 'all')}
                    className="h-4 w-4 p-0 ml-2 hover:bg-destructive/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              className="rounded-xl hover:bg-destructive/5 hover:border-destructive/50 hover:text-destructive"
            >
              Clear all
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}