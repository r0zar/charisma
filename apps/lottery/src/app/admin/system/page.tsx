"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Trash2, Loader2, Database } from "lucide-react"
import { useAdmin } from "../admin-context"

export default function SystemPage() {
  const { adminKey, setSuccess, setError } = useAdmin()
  const [confirmText, setConfirmText] = useState("")
  const [resetting, setResetting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [migrating, setMigrating] = useState(false)

  const handleResetLottery = async () => {
    if (confirmText !== "RESET LOTTERY") {
      setError('Please type "RESET LOTTERY" to confirm')
      return
    }

    if (!confirm('This will permanently delete ALL lottery data including tickets, draws, and configuration. This action cannot be undone. Are you absolutely sure?')) {
      return
    }

    setResetting(true)
    try {
      const response = await fetch('/api/admin/reset-lottery', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Reset failed')
      }

      setSuccess('Lottery system has been reset')
      setConfirmText("")
    } catch (err) {
      console.error('Reset failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to reset lottery')
    } finally {
      setResetting(false)
    }
  }

  const handleMigrateBlobToKV = async () => {
    if (!confirm('This will migrate all data (config, draws, tickets) from blob storage to KV. This is a one-time operation. Continue?')) {
      return
    }

    setMigrating(true)
    try {
      const response = await fetch('/api/admin/migrate-blob-to-kv', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Migration failed')
      }

      const result = await response.json()
      setSuccess(`Successfully migrated: ${result.migrated.config} config, ${result.migrated.draws} draws, ${result.migrated.tickets} tickets`)
    } catch (err) {
      console.error('Migration failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to migrate data')
    } finally {
      setMigrating(false)
    }
  }

  const handleSeedActiveIndex = async () => {
    setSeeding(true)
    try {
      const response = await fetch('/api/admin/seed-active-index', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Seeding failed')
      }

      const result = await response.json()
      setSuccess(`Successfully migrated ${result.seeded} active tickets to KV storage`)
    } catch (err) {
      console.error('Seed failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to seed active index')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            System maintenance and cleanup operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg bg-blue-500/10 border-blue-500/20">
            <div className="text-sm font-medium mb-2">⚡ Migrate ALL Data from Blob Storage to KV</div>
            <div className="text-sm text-muted-foreground mb-3">
              <strong>Run this first!</strong> This migrates ALL existing data (config, draws, and tickets) from blob storage to the new KV-only architecture. This is required after upgrading to KV-only storage.
            </div>
            <Button
              onClick={handleMigrateBlobToKV}
              disabled={migrating}
              variant="default"
              size="sm"
            >
              {migrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Migrating All Data...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Migrate Blob → KV
                </>
              )}
            </Button>
          </div>

          <div className="p-4 border border-border/40 rounded-lg">
            <div className="text-sm font-medium mb-2">Storage Information</div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>✓ All data now stored in KV (no TTL - permanent)</div>
              <div>✓ Blob storage deprecated (read-only archive)</div>
              <div>✓ Instant queries with no eventual consistency delays</div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            For manual cleanup operations, use the Debug & Repair tab to verify and correct data inconsistencies.
          </div>
        </CardContent>
      </Card>

      {/* Warning Banner */}
      <div className="p-4 bg-red-500/10 border-2 border-red-500/30 rounded-lg">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <h3 className="text-lg font-semibold text-red-500">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          These operations are irreversible and will permanently delete data. Use with extreme caution.
        </p>
      </div>

      {/* Reset Lottery */}
      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <Trash2 className="h-5 w-5" />
            Reset Entire Lottery System
          </CardTitle>
          <CardDescription>
            Permanently delete all lottery data including tickets, draws, and configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-reset">
              Type <span className="font-mono font-bold">RESET LOTTERY</span> to confirm
            </Label>
            <Input
              id="confirm-reset"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET LOTTERY"
              className="font-mono"
            />
          </div>

          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm">
            <div className="font-semibold mb-2 text-red-500">This will delete:</div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>All lottery tickets (active and archived)</li>
              <li>All draw results and history</li>
              <li>All lottery configuration settings</li>
              <li>All blockchain verification data</li>
            </ul>
          </div>

          <Button
            onClick={handleResetLottery}
            disabled={confirmText !== "RESET LOTTERY" || resetting}
            variant="destructive"
            className="w-full"
            size="lg"
          >
            {resetting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Resetting System...
              </>
            ) : (
              <>
                <Trash2 className="h-5 w-5 mr-2" />
                Reset Lottery System
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
