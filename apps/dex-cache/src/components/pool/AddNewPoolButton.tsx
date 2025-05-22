"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import AddNewPoolDialog from './AddNewPoolDialog';
import { PlusCircle } from 'lucide-react';

export default function AddNewPoolButton() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    // Define the Launchpad URL here. This could also come from an environment variable.
    const launchpadLiquidityPoolUrl = process.env.NEXT_PUBLIC_LAUNCHPAD_BASE_URL ? `${process.env.NEXT_PUBLIC_LAUNCHPAD_BASE_URL}/templates/liquidity-pool` : '/templates/liquidity-pool';

    const handleOpenDialog = () => {
        setIsDialogOpen(true);
    };

    return (
        <>
            <Button onClick={handleOpenDialog} variant="default">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add New Pool
            </Button>
            <AddNewPoolDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                launchpadUrl={launchpadLiquidityPoolUrl}
            />
        </>
    );
} 