'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

// Define props for Footer
interface FooterProps {
    // onShowInstructions: () => void; // Remove this prop
}

const Footer: React.FC<FooterProps> = (/* { onShowInstructions } */) => {
    return (
        <footer className="bg-muted/40 border-t border-border/40 py-4 text-center text-sm text-muted-foreground">
            <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
                <span>© {new Date().getFullYear()} Charisma. All rights reserved.</span>
                {/* Remove the button that triggers instructions from here */}
                {/*
                <Button variant="link" size="sm" onClick={onShowInstructions}>
                    <Info size={14} className="mr-1" />
                    Show Instructions
                </Button>
                */}
            </div>
        </footer>
    );
};

export default Footer;
