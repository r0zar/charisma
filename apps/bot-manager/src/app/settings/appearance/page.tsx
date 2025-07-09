"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Palette, Check } from "lucide-react"
import { useSkin } from "@/contexts/skin-context"

// Skins data
const skins = [
  {
    id: "default",
    name: "Default",
    description: "Clean and minimal design",
    preview: "bg-gradient-to-br from-blue-50 to-blue-100",
    colors: {
      primary: "#3b82f6",
      background: "#ffffff",
      accent: "#f1f5f9"
    }
  },
  {
    id: "dark",
    name: "Dark Mode",
    description: "Easy on the eyes",
    preview: "bg-gradient-to-br from-slate-800 to-slate-900",
    colors: {
      primary: "#60a5fa",
      background: "#0f172a",
      accent: "#334155"
    }
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm orange and pink tones",
    preview: "bg-gradient-to-br from-orange-300 to-pink-400",
    colors: {
      primary: "#f97316",
      background: "#fff7ed",
      accent: "#fed7aa"
    }
  },
  {
    id: "forest",
    name: "Forest",
    description: "Natural green theme",
    preview: "bg-gradient-to-br from-green-400 to-emerald-600",
    colors: {
      primary: "#059669",
      background: "#f0fdf4",
      accent: "#bbf7d0"
    }
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep blue waters",
    preview: "bg-gradient-to-br from-cyan-400 to-blue-600",
    colors: {
      primary: "#0891b2",
      background: "#f0f9ff",
      accent: "#bae6fd"
    }
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Soft purple elegance",
    preview: "bg-gradient-to-br from-purple-300 to-violet-500",
    colors: {
      primary: "#7c3aed",
      background: "#faf5ff",
      accent: "#ddd6fe"
    }
  }
]

export default function AppearanceSettingsPage() {
  const { skin: currentSkin, setSkin } = useSkin()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const applySkin = (skinId: string) => {
    setSkin(skinId as any) // Type assertion since we know these are valid skin values
  }

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
          Choose your preferred color theme and visual style
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skins.map((skinOption) => (
            <Card 
              key={skinOption.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                currentSkin === skinOption.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => applySkin(skinOption.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{skinOption.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {skinOption.description}
                    </CardDescription>
                  </div>
                  {currentSkin === skinOption.id && (
                    <Badge variant="default" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {/* Preview */}
                <div className={`h-16 rounded-md mb-3 ${skinOption.preview}`} />
                
                {/* Color Palette */}
                <div className="flex space-x-1">
                  <div 
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: skinOption.colors.primary }}
                    title="Primary"
                  />
                  <div 
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: skinOption.colors.background }}
                    title="Background"
                  />
                  <div 
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: skinOption.colors.accent }}
                    title="Accent"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Click any theme to apply it instantly
        </div>
      </CardContent>
    </Card>
  )
}