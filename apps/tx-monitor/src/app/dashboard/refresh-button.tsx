'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Re-reads the dashboard on the server, without a full reload */
export function RefreshButton() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    return (
        <Button variant="outline" size="sm" onClick={() => startTransition(() => router.refresh())} disabled={pending}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} /> Refresh
        </Button>
    );
}
