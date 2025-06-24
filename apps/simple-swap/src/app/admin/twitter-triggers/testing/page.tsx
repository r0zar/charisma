import React from 'react';
import type { Metadata } from 'next';
import { FlaskConical, TestTube, Activity, Settings } from 'lucide-react';
import TwitterTriggersTestingClient from './testing-client';

export const metadata: Metadata = {
    title: 'Twitter Triggers Testing | Admin Dashboard',
    description: 'Comprehensive testing dashboard for Twitter triggers system',
};

export default function TwitterTriggersTestingPage() {
    return (
        <div className="mx-auto px-4 py-8 max-w-7xl w-full">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <FlaskConical className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Twitter Triggers Testing
                        </h1>
                        <p className="text-muted-foreground">
                            Comprehensive testing and debugging tools for the Twitter triggers system
                        </p>
                    </div>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <TestTube className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-1" />
                        <div>
                            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                                Testing Environment
                            </h3>
                            <p className="text-sm text-purple-800 dark:text-purple-200">
                                This dashboard provides isolated testing of Twitter triggers components using real data.
                                All tests are separate from production triggers and executions.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <TwitterTriggersTestingClient />
        </div>
    );
}