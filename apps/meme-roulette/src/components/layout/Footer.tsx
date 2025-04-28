'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

// Define props for Footer
interface FooterProps {
    // onShowInstructions: () => void; // Remove this prop
}

const Footer: React.FC<FooterProps> = (/* { onShowInstructions } */) => {
    return (
        <footer className="bg-muted/40 border-t border-border/40 py-4 text-center text-sm text-muted-foreground">
            <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
                <span>© {new Date().getFullYear()} Charisma. All rights reserved.</span>
                <div className="flex items-center gap-2">
                    <span>Note: This is a demo app in testing mode. Not all features are available.</span>
                </div>
                <span>
                    <a href="https://github.com/r0zar/charisma" target="_blank" rel="noopener noreferrer">
                        <Github className="w-4 h-4" />
                    </a>
                </span>
            </div>
        </footer>
    );
};

export default Footer;
