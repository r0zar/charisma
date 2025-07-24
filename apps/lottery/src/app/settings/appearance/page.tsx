"use client"

import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Palette, Check, Sun, Moon, Monitor } from "lucide-react"

const themes = [
  {
    id: "light",
    name: "Light",
    description: "Clean and bright",
    icon: Sun,
    preview: "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200",
  },
  {
    id: "dark", 
    name: "Dark",
    description: "Easy on the eyes",
    icon: Moon,
    preview: "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700",
  },
  {
    id: "system",
    name: "System",
    description: "Follow system preference",
    icon: Monitor,
    preview: "bg-gradient-to-br from-slate-300 to-slate-600 border-slate-400",
  }
]

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Theme Selection
        </CardTitle>
        <CardDescription>
          Choose your preferred theme appearance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon
            const isActive = theme === themeOption.id

            return (
              <Card 
                key={themeOption.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isActive ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setTheme(themeOption.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {themeOption.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {themeOption.description}
                      </CardDescription>
                    </div>
                    {isActive && (
                      <Badge variant="default" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className={`h-16 rounded-md border-2 ${themeOption.preview}`} />
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Click any theme to apply it instantly
        </div>
      </CardContent>
    </Card>
  )
}