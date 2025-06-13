"use client";

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RefreshButton() {
    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <Button
            onClick={handleRefresh}
            variant="secondary"
            size="sm"
        >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
        </Button>
    );
} 