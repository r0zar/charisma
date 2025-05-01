'use client';

import React from 'react';
import { MultihopTester } from '@/components/multihop/MultihopTester';

const MultihopPage: React.FC = () => {
    return (
        <main className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-4">Multi-Hop Swap Tester</h1>
            <MultihopTester />
        </main>
    );
};

export default MultihopPage; 