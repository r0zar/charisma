"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import AddNewPoolDialog from './AddNewPoolDialog';
import { PlusCircle } from 'lucide-react';

export default function AddNewPoolButton() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

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
            />
        </>
    );
} 