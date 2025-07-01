'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { useWallet } from '@/contexts/wallet-context';
import {
  Key,
  Bell,
  Bot,
  Wallet,
  Shield
} from 'lucide-react';

// Import components for each settings category
import ApiKeysSettings from './components/api-keys-settings';
import NotificationsSettings from './components/notifications-settings';
import PortfolioSettings from './components/portfolio-settings';
import BotsSettings from './components/bots-settings';

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType;
  description: string;
}

const settingsTabs: SettingsTab[] = [
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: <Wallet className="w-4 h-4" />,
    component: PortfolioSettings,
    description: 'View your token balances and portfolio analytics'
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: <Key className="w-4 h-4" />,
    component: ApiKeysSettings,
    description: 'Manage API keys for automated trading'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell className="w-4 h-4" />,
    component: NotificationsSettings,
    description: 'Configure notification preferences'
  },
  {
    id: 'bots',
    label: 'Bots',
    icon: <Bot className="w-4 h-4" />,
    component: BotsSettings,
    description: 'Hosted hot wallets for DeFi automation'
  }
];

export default function SettingsPage() {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState('portfolio');

  const activeTabData = settingsTabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component;

  if (!connected) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="container max-w-6xl mx-auto p-6">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-6">
              <Shield className="w-8 h-8 text-white/40" />
            </div>
            <h2 className="text-xl font-semibold text-white/95 mb-2">Wallet Connection Required</h2>
            <p className="text-white/70 text-center max-w-md">
              Please connect your wallet to access your settings and manage your account preferences.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <div className="container max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white/95 mb-2">Settings</h1>
          <p className="text-white/70">
            Manage your account preferences, security settings, and trading configurations.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-2 backdrop-blur-sm sticky top-6">
              <nav className="space-y-1">
                {settingsTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${activeTab === tab.id
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-white/70 hover:text-white/90 hover:bg-white/[0.05] border border-transparent'
                      }`}
                  >
                    {tab.icon}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{tab.label}</div>
                      <div className="text-xs text-white/50 mt-0.5 leading-tight">
                        {tab.description}
                      </div>
                    </div>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl backdrop-blur-sm min-h-[600px]">
              {/* Tab Header */}
              <div className="border-b border-white/[0.08] p-6">
                <div className="flex items-center gap-3">
                  {activeTabData?.icon}
                  <div>
                    <h2 className="text-xl font-semibold text-white/95">{activeTabData?.label}</h2>
                    <p className="text-white/60 text-sm mt-1">{activeTabData?.description}</p>
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {ActiveComponent && <ActiveComponent />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}