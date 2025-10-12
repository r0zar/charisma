"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface AdminContextType {
  adminKey: string
  setSuccess: (msg: string | null) => void
  setError: (msg: string | null) => void
  success: string | null
  error: string | null
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adminKey, setAdminKey] = useState("")

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAdminKey(localStorage.getItem('admin-key') || '')
    }
  }, [])

  // Auto-clear messages after 10 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  return (
    <AdminContext.Provider value={{ adminKey, setSuccess, setError, success, error }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider")
  }
  return context
}
