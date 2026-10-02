"use client"

import { useState, useEffect } from "react"
import { Monitor, Moon, Sun, Check } from "lucide-react"
import { applyTheme, readTheme, type ThemeChoice } from "@repo/brand/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const CHOICES: { id: ThemeChoice; name: string; description: string; icon: typeof Monitor }[] = [
  { id: "system", name: "System", description: "Follow your device", icon: Monitor },
  { id: "light", name: "Light · Bitcoin", description: "Paper, hairlines and black bars", icon: Sun },
  { id: "dark", name: "Dark · RPG", description: "Black, glass and crimson", icon: Moon },
]

export default function AppearanceSettingsPage() {
  const [current, setCurrent] = useState<ThemeChoice>("system")

  useEffect(() => setCurrent(readTheme()), [])

  const pick = (choice: ThemeChoice) => {
    applyTheme(choice)
    setCurrent(choice)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>The same choice as the toggle in the header, shared with every Charisma app on this browser.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CHOICES.map(({ id, name, description, icon: Icon }) => {
            const active = current === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                aria-pressed={active}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${active ? "border-line-strong bg-surface-selected" : "border-line bg-surface hover:bg-surface-hover"}`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ink-body" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{name}</span>
                  <span className="block text-xs text-ink-muted">{description}</span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-accent-text" />}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
