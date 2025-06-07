"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import AddNewPoolDialog from './AddNewPoolDialog';
import { Import } from 'lucide-react';

export default function AddNewPoolButton() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleOpenDialog = () => {
        setIsDialogOpen(true);
    };

    return (
        <>
            <Button onClick={handleOpenDialog} variant="ghost">
                <Import className="h-4 w-4 mr-2" />
                Import
            </Button>
            <AddNewPoolDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
        </>
    );
} 