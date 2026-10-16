"use client";
import { MetadataList } from '@/components/metadata/metadata-list';
import { NftCollectionList } from '@/components/nft/collection-list';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

// Set this to dynamic to ensure we always get fresh data
export const dynamic = 'force-dynamic';

type Tab = 'all' | 'sip10' | 'lp' | 'nft';

export default function MetadataPage() {
    const [activeTab, setActiveTab] = useState<Tab>('all');

    return (
        <div className="container pb-12">
            <Tabs
                value={activeTab}
                onValueChange={(value: string) => setActiveTab(value as Tab)}
                className="w-full mb-6"
            >
                <TabsList className="grid w-full grid-cols-4 md:w-[520px]">
                    <TabsTrigger value="all">All Metadata</TabsTrigger>
                    <TabsTrigger value="sip10">SIP10</TabsTrigger>
                    <TabsTrigger value="lp">Vaults</TabsTrigger>
                    <TabsTrigger value="nft">NFTs</TabsTrigger>
                </TabsList>
            </Tabs>
            {activeTab === 'nft' ? <NftCollectionList /> : <MetadataList filterType={activeTab} />}
        </div>
    );
}
