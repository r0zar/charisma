import React from 'react';
import type { Metadata } from 'next';
import { TwitterIcon, Users, Zap, Settings } from 'lucide-react';
import TwitterTriggersClient from './twitter-triggers-client';

export const metadata: Metadata = {
    title: 'Twitter Triggers | Admin Dashboard',
    description: 'Manage Twitter-triggered orders and social trading features',
};

export default function TwitterTriggersAdmin() {
    return (
        <div className="mx-auto px-4 py-8 max-w-7xl w-full">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <TwitterIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Twitter Triggers
                        </h1>
                        <p className="text-muted-foreground">
                            Manage social trading triggers and BNS-enabled order automation
                        </p>
                    </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
                        <div>
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                How Twitter Triggers Work
                            </h3>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Set up orders that automatically execute when someone with a <code>.btc</code> username 
                                replies to your tweets. The replier becomes the recipient of the swap tokens.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <TwitterTriggersClient />
        </div>
    );
}