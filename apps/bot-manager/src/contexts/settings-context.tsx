"use client";

import React, { createContext, type ReactNode,useContext, useEffect, useState } from "react";

// Types for all settings categories
export interface NotificationSettings {
  trade: boolean;
  error: boolean;
  status: boolean;
  performance: boolean;
  security: boolean;
}

export interface GeneralSettings {
  isDarkMode: boolean;
  compactMode: boolean;
  autoRefresh: boolean;
}

export interface NetworkSettings {
  network: 'mainnet' | 'testnet' | 'devnet';
  rpcEndpoint: string;
}

export interface BotDefaultSettings {
  defaultStrategy: 'yield-farming' | 'dca' | 'arbitrage' | 'liquidity-mining';
}

export interface SecuritySettings {
  apiKey: string;
  autoLockTimeout: 'never' | '15' | '30' | '60';
  requireConfirmation: boolean;
}

export interface AdvancedSettings {
  debugMode: boolean;
  performanceMonitoring: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  network: NetworkSettings;
  botDefaults: BotDefaultSettings;
  notifications: NotificationSettings;
  notificationChannel: 'browser' | 'email' | 'webhook' | 'disabled';
  security: SecuritySettings;
  advanced: AdvancedSettings;
}

// Default settings
const defaultSettings: AppSettings = {
  general: {
    isDarkMode: true,
    compactMode: false,
    autoRefresh: true,
  },
  network: {
    network: 'mainnet',
    rpcEndpoint: 'https://stacks-node-api.mainnet.stacks.co',
  },
  botDefaults: {
    defaultStrategy: 'yield-farming',
  },
  notifications: {
    trade: true,
    error: true,
    status: false,
    performance: true,
    security: true,
  },
  notificationChannel: 'browser',
  security: {
    apiKey: 'sk-1234567890abcdef1234567890abcdef12345678',
    autoLockTimeout: '30',
    requireConfirmation: true,
  },
  advanced: {
    debugMode: false,
    performanceMonitoring: true,
  },
};

export interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateGeneralSettings: (updates: Partial<GeneralSettings>) => void;
  updateNetworkSettings: (updates: Partial<NetworkSettings>) => void;
  updateBotDefaults: (updates: Partial<BotDefaultSettings>) => void;
  updateNotifications: (updates: Partial<NotificationSettings>) => void;
  updateNotificationChannel: (channel: AppSettings['notificationChannel']) => void;
  updateSecuritySettings: (updates: Partial<SecuritySettings>) => void;
  updateAdvancedSettings: (updates: Partial<AdvancedSettings>) => void;
  resetSettings: () => void;
  exportSettings: () => string;
  importSettings: (settingsJson: string) => boolean;
  regenerateApiKey: () => void;
  loading: boolean;
  error: string | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'bot-manager-settings';

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // Merge with defaults to ensure all properties exist
        const mergedSettings = mergeWithDefaults(parsedSettings, defaultSettings);
        setSettings(mergedSettings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        setError(null);
      } catch (err) {
        console.error('Failed to save settings:', err);
        setError('Failed to save settings');
      }
    }
  }, [settings, loading]);

  // Deep merge function to ensure all properties exist
  const mergeWithDefaults = (saved: any, defaults: AppSettings): AppSettings => {
    const merged = { ...defaults };
    
    if (saved.general) {
      merged.general = { ...defaults.general, ...saved.general };
    }
    if (saved.network) {
      merged.network = { ...defaults.network, ...saved.network };
    }
    if (saved.botDefaults) {
      merged.botDefaults = { ...defaults.botDefaults, ...saved.botDefaults };
    }
    if (saved.notifications) {
      merged.notifications = { ...defaults.notifications, ...saved.notifications };
    }
    if (saved.notificationChannel) {
      merged.notificationChannel = saved.notificationChannel;
    }
    if (saved.security) {
      merged.security = { ...defaults.security, ...saved.security };
    }
    if (saved.advanced) {
      merged.advanced = { ...defaults.advanced, ...saved.advanced };
    }
    
    return merged;
  };

  // Update functions for each settings category
  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const updateGeneralSettings = (updates: Partial<GeneralSettings>) => {
    setSettings(prev => ({
      ...prev,
      general: { ...prev.general, ...updates }
    }));
  };

  const updateNetworkSettings = (updates: Partial<NetworkSettings>) => {
    setSettings(prev => ({
      ...prev,
      network: { ...prev.network, ...updates }
    }));
  };

  const updateBotDefaults = (updates: Partial<BotDefaultSettings>) => {
    setSettings(prev => ({
      ...prev,
      botDefaults: { ...prev.botDefaults, ...updates }
    }));
  };

  const updateNotifications = (updates: Partial<NotificationSettings>) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, ...updates }
    }));
  };

  const updateNotificationChannel = (channel: AppSettings['notificationChannel']) => {
    setSettings(prev => ({
      ...prev,
      notificationChannel: channel
    }));
  };

  const updateSecuritySettings = (updates: Partial<SecuritySettings>) => {
    setSettings(prev => ({
      ...prev,
      security: { ...prev.security, ...updates }
    }));
  };

  const updateAdvancedSettings = (updates: Partial<AdvancedSettings>) => {
    setSettings(prev => ({
      ...prev,
      advanced: { ...prev.advanced, ...updates }
    }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    setError(null);
  };

  const exportSettings = (): string => {
    return JSON.stringify(settings, null, 2);
  };

  const importSettings = (settingsJson: string): boolean => {
    try {
      const parsedSettings = JSON.parse(settingsJson);
      const mergedSettings = mergeWithDefaults(parsedSettings, defaultSettings);
      setSettings(mergedSettings);
      setError(null);
      return true;
    } catch (err) {
      console.error('Failed to import settings:', err);
      setError('Failed to import settings: Invalid JSON');
      return false;
    }
  };

  const regenerateApiKey = () => {
    const newApiKey = `sk-${  Math.random().toString(36).substring(2, 15)  }${Math.random().toString(36).substring(2, 15)}`;
    updateSecuritySettings({ apiKey: newApiKey });
  };

  const value: SettingsContextType = {
    settings,
    updateSettings,
    updateGeneralSettings,
    updateNetworkSettings,
    updateBotDefaults,
    updateNotifications,
    updateNotificationChannel,
    updateSecuritySettings,
    updateAdvancedSettings,
    resetSettings,
    exportSettings,
    importSettings,
    regenerateApiKey,
    loading,
    error,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}