"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Skin = "default" | "ocean";

interface SkinContextType {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextType | undefined>(undefined);

interface SkinProviderProps {
  children: ReactNode;
}

export function SkinProvider({ children }: SkinProviderProps) {
  // Initialize with localStorage value synchronously
  const [skin, setSkinState] = useState<Skin>(() => {
    const savedSkin = typeof window !== "undefined" 
      ? localStorage.getItem("skin") as Skin | null
      : null;
    
    const currentSkin = (savedSkin === "default" || savedSkin === "ocean") 
      ? savedSkin 
      : "default";

    // Apply skin immediately during initialization
    if (typeof window !== "undefined") {
      const root = document.documentElement;
      root.classList.remove("ocean");
      if (currentSkin === "ocean") {
        root.classList.add("ocean");
      }
    }

    return currentSkin;
  });

  // Apply skin to DOM and save to localStorage when it changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all skin classes
    root.classList.remove("ocean");
    
    // Apply skin class
    if (skin === "ocean") {
      root.classList.add("ocean");
    }

    // Save to localStorage
    localStorage.setItem("skin", skin);
  }, [skin]);

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