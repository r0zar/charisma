"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Settings, Trophy, Loader2, Plus, Trash2 } from "lucide-react"
import { useAdmin } from "../admin-context"
import { LotteryConfig, Jackpot } from "@/types/lottery"

export default function ConfigurationPage() {
  const { adminKey, setSuccess, setError } = useAdmin()
  const [config, setConfig] = useState<LotteryConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [isActive, setIsActive] = useState(false)
  const [ticketPrice, setTicketPrice] = useState(1)
  const [nextDrawDate, setNextDrawDate] = useState("")
  const [jackpots, setJackpots] = useState<Jackpot[]>([])
  const [selectedJackpotId, setSelectedJackpotId] = useState<string>("")

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/lottery-config', {
        headers: { 'x-admin-key': adminKey }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch config')
      }

      const result = await response.json()
      const data = result.data

      setConfig(data)
      setIsActive(data.isActive)
      setTicketPrice(data.ticketPrice)
      setNextDrawDate(data.nextDrawDate ? new Date(data.nextDrawDate).toISOString().slice(0, 16) : "")

      // Handle migration from old PhysicalJackpot format to new Jackpot array format
      let jackpotsArray = data.jackpots || []
      let selectedId = ""

      if (jackpotsArray.length === 0 && data.currentJackpot) {
        // Migrate old format: convert currentJackpot to jackpots array
        const oldJackpot = data.currentJackpot
        const migratedJackpot: Jackpot = {
          id: `jackpot-${Date.now()}`,
          title: oldJackpot.title || "Current Jackpot",
          description: oldJackpot.estimatedValue
            ? `Estimated value: ${oldJackpot.estimatedValue.toLocaleString()} STONE`
            : "Physical prize",
          imageUrl: Array.isArray(oldJackpot.imageUrls) && oldJackpot.imageUrls.length > 0
            ? oldJackpot.imageUrls[0]
            : oldJackpot.linkUrl || ""
        }
        jackpotsArray = [migratedJackpot]
        selectedId = migratedJackpot.id
        console.log('Migrated old jackpot format to new format:', migratedJackpot)
      } else if (data.currentJackpot?.id) {
        selectedId = data.currentJackpot.id
      }

      setJackpots(jackpotsArray)
      setSelectedJackpotId(selectedId)
    } catch (err) {
      console.error('Failed to fetch config:', err)
      setError('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const currentJackpot = jackpots.find(j => j.id === selectedJackpotId) || null

      const updatedConfig: LotteryConfig = {
        isActive,
        ticketPrice,
        nextDrawDate: nextDrawDate ? new Date(nextDrawDate).toISOString() : null,
        jackpots,
        currentJackpot,
        lastUpdated: new Date().toISOString()
      }

      const response = await fetch('/api/admin/lottery-config', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedConfig)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save config')
      }

      setSuccess('Configuration saved successfully')
      await fetchConfig()
    } catch (err) {
      console.error('Save failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleAddJackpot = () => {
    const newJackpot: Jackpot = {
      id: `jackpot-${Date.now()}`,
      title: "",
      description: "",
      imageUrl: ""
    }
    setJackpots([...jackpots, newJackpot])
  }

  const handleUpdateJackpot = (index: number, field: keyof Jackpot, value: string) => {
    const updated = [...jackpots]
    updated[index] = { ...updated[index], [field]: value }
    setJackpots(updated)
  }

  const handleDeleteJackpot = (index: number) => {
    const jackpotId = jackpots[index].id
    if (selectedJackpotId === jackpotId) {
      setSelectedJackpotId("")
    }
    setJackpots(jackpots.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <div className="text-lg">Loading configuration...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Lottery Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Lottery Settings
          </CardTitle>
          <CardDescription>
            Configure basic lottery parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is-active">Lottery Status</Label>
              <div className="text-sm text-muted-foreground">
                Enable or disable ticket purchases
              </div>
            </div>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-price">Ticket Price (STONE)</Label>
            <Input
              id="ticket-price"
              type="number"
              min="0.1"
              step="0.1"
              value={ticketPrice}
              onChange={(e) => setTicketPrice(parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="next-draw">Next Draw Date & Time</Label>
            <Input
              id="next-draw"
              type="datetime-local"
              value={nextDrawDate}
              onChange={(e) => setNextDrawDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Jackpot Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Jackpot Management
              </CardTitle>
              <CardDescription>
                Create and manage lottery jackpot prizes
              </CardDescription>
            </div>
            <Button onClick={handleAddJackpot} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Jackpot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {jackpots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No jackpots configured. Click "Add Jackpot" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {jackpots.map((jackpot, index) => (
                <div key={jackpot.id} className="p-4 border border-border/40 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={`jackpot-select-${jackpot.id}`}
                        name="current-jackpot"
                        checked={selectedJackpotId === jackpot.id}
                        onChange={() => setSelectedJackpotId(jackpot.id)}
                        className="cursor-pointer"
                      />
                      <Label
                        htmlFor={`jackpot-select-${jackpot.id}`}
                        className="cursor-pointer font-semibold"
                      >
                        {jackpot.title || `Jackpot ${index + 1}`}
                      </Label>
                    </div>
                    <Button
                      onClick={() => handleDeleteJackpot(index)}
                      variant="ghost"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`jackpot-title-${index}`}>Title</Label>
                      <Input
                        id={`jackpot-title-${index}`}
                        value={jackpot.title}
                        onChange={(e) => handleUpdateJackpot(index, 'title', e.target.value)}
                        placeholder="e.g., Genesis Lottery #1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`jackpot-description-${index}`}>Description</Label>
                      <Textarea
                        id={`jackpot-description-${index}`}
                        value={jackpot.description}
                        onChange={(e) => handleUpdateJackpot(index, 'description', e.target.value)}
                        placeholder="Describe the jackpot prize..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`jackpot-image-${index}`}>Image URL</Label>
                      <Input
                        id={`jackpot-image-${index}`}
                        value={jackpot.imageUrl}
                        onChange={(e) => handleUpdateJackpot(index, 'imageUrl', e.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveConfig}
          disabled={saving}
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </Button>
      </div>
    </div>
  )
}
