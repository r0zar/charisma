"use client"

import { Check } from "lucide-react"
import { useEffect,useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSkin } from "@/contexts/skin-context"

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

export default function SkinsPage() {
  const { skin: currentSkin, setSkin } = useSkin()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const applySkin = (skinId: string) => {
    setSkin(skinId as any) // Type assertion since we know these are valid skin values
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Skins</h1>
          <p className="text-muted-foreground">
            Customize the appearance of your application with different themes and color schemes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skins.map((skinOption) => (
            <Card 
              key={skinOption.id} 
              className={`cursor-pointer transition-all hover:shadow-lg ${
                mounted && currentSkin === skinOption.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={mounted ? () => applySkin(skinOption.id) : undefined}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{skinOption.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {skinOption.description}
                    </CardDescription>
                  </div>
                  {mounted && currentSkin === skinOption.id && (
                    <Badge variant="default" className="ml-2">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Preview */}
                <div className={`h-24 rounded-lg mb-4 ${skinOption.preview}`} />
                
                {/* Color Palette */}
                <div className="flex space-x-2">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: skinOption.colors.primary }}
                    title="Primary"
                  />
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-gray-200 shadow-sm"
                    style={{ backgroundColor: skinOption.colors.background }}
                    title="Background"
                  />
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: skinOption.colors.accent }}
                    title="Accent"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Click any skin to apply it instantly
        </div>
      </div>
    </div>
  )
}