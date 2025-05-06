"use client";
import { TokensList } from '@/components/tokens/tokens-list';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

// Set this to dynamic to ensure we always get fresh data
export const dynamic = 'force-dynamic';

export default function TokensPage() {
    const [activeTab, setActiveTab] = useState<'all' | 'sip10' | 'lp'>('all');

    return (
        <div className="container pb-12">
            <Tabs
                value={activeTab}
                onValueChange={(value: string) => setActiveTab(value as 'all' | 'sip10' | 'lp')}
                className="w-full mb-6"
            >
                <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
                    <TabsTrigger value="all">All Tokens</TabsTrigger>
                    <TabsTrigger value="sip10">SIP10</TabsTrigger>
                    <TabsTrigger value="lp">LP Tokens</TabsTrigger>
                </TabsList>
            </Tabs>
            <TokensList filterType={activeTab} />
        </div>
    );
} 