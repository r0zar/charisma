"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { toast, Toaster } from "sonner";

// Notification types for consistency with existing API
export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline";
}

export interface NotificationContextType {
  showSuccess: (title: string, message?: string, duration?: number) => string | number;
  showError: (title: string, message?: string, duration?: number) => string | number;
  showWarning: (title: string, message?: string, duration?: number) => string | number;
  showInfo: (title: string, message?: string, duration?: number) => string | number;
  showMessage: (title: string, message?: string, duration?: number) => string | number;
  dismiss: (id: string | number) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  // Convenience methods for different notification types using Sonner
  const showSuccess = (title: string, message?: string, duration?: number) => {
    return toast.success(title, {
      description: message,
      duration: duration ?? 4000,
    });
  };

  const showError = (title: string, message?: string, duration?: number) => {
    return toast.error(title, {
      description: message,
      duration: duration ?? Infinity, // Errors don't auto-dismiss by default
    });
  };

  const showWarning = (title: string, message?: string, duration?: number) => {
    return toast.warning(title, {
      description: message,
      duration: duration ?? 4000,
    });
  };

  const showInfo = (title: string, message?: string, duration?: number) => {
    return toast.info(title, {
      description: message,
      duration: duration ?? 4000,
    });
  };

  const showMessage = (title: string, message?: string, duration?: number) => {
    return toast(title, {
      description: message,
      duration: duration ?? 4000,
    });
  };

  const dismiss = (id: string | number) => {
    toast.dismiss(id);
  };

  const dismissAll = () => {
    toast.dismiss();
  };

  const value: NotificationContextType = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showMessage,
    dismiss,
    dismissAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster 
        position="top-right"
        expand={true}
        richColors={true}
        closeButton={false}
        toastOptions={{
          style: {
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-card-foreground)',
          },
        }}
      />
    </NotificationContext.Provider>
  );
}

// Hook to access notification context

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}