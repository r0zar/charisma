'use client';

import React, { useState } from 'react';
import { 
    TestTube, 
    Activity, 
    Search, 
    CheckCircle, 
    Settings,
    ArrowLeft,
    RotateCcw,
    Clock
} from 'lucide-react';
import Link from 'next/link';
import ComponentTester from './components/ComponentTester';
import FlowTester from './components/FlowTester';
import DataInspector from './components/DataInspector';
import ValidationTester from './components/ValidationTester';
import BackfillManager from './components/BackfillManager';
import QueueManager from './components/QueueManager';

type TestingTab = 'components' | 'flow' | 'data' | 'validation' | 'backfill' | 'queue';

export default function TwitterTriggersTestingClient() {
    const [activeTab, setActiveTab] = useState<TestingTab>('components');

    const tabs = [
        {
            id: 'components' as TestingTab,
            name: 'Component Testing',
            icon: TestTube,
            description: 'Test individual components like Twitter scraping and BNS resolution'
        },
        {
            id: 'flow' as TestingTab,
            name: 'Flow Testing',
            icon: Activity,
            description: 'Test end-to-end trigger execution flows'
        },
        {
            id: 'data' as TestingTab,
            name: 'Data Inspection',
            icon: Search,
            description: 'Inspect detailed results and execution data'
        },
        {
            id: 'validation' as TestingTab,
            name: 'Validation Testing',
            icon: CheckCircle,
            description: 'Test edge cases and validation scenarios'
        },
        {
            id: 'backfill' as TestingTab,
            name: 'Reply Backfill',
            icon: RotateCcw,
            description: 'Send retroactive reply notifications to existing successful executions'
        },
        {
            id: 'queue' as TestingTab,
            name: 'Queue Management',
            icon: Clock,
            description: 'Monitor and manage the Twitter reply queue system'
        }
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'components':
                return <ComponentTester />;
            case 'flow':
                return <FlowTester />;
            case 'data':
                return <DataInspector />;
            case 'validation':
                return <ValidationTester />;
            case 'backfill':
                return <BackfillManager />;
            case 'queue':
                return <QueueManager />;
            default:
                return <ComponentTester />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Navigation */}
            <div className="flex items-center gap-4 mb-6">
                <Link 
                    href="/admin/twitter-triggers"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Main Dashboard
                </Link>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-border">
                <nav className="flex space-x-8" aria-label="Testing Tabs">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                                }`}
                                aria-current={activeTab === tab.id ? 'page' : undefined}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.name}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Description */}
            <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                    {tabs.find(tab => tab.id === activeTab)?.description}
                </p>
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px]">
                {renderTabContent()}
            </div>
        </div>
    );
}