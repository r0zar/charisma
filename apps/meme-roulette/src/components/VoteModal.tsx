'use client';

import React from 'react';
import { Token } from '@/types/spin';
import { VoteWizard } from './vote-wizard';

interface VoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokens: Token[];
}

const VoteModal = ({ isOpen, onClose, tokens }: VoteModalProps) => {
    return (
        <VoteWizard
            isOpen={isOpen}
            onClose={onClose}
            tokens={tokens}
        />
    );
};

export default VoteModal; 