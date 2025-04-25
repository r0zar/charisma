'use client';

import React from 'react';
import { PoolDetails } from '@/components/pools/PoolDetails';

interface PoolPageProps {
    params: {
        contractId: string;
    };
}

const PoolPage: React.FC<PoolPageProps> = async ({ params }) => {
    const { contractId } = await params;

    return (
        <main className="container mx-auto px-4 py-8">
            {/* Title can be part of PoolDetails or fetched separately */}
            <PoolDetails contractId={contractId} />
        </main>
    );
};

export default PoolPage; 