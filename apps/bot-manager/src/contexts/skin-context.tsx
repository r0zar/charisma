"use client";

import React, { createContext, type ReactNode,useContext, useEffect, useState } from "react";

type Skin = "default" | "dark" | "ocean" | "sunset" | "forest" | "lavender";

interface SkinContextType {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextType | undefined>(undefined);

interface SkinProviderProps {
  children: ReactNode;
}

export function SkinProvider({ children }: SkinProviderProps) {
  const [skin, setSkinState] = useState<Skin>("default");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage after component mounts to avoid hydration issues
  useEffect(() => {
    const savedSkin = localStorage.getItem("skin") as Skin | null;
    const validSkin = (savedSkin === "default" || savedSkin === "dark" || savedSkin === "ocean" || savedSkin === "sunset" || savedSkin === "forest" || savedSkin === "lavender") 
      ? savedSkin 
      : "default";
    
    setSkinState(validSkin);
    setIsInitialized(true);
  }, []);

  // Apply skin to DOM when it changes
  useEffect(() => {
    if (!isInitialized) return;
    
    const root = document.documentElement;
    
    // Remove all skin classes
    root.classList.remove("dark", "ocean", "sunset", "forest", "lavender");
    
    // Apply skin class (only if not default)
    if (skin !== "default") {
      root.classList.add(skin);
    }

    // Save to localStorage
    localStorage.setItem("skin", skin);
  }, [skin, isInitialized]);

  const setSkin = (newSkin: Skin) => {
    setSkinState(newSkin);
  };

  const value: SkinContextType = {
    skin,
    setSkin,
  };

  return (
    <SkinContext.Provider value={value}>
      {children}
    </SkinContext.Provider>
  );
}

export function useSkin() {
  const context = useContext(SkinContext);
  if (context === undefined) {
    throw new Error("useSkin must be used within a SkinProvider");
  }
  return context;
}