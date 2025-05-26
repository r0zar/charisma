"use client";

import React from 'react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import SingleOrderPreview from './SingleOrderPreview';
import DCAOrderPreview from './DCAOrderPreview';
import SandwichOrderPreview from './SandwichOrderPreview';

export default function OrderPreview() {
    const { selectedOrderType } = useProModeContext();

    switch (selectedOrderType) {
        case 'single':
            return <SingleOrderPreview />;
        case 'dca':
            return <DCAOrderPreview />;
        case 'sandwich':
            return <SandwichOrderPreview />;
        default:
            return <SingleOrderPreview />;
    }
} 